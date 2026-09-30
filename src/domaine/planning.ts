import type { Vacation } from '../moteurs/regles'

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

export type EtatSuivi = 'brouillon' | 'soumis' | 'valide' | 'a-corriger' | 'publie'

export const LIBELLES_ETAT: Readonly<Record<EtatSuivi, string>> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis',
  valide: 'Validé',
  'a-corriger': 'À corriger',
  publie: 'Publié à l’équipe',
}

export const EXPLICATIONS_ETAT: Readonly<Record<EtatSuivi, string>> = {
  brouillon: 'En préparation. Modifiable librement.',
  soumis: 'Remis au patron pour validation.',
  valide: 'Accord du patron.',
  'a-corriger': 'Le patron demande des modifications.',
  publie: 'Affiché et diffusé aux salariés.',
}

/** Un changement d'etat, date et conserve pour toujours. */
export interface EvenementSuivi {
  readonly id: string
  readonly etat: EtatSuivi
  /** Date que l'utilisateur declare (le jour ou il a remis le planning). */
  readonly date: string
  /** Horodatage de la saisie, pour l'historique. */
  readonly horodatage: string
  /** Remarques du patron, notees par Arnaud. Note de travail INTERNE. */
  readonly remarques: string
  /** Version du planning concernee. */
  readonly version: number
}

export interface Planning {
  /** Lundi de la semaine : sert d'identifiant. */
  readonly semaine: string
  readonly vacations: readonly Vacation[]
  readonly etat: EtatSuivi
  readonly historique: readonly EvenementSuivi[]
  /** Incrementee a chaque soumission : permet de relier une remarque a une version. */
  readonly version: number
}

export function planningVide(semaine: string): Planning {
  return { semaine, vacations: [], etat: 'brouillon', historique: [], version: 1 }
}

/**
 * Etats accessibles depuis l'etat courant.
 * Le cycle n'est pas lineaire : « A corriger » ramene au travail, puis a une
 * nouvelle soumission, autant de fois que necessaire.
 */
export function etatsSuivants(etat: EtatSuivi): EtatSuivi[] {
  switch (etat) {
    case 'brouillon':
      return ['soumis']
    case 'soumis':
      return ['valide', 'a-corriger']
    case 'a-corriger':
      return ['brouillon', 'soumis']
    case 'valide':
      return ['publie', 'a-corriger']
    case 'publie':
      return ['a-corriger']
  }
}

/** Enregistre un changement d'etat dans l'historique. Rien n'est jamais ecrase. */
export function changerEtat(
  planning: Planning,
  etat: EtatSuivi,
  date: string,
  remarques = '',
  horodatage: string = new Date().toISOString(),
): Planning {
  // Une nouvelle soumission apres correction cree une nouvelle version.
  const version =
    etat === 'soumis' && planning.etat === 'a-corriger' ? planning.version + 1 : planning.version

  return {
    ...planning,
    etat,
    version,
    historique: [
      ...planning.historique,
      {
        id: `suivi-${horodatage}-${etat}`,
        etat,
        date,
        horodatage,
        remarques,
        version,
      },
    ],
  }
}

/** Date a laquelle le planning a ete publie a l'equipe, ou null. */
export function datePublication(planning: Planning): string | null {
  const publications = planning.historique.filter((evenement) => evenement.etat === 'publie')
  return publications[publications.length - 1]?.date ?? null
}

/** Date de la derniere soumission au patron, ou null. */
export function dateSoumission(planning: Planning): string | null {
  const soumissions = planning.historique.filter((evenement) => evenement.etat === 'soumis')
  return soumissions[soumissions.length - 1]?.date ?? null
}

/** Toutes les remarques du patron, de la plus recente a la plus ancienne. */
export function remarquesDuPatron(planning: Planning): EvenementSuivi[] {
  return [...planning.historique]
    .filter((evenement) => evenement.remarques.trim() !== '')
    .reverse()
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
