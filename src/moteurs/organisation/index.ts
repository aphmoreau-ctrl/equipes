import { JOURS_SEMAINE, type JourSemaine } from '../../domaine/calendrier'
import { estDateValide } from '../../domaine/calendrier'
import {
  aLaFonction,
  nomAffiche,
  rayonsPrincipaux,
  type Collaborateur,
} from '../../domaine/collaborateur'
import type { Magasin } from '../../domaine/magasin'
import {
  jourDeRemplacement,
  LIBELLES_FONCTION,
  type OrganisationPlanning,
  type TachePlanifiee,
} from '../../domaine/organisation'
import type { ConfigurationRayon } from '../besoin'

/**
 * Points encore A DEFINIR, provisoires ou A VERIFIER.
 *
 * Module pur. Il parcourt les reglages et dit, en francais, ce qui manque.
 * Rien n'est invente pour combler un manque : tant qu'un point figure ici,
 * le planning fait sans, et le dit.
 */

export type NaturePoint = 'a-definir' | 'provisoire' | 'a-verifier'

export const LIBELLES_NATURE_POINT: Readonly<Record<NaturePoint, string>> = {
  'a-definir': 'À définir',
  provisoire: 'Provisoire',
  'a-verifier': 'À vérifier (RH)',
}

export type Rubrique =
  | 'Effectifs'
  | 'Affluence'
  | 'Horaires'
  | 'Tâches'
  | 'Rôtisserie'
  | 'Rotations'
  | 'Équipe'
  | 'Règles internes'
  | 'Convention et RH'

export interface PointADefinir {
  readonly id: string
  readonly nature: NaturePoint
  readonly rubrique: Rubrique
  readonly libelle: string
}

export interface EntreesPoints {
  readonly magasin: Magasin
  readonly configurations: readonly ConfigurationRayon[]
  readonly organisation: OrganisationPlanning
  readonly collaborateurs: readonly Collaborateur[]
}

const NOMS_JOURS: Readonly<Record<JourSemaine, string>> = {
  1: 'lundi',
  2: 'mardi',
  3: 'mercredi',
  4: 'jeudi',
  5: 'vendredi',
  6: 'samedi',
  7: 'dimanche',
}

/** « lundi », « lundi et mardi », « lundi, mardi et jeudi », « lundi au jeudi ». */
export function joursEnTexte(jours: readonly JourSemaine[]): string {
  const tries = [...new Set(jours)].sort((a, b) => a - b)
  if (tries.length === 0) return ''
  const suivis = tries.every((jour, index) => index === 0 || jour === (tries[index - 1] as number) + 1)
  if (tries.length >= 3 && suivis) {
    return `${NOMS_JOURS[tries[0] as JourSemaine]} au ${NOMS_JOURS[tries[tries.length - 1] as JourSemaine]}`
  }
  const noms = tries.map((jour) => NOMS_JOURS[jour])
  if (noms.length === 1) return noms[0] as string
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1] as string}`
}

/** « a », « a et b », « a, b et c ». */
function liste(elements: readonly string[]): string {
  if (elements.length <= 1) return elements[0] ?? ''
  return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1] as string}`
}

function pointsDesEffectifs(entrees: EntreesPoints): PointADefinir[] {
  const points: PointADefinir[] = []
  for (const rayon of entrees.magasin.rayons.filter((r) => r.actif)) {
    const grille = entrees.configurations.find((c) => c.rayonId === rayon.id)?.grilleEffectifs
    if (grille === undefined) continue

    const joursVides = JOURS_SEMAINE.filter((jour) => grille.jours[jour] === null)
    const joursIncomplets = JOURS_SEMAINE.filter((jour) =>
      (grille.jours[jour] ?? []).some((c) => c.minimum === null || c.cible === null),
    )
    const joursProvisoires = JOURS_SEMAINE.filter((jour) =>
      (grille.jours[jour] ?? []).some((c) => c.provisoire === true),
    )

    if (joursVides.length > 0) {
      const empruntes = joursVides.filter((jour) => jourDeRemplacement(grille, jour) !== null)
      points.push({
        id: `effectifs-jours-${rayon.id}`,
        nature: 'a-definir',
        rubrique: 'Effectifs',
        libelle:
          `${rayon.nom} : effectifs du ${joursEnTexte(joursVides)}` +
          (empruntes.length > 0
            ? ` (en attendant : ${joursEnTexte(empruntes)} = cible du jeudi).`
            : '.'),
      })
    }
    if (joursIncomplets.length > 0) {
      points.push({
        id: `effectifs-creneaux-${rayon.id}`,
        nature: 'a-definir',
        rubrique: 'Effectifs',
        libelle: `${rayon.nom} : minimum et cible du ${joursEnTexte(joursIncomplets)}.`,
      })
    }
    if (joursProvisoires.length > 0) {
      points.push({
        id: `effectifs-provisoires-${rayon.id}`,
        nature: 'provisoire',
        rubrique: 'Effectifs',
        libelle: `${rayon.nom} : effectifs du ${joursEnTexte(joursProvisoires)} à affiner.`,
      })
    }
  }
  return points
}

