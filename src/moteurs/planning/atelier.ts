import { estAbsent, type Absence } from '../../domaine/absence'
import { jourDeLaSemaine, semaineDe } from '../../domaine/calendrier'
import {
  enFormation,
  estDisponible,
  estJourDEcole,
  rangDansRayon,
  type Collaborateur,
  type RangDansRayon,
} from '../../domaine/collaborateur'
import { TRANCHE_MINUTES, duree } from '../../domaine/temps'
import type { BesoinJour } from '../besoin'
import { dureeTravailEffectif, type Vacation } from '../regles'

/**
 * Travail rayon par rayon : ce qu'il faut, ce qu'on a, et qui peut venir.
 *
 * Module pur. Les heures disponibles d'une personne sont celles de sa
 * semaine (contrat, conges et ecole deduits a raison d'un sixieme par jour)
 * moins ce qu'elle fait deja dans les AUTRES rayons.
 */

export interface PersonneDuRayon {
  readonly collaborateur: Collaborateur
  readonly rang: RangDansRayon
  /** Heures a faire cette semaine. */
  readonly visees: number
  /** Heures deja placees dans ce rayon. */
  readonly ici: number
  /** Heures deja placees dans les autres rayons. */
  readonly ailleurs: number
  /** Heures qui restent a placer (jamais negatif). */
  readonly restantes: number
  /** Jours ou elle ne peut pas venir : conge, absence, ecole, repos fixe. */
  readonly joursImpossibles: readonly string[]
}

export interface BilanDuRayon {
  /** Heures de presence exigees par le minimum de la grille. */
  readonly heuresMinimum: number
  /** Heures de presence souhaitees par la cible. */
  readonly heuresCible: number
  /** Heures deja planifiees dans ce rayon. */
  readonly heuresPlanifiees: number
  /** Heures que titulaires et renforts peuvent encore donner a ce rayon (ici compris). */
  readonly heuresDisponibles: number
  /** Disponibles moins cible : positif = assez de monde sur le papier. */
  readonly solde: number
  readonly personnes: readonly PersonneDuRayon[]
}

export interface EntreesBilan {
  readonly rayonId: string
  readonly semaine: string
  readonly besoins: readonly BesoinJour[]
  readonly vacations: readonly Vacation[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly absences: readonly Absence[]
  readonly pausesPayees: boolean
  /** Jours ouvrables par semaine (decompte des conges). */
  readonly joursOuvrables: number
}

const ORDRE_DES_RANGS: Readonly<Record<RangDansRayon, number>> = {
  principal: 0,
  secondaire: 1,
  depannage: 2,
}

export function bilanDuRayon(entrees: EntreesBilan): BilanDuRayon {
  const jours = semaineDe(entrees.semaine)
  const heuresDe = (vacations: readonly Vacation[]) =>
    vacations.reduce(
      (somme, v) =>
        somme + (entrees.pausesPayees ? duree(v.debut, v.fin) : dureeTravailEffectif(v)),
      0,
    ) / 60

  const duRayon = entrees.besoins.filter((b) => b.rayonId === entrees.rayonId)
  const quart = TRANCHE_MINUTES / 60
  const heuresMinimum = duRayon.reduce(
    (s, b) => s + b.tranches.reduce((t, tranche) => t + tranche.personnes * quart, 0),
    0,
  )
  const heuresCible = duRayon.reduce(
    (s, b) =>
      s + b.tranches.reduce((t, tranche) => t + (tranche.cible ?? tranche.personnes) * quart, 0),
    0,
  )

  const personnes: PersonneDuRayon[] = []
  for (const collaborateur of entrees.collaborateurs.filter((c) => c.actif)) {
    const rang = rangDansRayon(collaborateur, entrees.rayonId)
    if (rang === null) continue
    const siennes = entrees.vacations.filter((v) => v.collaborateurId === collaborateur.id)
    const joursImpossibles = jours.filter(
      (jour) =>
        estAbsent(entrees.absences, collaborateur.id, jour) ||
        enFormation(collaborateur, jour) !== undefined ||
        estJourDEcole(collaborateur, jourDeLaSemaine(jour)) ||
        !estDisponible(collaborateur, jourDeLaSemaine(jour)),
    )
    const nonTravailles = jours.filter(
      (jour) =>
        estAbsent(entrees.absences, collaborateur.id, jour) ||
        enFormation(collaborateur, jour) !== undefined ||
        estJourDEcole(collaborateur, jourDeLaSemaine(jour)),
    ).length
    const visees =
      (collaborateur.heuresHebdomadaires *
        Math.max(0, entrees.joursOuvrables - Math.min(nonTravailles, entrees.joursOuvrables))) /
      entrees.joursOuvrables
    const ici = heuresDe(siennes.filter((v) => v.rayonId === entrees.rayonId))
    const ailleurs = heuresDe(siennes.filter((v) => v.rayonId !== entrees.rayonId))
    personnes.push({
      collaborateur,
      rang,
      visees,
      ici,
      ailleurs,
      restantes: Math.max(0, visees - ici - ailleurs),
      joursImpossibles,
    })
  }
  personnes.sort(
    (a, b) =>
      ORDRE_DES_RANGS[a.rang] - ORDRE_DES_RANGS[b.rang] ||
      a.collaborateur.prenom.localeCompare(b.collaborateur.prenom, 'fr'),
  )

  // Disponibles pour ce rayon : ce que titulaires et renforts y font deja, plus
  // ce qui leur reste. Le depannage n'est pas compte : il ne se prevoit pas.
  const heuresDisponibles = personnes
    .filter((p) => p.rang !== 'depannage')
    .reduce((s, p) => s + p.ici + p.restantes, 0)

  return {
    heuresMinimum,
    heuresCible,
    heuresPlanifiees: heuresDe(entrees.vacations.filter((v) => v.rayonId === entrees.rayonId)),
    heuresDisponibles,
    solde: heuresDisponibles - heuresCible,
    personnes,
  }
}

/**
 * Prepare la generation d'un seul rayon : les postes des AUTRES rayons sont
 * transmis comme verrouilles (ils ne bougent pas, mais comptent dans les
 * heures et les regles de chacun), ceux du rayon sont recalcules, sauf les
 * cases verrouillees par l'utilisateur.
 */
export function postesFigesPourUnRayon(
  rayonId: string,
  vacations: readonly Vacation[],
  casesVerrouillees: ReadonlySet<string>,
): Vacation[] {
  return vacations.filter(
    (v) => v.rayonId !== rayonId || casesVerrouillees.has(`${v.collaborateurId}|${v.jour}`),
  )
}

/**
 * Remet ensemble le planning apres la generation d'un rayon : tout ce qui
 * n'etait pas dans ce rayon reste tel quel ; le rayon prend les postes
 * calcules (cases verrouillees comprises).
 */
export function fusionnerLeRayon(
  rayonId: string,
  avant: readonly Vacation[],
  calculees: readonly Vacation[],
  casesVerrouillees: ReadonlySet<string>,
): Vacation[] {
  const gardees = avant.filter(
    (v) => v.rayonId !== rayonId || casesVerrouillees.has(`${v.collaborateurId}|${v.jour}`),
  )
  const ids = new Set(gardees.map((v) => v.id))
  return [
    ...gardees,
    ...calculees.filter((v) => v.rayonId === rayonId && !ids.has(v.id)),
  ]
}
