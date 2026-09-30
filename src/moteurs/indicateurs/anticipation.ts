import { estAbsent, type Absence } from '../../domaine/absence'
import { ajouterJours, estAvant, semaineDe } from '../../domaine/calendrier'
import type { Collaborateur } from '../../domaine/collaborateur'
import type { Rayon } from '../../domaine/magasin'
import type { BesoinJour } from '../besoin'

/**
 * Anticipation sur douze semaines (cahier des charges §9.5).
 *
 * Compare, rayon par rayon et semaine par semaine, la CAPACITE de l'equipe
 * (heures des contrats, moins les conges et absences connus) au BESOIN
 * calcule. Le but est de voir venir les manques avant qu'ils ne soient la.
 *
 * Module pur.
 */

/** Jours ouvrables d'une semaine : du lundi au samedi. */
const JOURS_OUVRABLES_PAR_SEMAINE = 6

export interface SemaineAnticipee {
  readonly semaine: string
  readonly rayonId: string
  readonly besoinHeures: number
  readonly capaciteHeures: number
  /** Positif : il reste de la marge. Negatif : il manquera des heures. */
  readonly ecartHeures: number
  /** Personnes absentes tout ou partie de la semaine. */
  readonly absents: number
}

/**
 * Capacite d'une personne sur une semaine, en heures.
 * Elle tombe a zero avant son entree et apres la fin de son contrat, et
 * diminue a proportion des jours d'absence connus.
 */
export function capaciteDeLaPersonne(
  collaborateur: Collaborateur,
  semaine: string,
  absences: readonly Absence[],
): number {
  if (!collaborateur.actif) return 0

  const jours = semaineDe(semaine)
  const dernierJour = jours[6] ?? semaine

  if (estAvant(dernierJour, collaborateur.dateEntree)) return 0
  if (collaborateur.finContrat !== null && estAvant(collaborateur.finContrat, semaine)) return 0

  const joursAbsents = jours
    .slice(0, JOURS_OUVRABLES_PAR_SEMAINE)
    .filter((jour) => estAbsent(absences, collaborateur.id, jour)).length

  const part = Math.max(0, 1 - joursAbsents / JOURS_OUVRABLES_PAR_SEMAINE)
  return collaborateur.heuresHebdomadaires * part
}

/**
 * Anticipe sur un nombre de semaines donne, a partir d'une semaine de depart.
 * `besoinDe` doit rendre le besoin d'un rayon pour une date.
 */
export function anticiper(
  semaineDeDepart: string,
  nombreDeSemaines: number,
  rayons: readonly Rayon[],
  collaborateurs: readonly Collaborateur[],
  absences: readonly Absence[],
  besoinDe: (date: string, rayonId: string) => BesoinJour | null,
): SemaineAnticipee[] {
  const resultat: SemaineAnticipee[] = []

  for (let index = 0; index < nombreDeSemaines; index += 1) {
    const semaine = ajouterJours(semaineDeDepart, index * 7)
    const jours = semaineDe(semaine)

    for (const rayon of rayons) {
      if (!rayon.actif) continue

      let besoinHeures = 0
      for (const jour of jours) {
        besoinHeures += besoinDe(jour, rayon.id)?.heuresPresence ?? 0
      }

      const duRayon = collaborateurs.filter(
        (collaborateur) => collaborateur.actif && collaborateur.rayonPrincipal === rayon.id,
      )
      const capaciteHeures = duRayon.reduce(
        (somme, collaborateur) => somme + capaciteDeLaPersonne(collaborateur, semaine, absences),
        0,
      )
      const absents = duRayon.filter((collaborateur) =>
        jours.some((jour) => estAbsent(absences, collaborateur.id, jour)),
      ).length

      resultat.push({
        semaine,
        rayonId: rayon.id,
        besoinHeures,
        capaciteHeures,
        ecartHeures: capaciteHeures - besoinHeures,
        absents,
      })
    }
  }

  return resultat
}

export interface AlerteAnticipation {
  readonly semaine: string
  readonly rayonId: string
  readonly manqueHeures: number
  readonly message: string
}

/**
 * Semaines ou il manquera des heures, au-dela d'un seuil de tolerance.
 * Le message propose les leviers habituels, comme le demande le §9.5.
 */
export function alertesDAnticipation(
  semaines: readonly SemaineAnticipee[],
  rayons: readonly Rayon[],
  seuilHeures = 8,
): AlerteAnticipation[] {
  return semaines
    .filter((semaine) => semaine.ecartHeures < -seuilHeures)
    .map((semaine) => {
      const nomDuRayon = rayons.find((rayon) => rayon.id === semaine.rayonId)?.nom ?? semaine.rayonId
      const manque = Math.round(-semaine.ecartHeures)
      return {
        semaine: semaine.semaine,
        rayonId: semaine.rayonId,
        manqueHeures: manque,
        message:
          `${nomDuRayon}, semaine du ${semaine.semaine} : il manquera environ ${manque} h ` +
          `(besoin ${Math.round(semaine.besoinHeures)} h, capacité ${Math.round(semaine.capaciteHeures)} h). ` +
          `Prévoir un renfort, décaler des congés, ou former quelqu’un d’ici là.`,
      }
    })
    .sort((a, b) => a.semaine.localeCompare(b.semaine) || b.manqueHeures - a.manqueHeures)
}