function pointsDesHoraires(entrees: EntreesPoints): PointADefinir[] {
  return entrees.magasin.rayons
    .filter((rayon) => rayon.actif && (rayon.horairesAConfirmer ?? []).length > 0)
    .map((rayon) => ({
      id: `horaires-${rayon.id}`,
      nature: 'a-definir' as const,
      rubrique: 'Horaires' as const,
      libelle: `${rayon.nom} : heure de fin du ${joursEnTexte(rayon.horairesAConfirmer ?? [])} à confirmer.`,
    }))
}

function pointsDeLAffluence(organisation: OrganisationPlanning): PointADefinir[] {
  const jours = JOURS_SEMAINE.filter((jour) => organisation.plagesAffluence[jour] === null)
  if (jours.length === 0) return []
  return [
    {
      id: 'affluence',
      nature: 'a-definir',
      rubrique: 'Affluence',
      libelle: `Heures d’affluence du ${joursEnTexte(jours)}.`,
    },
  ]
}

/** Ce qui manque a une tache, en mots. */
function manquesDeLaTache(tache: TachePlanifiee): string[] {
  const manques: string[] = []
  const confieeNommement = tache.competence === null && tache.fonction === null
  if (
    tache.personnesDesignees === null ||
    (confieeNommement && tache.personnesDesignees.length === 0)
  ) {
    manques.push('qui la fait')
  }
  if (tache.jours === null) manques.push('les jours')
  if (tache.moment.type === 'a-definir') manques.push('l’heure')
  if (tache.dureeMinutes === null) manques.push('la durée')
  return manques
}

function pointsDesTaches(entrees: EntreesPoints): PointADefinir[] {
  const points: PointADefinir[] = []
  const nomDuRayon = (id: string | null) =>
    entrees.magasin.rayons.find((rayon) => rayon.id === id)?.nom ?? ''

  // Les taches de meme nom et aux memes manques se regroupent (« Remballe »).
  const groupes = new Map<string, { tache: TachePlanifiee; rayons: string[]; manques: string[] }>()
  for (const tache of entrees.organisation.taches.filter((t) => t.actif)) {
    const manques = manquesDeLaTache(tache)
    if (manques.length === 0) continue
    const cle = `${tache.nom}|${manques.join(',')}`
    const groupe = groupes.get(cle)
    if (groupe === undefined) {
      groupes.set(cle, { tache, rayons: [nomDuRayon(tache.rayonId)], manques })
    } else {
      groupe.rayons.push(nomDuRayon(tache.rayonId))
    }
  }
  for (const { tache, rayons, manques } of groupes.values()) {
    const precision = rayons.length > 1 ? ` (${rayons.length} rayons)` : ''
    points.push({
      id: `tache-${tache.id}`,
      nature: 'a-definir',
      rubrique: 'Tâches',
      libelle: `${tache.nom}${precision} : ${liste(manques)}.`,
    })
  }

  // Reunions : quelqu'un de la bonne fonction, et chaque rayon represente.
  const equipe = entrees.collaborateurs.filter((c) => c.actif)
  for (const tache of entrees.organisation.taches.filter((t) => t.actif && t.fonction !== null)) {
    const fonction = tache.fonction
    if (fonction === null) continue
    const titulaires = equipe.filter((c) => aLaFonction(c, fonction))
    if (titulaires.length === 0) {
      points.push({
        id: `reunion-personne-${tache.id}`,
        nature: 'a-definir',
        rubrique: 'Tâches',
        libelle: `${tache.nom} : aucune personne n’a la fonction « ${LIBELLES_FONCTION[fonction]} ».`,
      })
      continue
    }
    const sansRepresentant = tache.rayonsRepresentes.filter(
      (rayonId) => !titulaires.some((c) => rayonsPrincipaux(c).includes(rayonId)),
    )
    if (sansRepresentant.length > 0) {
      points.push({
        id: `reunion-rayons-${tache.id}`,
        nature: 'a-definir',
        rubrique: 'Tâches',
        libelle:
          `${tache.nom} : ${LIBELLES_FONCTION[fonction].toLowerCase()} à désigner pour ` +
          `${liste(sansRepresentant.map(nomDuRayon))}.`,
      })
    }
  }
  return points
}

