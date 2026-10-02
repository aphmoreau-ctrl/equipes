import type { Vacation } from '../moteurs/regles'
import {
  changerEtatSuivi,
  dateDuDernier,
  suiviInitial,
  type EtatSuivi,
  type Suivi,
} from './suivi'

/**
 * Planning d'une semaine et son circuit de suivi (cahier des charges §9.6).
 *
 * Un planning couvre UNE SEMAINE et TOUT LE SERVICE : c'est l'objet qu'Arnaud
 * prepare, soumet a son patron, corrige, puis publie a l'equipe. Chaque
 * vacation porte son rayon.
 *
 * L'application ne valide rien et ne soumet rien : elle garde la trace d'un
 * circuit qu'Arnaud renseigne lui-meme.
 */

/*
 * Le circuit lui-meme vit dans « suivi.ts » : il est GENERIQUE et sert aussi
 * aux conges, puis aux recrutements. On le re-expose ici pour que les ecrans
 * du planning n'aient qu'un seul endroit ou regarder.
 */
export type { EtatSuivi, EvenementSuivi, Suivi } from './suivi'
export { EXPLICATIONS_ETAT, LIBELLES_ETAT, etatsSuivants, remarquesDuPatron } from './suivi'

export interface Planning extends Suivi {
  /** Lundi de la semaine : sert d'identifiant. */
  readonly semaine: string
  readonly vacations: readonly Vacation[]
  /**
   * Cases verrouillees par l'utilisateur : « collaborateurId|jour ».
   *
   * Une case verrouillee ne bouge jamais : « Relancer » recalcule tout le
   * reste autour d'elle. C'est ce qui permet de figer ce qu'on a decide —
   * un rendez-vous, une demande acceptee — et de laisser l'application
   * s'occuper du reste.
   */
  readonly casesVerrouillees: readonly string[]
}

export function planningVide(semaine: string): Planning {
  return { semaine, vacations: [], casesVerrouillees: [], ...suiviInitial() }
}

/** Enregistre un changement d'etat dans l'historique. Rien n'est jamais ecrase. */
export function changerEtat(
  planning: Planning,
  etat: EtatSuivi,
  date: string,
  remarques = '',
  horodatage: string = new Date().toISOString(),
): Planning {
  return {
    ...planning,
    ...changerEtatSuivi(planning, etat, date, remarques, horodatage),
  }
}

/** Date a laquelle le planning a ete publie a l'equipe, ou null. */
export function datePublication(planning: Planning): string | null {
  return dateDuDernier(planning, 'publie')
}

/** Date de la derniere soumission au patron, ou null. */
export function dateSoumission(planning: Planning): string | null {
  return dateDuDernier(planning, 'soumis')
}

/**
 * Le PDF d'affichage equipe n'est produit qu'au statut « Publie a l'equipe ».
 * C'est la seule protection contre la diffusion d'un planning non valide :
 * elle est donc bloquante, et non un simple avertissement (§15).
 */
export function afficheEquipeImprimable(planning: Planning): boolean {
  return planning.etat === 'publie'
}

/** Le dossier a presenter au patron est imprimable a tout moment (§15). */
export function dossierPatronImprimable(): boolean {
  return true
}

/** Vacations d'un rayon donne. */
export function vacationsDuRayon(planning: Planning, rayonId: string): Vacation[] {
  return planning.vacations.filter((vacation) => vacation.rayonId === rayonId)
}

/** Vacations d'un jour donne. */
export function vacationsDuJour(planning: Planning, jour: string): Vacation[] {
  return planning.vacations.filter((vacation) => vacation.jour === jour)
}
