import { estAbsent, type Absence } from '../../domaine/absence'
import { semaineDe } from '../../domaine/calendrier'
import { estAutonome, type Collaborateur } from '../../domaine/collaborateur'
import type { Rayon } from '../../domaine/magasin'
import type { BesoinJour } from '../besoin'
import { dureeTravailEffectif, type Infraction, type Vacation } from '../regles'
import { calculerCouverture } from './index'

/**
 * Tableau de bord et rapports (cahier des charges §14).
 *
 * Module pur. Le tableau de bord est PERSONNEL : le patron n'y accede jamais.
 * Il recoit des documents PDF, produits a partir de ces memes chiffres.
 */

export interface TableauDeBord {
  readonly semaine: string
  /** Heures de presence prevues au planning. */
  readonly heuresPrevues: number
  /** Budget d'heures du service pour la semaine. */
  readonly heuresBudget: number
  readonly ecartAuBudget: number
  /** Part du besoin couverte, de 0 a 1. */
  readonly couverture: number
  readonly heuresSupplementaires: number
  /** Part des jours-personnes perdus pour absence, de 0 a 1. */
  readonly absenteisme: number
  /** Nombre moyen de competences tenues en autonomie, par personne. */
  readonly polyvalenceMoyenne: number
  /** Competences tenues par une seule personne, ou par personne. */
  readonly competencesFragiles: number
  readonly reglesEnfreintes: number
  readonly avertissements: number
  readonly effectif: number
  /** Chiffre d'affaires saisi, s'il l'a ete. */
  readonly chiffreAffaires: number | null
  /** Chiffre d'affaires par heure travaillee. */
  readonly productivite: number | null
}

