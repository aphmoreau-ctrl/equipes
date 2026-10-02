import { TRANCHE_MINUTES, enMinutes, enTexte } from '../../domaine/temps'
import { estAbsent, type Absence } from '../../domaine/absence'
import {
  disponibiliteDuJour,
  enFormation,
  nomAffiche,
  type Collaborateur,
} from '../../domaine/collaborateur'
import { jourDeLaSemaine, jourEnTexte } from '../../domaine/calendrier'
import type { BesoinJour } from '../besoin'
import { calculerCouverture } from '../indicateurs'
import type { Renfort } from '../../domaine/vivier'
import { dureeTravailEffectif, type Vacation } from '../regles'
import { heuresEnTexte } from '../../domaine/nombres'

/**
 * Conflits restants, et solutions classees (§9.7).
 *
 * Un conflit, c'est un besoin qui reste decouvert apres le calcul. L'interet
 * n'est pas de le constater — la couverture le dit deja — mais de proposer
 * QUOI FAIRE, du moins couteux au plus couteux :
 *
 *   1. preter quelqu'un d'un autre rayon (gratuit, immediat) ;
 *   2. decaler un poste existant (gratuit, demande un accord) ;
 *   3. des heures complementaires (cout limite, cadre legal) ;
 *   4. un renfort exterieur (cout reel) ;
 *   5. former quelqu'un (cout differe, mais regle le probleme pour de bon).
 *
 * Module pur : aucune dependance a l'interface, resultat trie.
 */

export type NatureConflit =
  | 'manque-de-monde'
  | 'competence-absente'
  | 'competence-critique'
  | 'binome-incomplet'

export type NatureSolution =
  | 'pret'
  | 'decalage'
  | 'heures-complementaires'
  | 'renfort-exterieur'
  | 'formation'

export interface Solution {
  readonly nature: NatureSolution
  /** Phrase prete a lire : « Prêter Camille D. de la crèmerie ». */
  readonly libelle: string
  readonly detail: string
  /** Du moins couteux (1) au plus couteux (5). Sert au classement. */
  readonly cout: number
  /** Qui est concerne, quand la solution designe quelqu'un. */
  readonly collaborateurId?: string
  readonly renfortId?: string
  /** Vacation a decaler, et de combien de minutes. */
  readonly vacationId?: string
  readonly decalageMinutes?: number
  /** Horaires proposes pour un prêt ou un renfort. */
  readonly debut?: string
  readonly fin?: string
}

export interface Conflit {
  readonly id: string
  readonly rayonId: string
  readonly jour: string
  readonly nature: NatureConflit
  readonly debutMinutes: number
  readonly finMinutes: number
  /** Competence en cause, pour les conflits de competence. */
  readonly competence?: string
  readonly libelle: string
  readonly solutions: readonly Solution[]
}