function pointsDeLaRotisserie(organisation: OrganisationPlanning): PointADefinir[] {
  const rotisserie = organisation.rotisserie
  if (rotisserie === null || !rotisserie.actif || rotisserie.dureeCuissonMinutes !== null) return []
  return [
    {
      id: 'rotisserie-duree',
      nature: 'a-definir',
      rubrique: 'Rôtisserie',
      libelle: 'Rôtisserie : durée d’une cuisson.',
    },
  ]
}

function pointsDesRotations(organisation: OrganisationPlanning): PointADefinir[] {
  return organisation.rotations
    .filter((rotation) => rotation.personnes.length < 2)
    .map((rotation) => ({
      id: `rotation-${rotation.id}`,
      nature: 'a-definir' as const,
      rubrique: 'Rotations' as const,
      libelle: `${rotation.nom} : désignez au moins deux personnes qui tournent.`,
    }))
}

function pointsDeLEquipe(collaborateurs: readonly Collaborateur[]): PointADefinir[] {
  const points: PointADefinir[] = []
  const equipe = collaborateurs.filter((c) => c.actif)

  // L'ecole se saisit en jours fixes OU en periodes datees : l'un suffit.
  for (const apprenti of equipe.filter(
    (c) =>
      c.contrat === 'apprenti' && c.joursEcole === undefined && c.periodesFormation.length === 0,
  )) {
    points.push({
      id: `ecole-${apprenti.id}`,
      nature: 'a-definir',
      rubrique: 'Équipe',
      libelle: `${nomAffiche(apprenti)} : jours d’école.`,
    })
  }

  const sansDate = equipe.filter((c) => !estDateValide(c.dateEntree))
  if (sansDate.length > 0) {
    points.push({
      id: 'dates-entree',
      nature: 'a-definir',
      rubrique: 'Équipe',
      libelle:
        `Date d’entrée à compléter pour ${sansDate.length} personne${sansDate.length > 1 ? 's' : ''} ` +
        `(sert aux échéances d’entretien).`,
    })
  }
  return points
}

function pointsDesReglesInternes(organisation: OrganisationPlanning): PointADefinir[] {
  if (organisation.reglesInternes.dureeMaximaleDepannageMinutes !== null) return []
  return [
    {
      id: 'depannage-duree',
      nature: 'a-definir',
      rubrique: 'Règles internes',
      libelle: 'Durée maximale d’un dépannage.',
    },
  ]
}

function pointsAVerifier(organisation: OrganisationPlanning): PointADefinir[] {
  return organisation.pointsAVerifier
    .filter((point) => !point.verifie)
    .map((point) => ({
      id: `verifier-${point.id}`,
      nature: 'a-verifier' as const,
      rubrique: 'Convention et RH' as const,
      libelle: point.libelle,
    }))
}

/** Tous les points a traiter, dans l'ordre des reglages. */
export function pointsADefinir(entrees: EntreesPoints): PointADefinir[] {
  return [
    ...pointsDesEffectifs(entrees),
    ...pointsDeLAffluence(entrees.organisation),
    ...pointsDesHoraires(entrees),
    ...pointsDesTaches(entrees),
    ...pointsDeLaRotisserie(entrees.organisation),
    ...pointsDesRotations(entrees.organisation),
    ...pointsDeLEquipe(entrees.collaborateurs),
    ...pointsDesReglesInternes(entrees.organisation),
    ...pointsAVerifier(entrees.organisation),
  ]
}