export interface EntreesTableauDeBord {
  readonly semaine: string
  readonly rayons: readonly Rayon[]
  readonly vacations: readonly Vacation[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly absences: readonly Absence[]
  readonly besoins: readonly BesoinJour[]
  readonly infractions: readonly Infraction[]
  readonly budgetHeuresParRayon: Readonly<Record<string, number>>
  readonly dureeLegaleHebdomadaireMinutes: number
  readonly chiffreAffaires?: number | null
}

export function construireLeTableauDeBord(entrees: EntreesTableauDeBord): TableauDeBord {
  const jours = semaineDe(entrees.semaine)
  const actifs = entrees.collaborateurs.filter((collaborateur) => collaborateur.actif)

  const heuresPrevues =
    entrees.vacations.reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60

  const heuresBudget = entrees.rayons
    .filter((rayon) => rayon.actif)
    .reduce((somme, rayon) => somme + (entrees.budgetHeuresParRayon[rayon.id] ?? 0), 0)

  let besoinTotal = 0
  let manqueTotal = 0
  for (const besoin of entrees.besoins) {
    const couverture = calculerCouverture(besoin, entrees.vacations, entrees.collaborateurs)
    besoinTotal += couverture.heuresBesoin
    manqueTotal += couverture.heuresManquantes
  }

  // Heures supplementaires : au-dela de la duree legale, personne par personne.
  let supplementaires = 0
  for (const collaborateur of actifs) {
    const heures =
      entrees.vacations
        .filter((vacation) => vacation.collaborateurId === collaborateur.id)
        .reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60
    if (collaborateur.tempsPlein) {
      supplementaires += Math.max(0, heures - entrees.dureeLegaleHebdomadaireMinutes / 60)
    }
  }

  // Absenteisme : jours-personnes perdus sur les jours ouvrables de la semaine.
  const joursOuvrables = jours.slice(0, 6)
  const perdus = actifs.reduce(
    (somme, collaborateur) =>
      somme +
      joursOuvrables.filter((jour) => estAbsent(entrees.absences, collaborateur.id, jour)).length,
    0,
  )
  const possibles = actifs.length * joursOuvrables.length

  const competences = [
    ...new Set(actifs.flatMap((collaborateur) => Object.keys(collaborateur.competences))),
  ]
  const polyvalence = actifs.map(
    (collaborateur) =>
      competences.filter((competence) => estAutonome(collaborateur, competence)).length,
  )
  const fragiles = competences.filter(
    (competence) =>
      actifs.filter((collaborateur) => estAutonome(collaborateur, competence)).length <= 1,
  ).length

  const chiffreAffaires = entrees.chiffreAffaires ?? null

  return {
    semaine: entrees.semaine,
    heuresPrevues,
    heuresBudget,
    ecartAuBudget: heuresPrevues - heuresBudget,
    couverture: besoinTotal === 0 ? 1 : 1 - manqueTotal / besoinTotal,
    heuresSupplementaires: supplementaires,
    absenteisme: possibles === 0 ? 0 : perdus / possibles,
    polyvalenceMoyenne:
      polyvalence.length === 0
        ? 0
        : polyvalence.reduce((somme, valeur) => somme + valeur, 0) / polyvalence.length,
    competencesFragiles: fragiles,
    reglesEnfreintes: entrees.infractions.filter((i) => i.severite === 'bloquante').length,
    avertissements: entrees.infractions.filter((i) => i.severite === 'avertissement').length,
    effectif: actifs.length,
    chiffreAffaires,
    productivite:
      chiffreAffaires === null || heuresPrevues === 0 ? null : chiffreAffaires / heuresPrevues,
  }
}

export interface ActionProposee {
  readonly priorite: 1 | 2 | 3
  readonly titre: string
  readonly detail: string
}

/**
 * Plan d'actions deduit du tableau de bord (§14).
 * Rien d'automatique : ce sont des propositions, classees par urgence.
 */
export function proposerDesActions(tableau: TableauDeBord): ActionProposee[] {
  const actions: ActionProposee[] = []

  if (tableau.reglesEnfreintes > 0) {
    actions.push({
      priorite: 1,
      titre: `${tableau.reglesEnfreintes} règle${tableau.reglesEnfreintes > 1 ? 's' : ''} du Code du travail enfreinte${tableau.reglesEnfreintes > 1 ? 's' : ''}`,
      detail: 'À corriger avant toute diffusion du planning.',
    })
  }

  if (tableau.couverture < 0.9) {
    actions.push({
      priorite: 1,
      titre: `Couverture du besoin à ${Math.round(tableau.couverture * 100)} %`,
      detail:
        'Des créneaux restent découverts. Renfort, intérim ou réorganisation des horaires à envisager.',
    })
  }

  if (tableau.ecartAuBudget > 0) {
    actions.push({
      priorite: 2,
      titre: `Budget dépassé de ${Math.round(tableau.ecartAuBudget)} h`,
      detail:
        'Les heures prévues dépassent le budget du service. Vérifier les sureffectifs par rayon.',
    })
  }

  if (tableau.competencesFragiles > 0) {
    actions.push({
      priorite: 2,
      titre: `${tableau.competencesFragiles} compétence${tableau.competencesFragiles > 1 ? 's' : ''} tenue${tableau.competencesFragiles > 1 ? 's' : ''} par une seule personne`,
      detail: 'Une absence suffirait à découvrir le poste. Prévoir une formation.',
    })
  }

  if (tableau.absenteisme > 0.08) {
    actions.push({
      priorite: 3,
      titre: `Absentéisme à ${Math.round(tableau.absenteisme * 100)} %`,
      detail: 'Niveau inhabituel sur la semaine. À suivre sur plusieurs semaines avant de conclure.',
    })
  }

  if (tableau.heuresSupplementaires > 10) {
    actions.push({
      priorite: 3,
      titre: `${Math.round(tableau.heuresSupplementaires)} heures supplémentaires`,
      detail: 'Vérifier le contingent annuel et envisager un renfort si cela se répète.',
    })
  }

  return actions.sort((a, b) => a.priorite - b.priorite)
}