export interface EntreesConflits {
  readonly besoins: readonly BesoinJour[]
  readonly vacations: readonly Vacation[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly absences: readonly Absence[]
  readonly renforts: readonly Renfort[]
  /** Nom lisible de chaque rayon. */
  readonly nomDuRayon: (rayonId: string) => string
}

const COUTS: Readonly<Record<NatureSolution, number>> = {
  pret: 1,
  decalage: 2,
  'heures-complementaires': 3,
  'renfort-exterieur': 4,
  formation: 5,
}

/** Plage de tranches consecutives partageant le meme probleme. */
interface Plage {
  readonly debut: number
  readonly fin: number
}

function regrouper(indices: readonly number[]): Plage[] {
  const plages: Plage[] = []
  for (const index of [...indices].sort((a, b) => a - b)) {
    const derniere = plages[plages.length - 1]
    if (derniere !== undefined && derniere.fin === index) {
      plages[plages.length - 1] = { debut: derniere.debut, fin: index + 1 }
      continue
    }
    plages.push({ debut: index, fin: index + 1 })
  }
  return plages
}

/** Cette personne est-elle libre ce jour-la, et peut-elle venir ? */
function estLibre(
  collaborateur: Collaborateur,
  jour: string,
  vacations: readonly Vacation[],
  absences: readonly Absence[],
): boolean {
  if (!collaborateur.actif) return false
  if (estAbsent(absences, collaborateur.id, jour)) return false
  if (enFormation(collaborateur, jour) !== undefined) return false
  if (!disponibiliteDuJour(collaborateur, jourDeLaSemaine(jour)).disponible) return false
  if (jour < collaborateur.dateEntree) return false
  if (collaborateur.finContrat !== null && jour > collaborateur.finContrat) return false
  return !vacations.some(
    (vacation) => vacation.collaborateurId === collaborateur.id && vacation.jour === jour,
  )
}

/** Heures deja prevues dans la semaine, pour juger des heures complementaires. */
function heuresDeLaSemaine(collaborateurId: string, vacations: readonly Vacation[]): number {
  return (
    vacations
      .filter((vacation) => vacation.collaborateurId === collaborateurId)
      .reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60
  )
}

export function chercherLesConflits(entrees: EntreesConflits): Conflit[] {
  const conflits: Conflit[] = []

  for (const besoin of [...entrees.besoins].sort(
    (a, b) => a.date.localeCompare(b.date) || a.rayonId.localeCompare(b.rayonId),
  )) {
    const duJour = entrees.vacations.filter(
      (vacation) => vacation.rayonId === besoin.rayonId && vacation.jour === besoin.date,
    )
    const couverture = calculerCouverture(besoin, duJour, entrees.collaborateurs)

    const manques: number[] = []
    const parCompetence = new Map<string, number[]>()
    const parCritique = new Map<string, number[]>()
    const parBinome = new Map<string, number[]>()

    for (const tranche of couverture.tranches) {
      if (tranche.besoin > tranche.presents) manques.push(tranche.index)
      for (const competence of tranche.competencesManquantes) {
        const cible = tranche.competencesCritiquesManquantes.includes(competence)
          ? parCritique
          : parCompetence
        cible.set(competence, [...(cible.get(competence) ?? []), tranche.index])
      }
      for (const competence of tranche.binomesIncomplets) {
        parBinome.set(competence, [...(parBinome.get(competence) ?? []), tranche.index])
      }
    }

    for (const plage of regrouper(manques)) {
      conflits.push(
        construire(entrees, besoin, plage, 'manque-de-monde', undefined, duJour),
      )
    }
    for (const [competence, indices] of [...parCritique].sort(([a], [b]) => a.localeCompare(b))) {
      for (const plage of regrouper(indices)) {
        conflits.push(
          construire(entrees, besoin, plage, 'competence-critique', competence, duJour),
        )
      }
    }
    for (const [competence, indices] of [...parCompetence].sort(([a], [b]) => a.localeCompare(b))) {
      for (const plage of regrouper(indices)) {
        conflits.push(
          construire(entrees, besoin, plage, 'competence-absente', competence, duJour),
        )
      }
    }
    for (const [competence, indices] of [...parBinome].sort(([a], [b]) => a.localeCompare(b))) {
      for (const plage of regrouper(indices)) {
        conflits.push(construire(entrees, besoin, plage, 'binome-incomplet', competence, duJour))
      }
    }
  }

  // Le plus grave d'abord : critique, puis competence, puis monde, puis binome.
  const gravite: Record<NatureConflit, number> = {
    'competence-critique': 0,
    'competence-absente': 1,
    'manque-de-monde': 2,
    'binome-incomplet': 3,
  }

  return conflits.sort(
    (a, b) =>
      gravite[a.nature] - gravite[b.nature] ||
      a.jour.localeCompare(b.jour) ||
      a.debutMinutes - b.debutMinutes ||
      a.rayonId.localeCompare(b.rayonId),
  )
}

function construire(
  entrees: EntreesConflits,
  besoin: BesoinJour,
  plage: Plage,
  nature: NatureConflit,
  competence: string | undefined,
  duJour: readonly Vacation[],
): Conflit {
  const debutMinutes = plage.debut * TRANCHE_MINUTES
  const finMinutes = plage.fin * TRANCHE_MINUTES
  const rayon = entrees.nomDuRayon(besoin.rayonId)
  const plageTexte = `${enTexte(debutMinutes)}–${enTexte(finMinutes % 1440)}`

  const libelle =
    nature === 'manque-de-monde'
      ? `${rayon}, ${plageTexte} : il manque du monde`
      : nature === 'competence-critique'
        ? `${rayon}, ${plageTexte} : personne pour « ${competence ?? ''} » — poste intenable`
        : nature === 'binome-incomplet'
          ? `${rayon}, ${plageTexte} : « ${competence ?? ''} » tenue par quelqu’un en formation, sans accompagnant`
          : `${rayon}, ${plageTexte} : personne d’autonome en « ${competence ?? ''} »`

  return {
    id: `${besoin.rayonId}|${besoin.date}|${nature}|${competence ?? ''}|${plage.debut}`,
    rayonId: besoin.rayonId,
    jour: besoin.date,
    nature,
    debutMinutes,
    finMinutes,
    ...(competence === undefined ? {} : { competence }),
    libelle,
    solutions: chercherDesSolutions(
      entrees,
      besoin,
      { debutMinutes, finMinutes },
      nature,
      competence,
      duJour,
    ),
  }
}

function chercherDesSolutions(
  entrees: EntreesConflits,
  besoin: BesoinJour,
  plage: { debutMinutes: number; finMinutes: number },
  nature: NatureConflit,
  competence: string | undefined,
  duJour: readonly Vacation[],
): Solution[] {
  const solutions: Solution[] = []
  const jour = besoin.date
  const debut = enTexte(plage.debutMinutes)
  /** Un prêt de moins de trois heures ne vaut pas le déplacement. */
  const minutes = Math.max(plage.finMinutes - plage.debutMinutes, 3 * 60)
  const finProposee = enTexte(Math.min(plage.debutMinutes + minutes, 1439))

  const niveauRequis = competence === undefined ? 0 : 2
  const convient = (collaborateur: Collaborateur): boolean =>
    competence === undefined ||
    (collaborateur.competences[competence] ?? 0) >= (nature === 'binome-incomplet' ? 3 : niveauRequis)

  // 1. Preter quelqu'un d'un autre rayon.
  for (const collaborateur of [...entrees.collaborateurs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (collaborateur.rayonPrincipal === besoin.rayonId) continue
    if (!convient(collaborateur)) continue
    if (!estLibre(collaborateur, jour, entrees.vacations, entrees.absences)) continue

    solutions.push({
      nature: 'pret',
      cout: COUTS.pret,
      libelle: `Prêter ${nomAffiche(collaborateur)} depuis ${entrees.nomDuRayon(collaborateur.rayonPrincipal)}`,
      detail:
        `${nomAffiche(collaborateur)} est libre le ${jourEnTexte(jour)}` +
        (competence === undefined ? '.' : ` et tient « ${competence} ».`),
      collaborateurId: collaborateur.id,
      debut,
      fin: finProposee,
    })
  }

  // 2. Decaler un poste deja present dans le rayon.
  for (const vacation of [...duJour].sort((a, b) => a.id.localeCompare(b.id))) {
    const collaborateur = entrees.collaborateurs.find((c) => c.id === vacation.collaborateurId)
    if (collaborateur === undefined || !convient(collaborateur)) continue

    for (const decalage of [-30, -15, 15, 30]) {
      const nouveauDebut = enMinutes(vacation.debut) + decalage
      const nouvelleFin = enMinutes(vacation.fin) + decalage
      // Le decalage doit faire entrer la vacation dans la plage decouverte.
      const couvreMieux =
        nouveauDebut <= plage.debutMinutes && nouvelleFin >= plage.finMinutes &&
        !(enMinutes(vacation.debut) <= plage.debutMinutes && enMinutes(vacation.fin) >= plage.finMinutes)
      if (!couvreMieux) continue

      solutions.push({
        nature: 'decalage',
        cout: COUTS.decalage,
        libelle: `Décaler ${nomAffiche(collaborateur)} de ${decalage > 0 ? '+' : '−'}${Math.abs(decalage)} min`,
        detail: `Son poste passerait de ${vacation.debut}–${vacation.fin} à ${enTexte(nouveauDebut)}–${enTexte(nouvelleFin)}.`,
        collaborateurId: collaborateur.id,
        vacationId: vacation.id,
        decalageMinutes: decalage,
      })
      break
    }
  }

  // 3. Heures complementaires : un temps partiel qui a de la marge.
  for (const collaborateur of [...entrees.collaborateurs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (collaborateur.tempsPlein) continue
    if (!convient(collaborateur)) continue
    if (!estLibre(collaborateur, jour, entrees.vacations, entrees.absences)) continue

    const prevues = heuresDeLaSemaine(collaborateur.id, entrees.vacations)
    const marge = collaborateur.heuresHebdomadaires * 1.1 - prevues
    if (marge < 3) continue

    solutions.push({
      nature: 'heures-complementaires',
      cout: COUTS['heures-complementaires'],
      libelle: `Proposer des heures complémentaires à ${nomAffiche(collaborateur)}`,
      detail:
        `Elle ou il a ${heuresEnTexte(prevues)} de prévues pour ${collaborateur.heuresHebdomadaires} h ` +
        `au contrat : il reste ${heuresEnTexte(marge)} avant le plafond légal.`,
      collaborateurId: collaborateur.id,
      debut,
      fin: finProposee,
    })
  }

  // 4. Renfort exterieur.
  for (const renfort of [...entrees.renforts].sort((a, b) => a.id.localeCompare(b.id))) {
    if (competence !== undefined && (renfort.competences[competence] ?? 0) < 2) continue
    solutions.push({
      nature: 'renfort-exterieur',
      cout: COUTS['renfort-exterieur'],
      libelle: `Appeler ${renfort.prenom} ${renfort.initiale} (${renfort.origine})`,
      detail: `Renfort extérieur, à appeler pour ${debut}–${finProposee}.`,
      renfortId: renfort.id,
      debut,
      fin: finProposee,
    })
  }

  // 5. Former quelqu'un : la seule solution qui regle le probleme pour de bon.
  if (competence !== undefined) {
    const aFormer = [...entrees.collaborateurs]
      .filter((collaborateur) => collaborateur.rayonPrincipal === besoin.rayonId)
      .filter((collaborateur) => (collaborateur.competences[competence] ?? 0) < 2)
      .sort(
        (a, b) =>
          (b.competences[competence] ?? 0) - (a.competences[competence] ?? 0) ||
          a.id.localeCompare(b.id),
      )[0]

    if (aFormer !== undefined) {
      solutions.push({
        nature: 'formation',
        cout: COUTS.formation,
        libelle: `Former ${nomAffiche(aFormer)} à « ${competence} »`,
        detail:
          `Le problème reviendra chaque semaine tant que « ${competence} » ne sera tenue ` +
          `que par trop peu de monde dans ce rayon.`,
        collaborateurId: aFormer.id,
      })
    }
  }

  return solutions.sort((a, b) => a.cout - b.cout || a.libelle.localeCompare(b.libelle, 'fr'))
}
