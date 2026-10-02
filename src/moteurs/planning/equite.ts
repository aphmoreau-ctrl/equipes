import { ajouterJours, jourDeLaSemaine, lundiDeLaSemaine, semaineDe } from '../../domaine/calendrier'
import { enMinutes } from '../../domaine/temps'
import type { Collaborateur } from '../../domaine/collaborateur'
import type { Vacation } from '../regles'

/**
 * Equite des sujetions, mesuree sur les quatre dernieres semaines (§9.8).
 *
 * Les compteurs de la fiche comptent depuis toujours : quelqu'un arrive il y a
 * dix ans en aura mecaniquement plus que quelqu'un arrive l'an dernier, sans
 * qu'aucune injustice recente n'ait eu lieu. Ce qui se discute dans un service,
 * c'est « ca fait trois samedis d'affilee » — donc les semaines RECENTES.
 *
 * Quatre semaines : assez pour lisser un alea, assez court pour qu'un
 * desequilibre se corrige avant d'etre vecu comme une habitude.
 */

export const SEMAINES_OBSERVEES = 4

/** Avant cette heure, on « ouvre » ; apres celle-la, on « ferme ». */
export const HEURE_OUVERTURE = '07:00'
export const HEURE_FERMETURE = '19:00'

export interface Sujetions {
  readonly samedis: number
  readonly dimanches: number
  readonly ouvertures: number
  readonly fermetures: number
}

export interface EquiteDUnePersonne extends Sujetions {
  readonly collaborateurId: string
  /** Total pondere, pour comparer d'un coup d'oeil. */
  readonly total: number
  /** Ecart au total moyen de l'equipe. Positif = plus que sa part. */
  readonly ecart: number
}

const VIDE: Sujetions = { samedis: 0, dimanches: 0, ouvertures: 0, fermetures: 0 }

/** Un dimanche pese plus qu'un samedi, une fermeture plus qu'une ouverture. */
function pondere(sujetions: Sujetions): number {
  return (
    sujetions.samedis +
    sujetions.dimanches * 1.5 +
    sujetions.ouvertures * 0.5 +
    sujetions.fermetures * 0.75
  )
}

function ajouter(sujetions: Sujetions, vacation: Vacation): Sujetions {
  const jour = jourDeLaSemaine(vacation.jour)
  return {
    samedis: sujetions.samedis + (jour === 6 ? 1 : 0),
    dimanches: sujetions.dimanches + (jour === 7 ? 1 : 0),
    ouvertures: sujetions.ouvertures + (enMinutes(vacation.debut) < enMinutes(HEURE_OUVERTURE) ? 1 : 0),
    fermetures: sujetions.fermetures + (enMinutes(vacation.fin) > enMinutes(HEURE_FERMETURE) ? 1 : 0),
  }
}

/** Les semaines observees : celle que l'on construit et les trois precedentes. */
export function semainesObservees(semaine: string, nombre = SEMAINES_OBSERVEES): string[] {
  const lundi = lundiDeLaSemaine(semaine)
  return Array.from({ length: nombre }, (_, recul) => ajouterJours(lundi, -7 * recul)).sort()
}

/**
 * Repartition des sujetions sur les semaines observees.
 *
 * On ne regarde que les vacations qui tombent dans ces semaines : le reste du
 * passe ne doit pas peser sur le planning de la semaine prochaine.
 */
export function mesurerLEquite(
  semaine: string,
  vacations: readonly Vacation[],
  collaborateurs: readonly Collaborateur[],
  nombreDeSemaines = SEMAINES_OBSERVEES,
): EquiteDUnePersonne[] {
  const jours = new Set(semainesObservees(semaine, nombreDeSemaines).flatMap((lundi) => semaineDe(lundi)))

  const parPersonne = new Map<string, Sujetions>()
  for (const collaborateur of collaborateurs) {
    if (collaborateur.actif) parPersonne.set(collaborateur.id, VIDE)
  }

  for (const vacation of vacations) {
    if (!jours.has(vacation.jour)) continue
    const deja = parPersonne.get(vacation.collaborateurId)
    if (deja === undefined) continue
    parPersonne.set(vacation.collaborateurId, ajouter(deja, vacation))
  }

  const totaux = [...parPersonne.values()].map(pondere)
  const moyenne = totaux.length === 0 ? 0 : totaux.reduce((s, v) => s + v, 0) / totaux.length

  return [...parPersonne.entries()]
    .map(([collaborateurId, sujetions]) => ({
      collaborateurId,
      ...sujetions,
      total: pondere(sujetions),
      ecart: pondere(sujetions) - moyenne,
    }))
    .sort((a, b) => b.ecart - a.ecart || a.collaborateurId.localeCompare(b.collaborateurId))
}

/** Personnes qui portent nettement plus que leur part : a soulager en priorite. */
export function aSoulager(equite: readonly EquiteDUnePersonne[], seuil = 1.5): EquiteDUnePersonne[] {
  return equite.filter((personne) => personne.ecart >= seuil)
}
