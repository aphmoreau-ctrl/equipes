import { jourDeLaSemaine, lundiDeLaSemaine } from '../../domaine/calendrier'
import { MINUTES_PAR_JOUR, chevauchement, duree, enMinutes, type Minutes } from '../../domaine/temps'
import type { ParametresRegles, Vacation } from './types'
import { estMineur, type Collaborateur, type TrancheAge } from '../../domaine/collaborateur'

/**
 * Reperes de temps communs a toutes les regles : instants absolus, semaines,
 * jours ouvres, minutes de nuit.
 *
 * Module pur.
 */

const REFERENCE = Date.UTC(2020, 0, 1)

/** Minutes ecoulees depuis le 1er janvier 2020 : permet de comparer deux instants. */
export function instant(date: string, heure: string): number {
  const jours = Math.round((new Date(`${date}T00:00:00Z`).getTime() - REFERENCE) / 86_400_000)
  return jours * MINUTES_PAR_JOUR + enMinutes(heure)
}

export function debutDe(vacation: Vacation): number {
  return instant(vacation.jour, vacation.debut)
}

export function finDe(vacation: Vacation): number {
  return debutDe(vacation) + duree(vacation.debut, vacation.fin)
}

/** Vacations d'une personne, triees dans l'ordre chronologique. */
export function vacationsDe(
  vacations: readonly Vacation[],
  collaborateurId: string,
): Vacation[] {
  return vacations
    .filter((vacation) => vacation.collaborateurId === collaborateurId)
    .sort((a, b) => debutDe(a) - debutDe(b) || a.id.localeCompare(b.id))
}

/** Identifiants des collaborateurs presents dans un ensemble de vacations. */
export function collaborateursConcernes(vacations: readonly Vacation[]): string[] {
  return [...new Set(vacations.map((vacation) => vacation.collaborateurId))].sort()
}

/** Regroupe les vacations par semaine, reperee par son lundi. */
export function grouperParSemaine(vacations: readonly Vacation[]): Map<string, Vacation[]> {
  const semaines = new Map<string, Vacation[]>()
  for (const vacation of vacations) {
    const lundi = lundiDeLaSemaine(vacation.jour)
    const existantes = semaines.get(lundi)
    if (existantes === undefined) semaines.set(lundi, [vacation])
    else existantes.push(vacation)
  }
  return semaines
}

/**
 * Jours ouvres entre deux dates, bornes exclues pour la premiere.
 * Le dimanche n'est pas un jour ouvre ; le samedi l'est.
 */
export function joursOuvresEntre(depuis: string, jusqua: string): number {
  const debut = new Date(`${depuis}T00:00:00Z`)
  const fin = new Date(`${jusqua}T00:00:00Z`)
  if (fin.getTime() <= debut.getTime()) return 0

  let compte = 0
  const curseur = new Date(debut.getTime())
  while (curseur.getTime() < fin.getTime()) {
    curseur.setUTCDate(curseur.getUTCDate() + 1)
    const jour = curseur.getUTCDay()
    if (jour !== 0) compte += 1
  }
  return compte
}

/**
 * Minutes de nuit d'une vacation, au sens de la convention 2216.
 * La nuit passe minuit : on la decoupe en deux morceaux pour la comparer.
 */
export function minutesDeNuit(
  vacation: Vacation,
  nuitDebut: string,
  nuitFin: string,
): Minutes {
  const debut = enMinutes(vacation.debut)
  const fin = debut + duree(vacation.debut, vacation.fin)
  const depart = enMinutes(nuitDebut)
  const arrivee = enMinutes(nuitFin)

  // La plage de nuit, repetee sur trois journees, pour couvrir tous les cas.
  let total = 0
  for (const decalage of [-MINUTES_PAR_JOUR, 0, MINUTES_PAR_JOUR]) {
    if (depart < arrivee) {
      total += chevauchement(debut, fin, depart + decalage, arrivee + decalage)
    } else {
      // De 21:00 a 05:00 : deux morceaux.
      total += chevauchement(debut, fin, depart + decalage, MINUTES_PAR_JOUR + decalage)
      total += chevauchement(debut, fin, decalage, arrivee + decalage)
    }
  }
  return total
}

/** Minutes travaillees hors de la plage autorisee aux mineurs. */
export function minutesInterditesAuxJeunes(
  vacation: Vacation,
  parametres: ParametresRegles,
  trancheAge: TrancheAge = '16-17',
): Minutes {
  // Avant 16 ans le travail s'arrete deux heures plus tot.
  return trancheAge === 'moins-de-16'
    ? minutesDeNuit(vacation, parametres.moinsDe16NuitDebut, parametres.moinsDe16NuitFin)
    : minutesDeNuit(vacation, parametres.jeuneNuitDebut, parametres.jeuneNuitFin)
}

/** Moins de 18 ans ? Une seule facon de le demander, pour toutes les regles. */
export function estMineurParmi(
  collaborateurs: readonly Collaborateur[],
  collaborateurId: string,
): boolean {
  const collaborateur = collaborateurs.find((c) => c.id === collaborateurId)
  return collaborateur !== undefined && estMineur(collaborateur)
}

/** Moins de 16 ans : protection de nuit renforcee (pas de travail apres 20 h). */
export function estDeMoinsDe16Ans(
  collaborateurs: readonly Collaborateur[],
  collaborateurId: string,
): boolean {
  return (
    collaborateurs.find((c) => c.id === collaborateurId)?.trancheAge === 'moins-de-16'
  )
}

/** Vrai si la vacation tombe un samedi. */
export function estUnSamedi(vacation: Vacation): boolean {
  return jourDeLaSemaine(vacation.jour) === 6
}

/** Vrai si la vacation tombe un dimanche. */
export function estUnDimanche(vacation: Vacation): boolean {
  return jourDeLaSemaine(vacation.jour) === 7
}
