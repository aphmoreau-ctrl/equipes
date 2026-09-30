/**
 * Circuit de suivi (cahier des charges §9.6).
 *
 * Arnaud n'est PAS le validateur final : il prepare, puis soumet a son patron,
 * qui valide EN DEHORS de l'application. L'application ne soumet rien, ne
 * notifie personne et ne valide rien : elle garde la trace d'un circuit
 * renseigne a la main.
 *
 * Mecanisme GENERIQUE, ecrit une seule fois : il sert aux plannings, aux
 * conges, puis aux recrutements.
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
  valide: 'Accord du patron.',
  soumis: 'Remis au patron pour validation.',
  'a-corriger': 'Le patron demande des modifications.',
  publie: 'Affiché et diffusé aux salariés.',
}

/** Un changement d'etat, date et conserve pour toujours. */
export interface EvenementSuivi {
  readonly id: string
  readonly etat: EtatSuivi
  /** Date que l'utilisateur declare (le jour ou il a remis le document). */
  readonly date: string
  /** Horodatage de la saisie, pour l'historique. */
  readonly horodatage: string
  /** Remarques du patron, notees par Arnaud. Note de travail INTERNE. */
  readonly remarques: string
  readonly version: number
}

export interface Suivi {
  readonly etat: EtatSuivi
  readonly historique: readonly EvenementSuivi[]
  /** Incrementee a chaque nouvelle soumission apres correction. */
  readonly version: number
}

export function suiviInitial(): Suivi {
  return { etat: 'brouillon', historique: [], version: 1 }
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

/** Enregistre un changement d'etat. Rien n'est jamais ecrase. */
export function changerEtatSuivi(
  suivi: Suivi,
  etat: EtatSuivi,
  date: string,
  remarques = '',
  horodatage: string = new Date().toISOString(),
): Suivi {
  const version = etat === 'soumis' && suivi.etat === 'a-corriger' ? suivi.version + 1 : suivi.version

  return {
    etat,
    version,
    historique: [
      ...suivi.historique,
      { id: `suivi-${horodatage}-${etat}`, etat, date, horodatage, remarques, version },
    ],
  }
}

/** Date du dernier passage par un etat donne, ou null. */
export function dateDuDernier(suivi: Suivi, etat: EtatSuivi): string | null {
  const passages = suivi.historique.filter((evenement) => evenement.etat === etat)
  return passages[passages.length - 1]?.date ?? null
}

/** Toutes les remarques du patron, de la plus recente a la plus ancienne. */
export function remarquesDuPatron(suivi: Suivi): EvenementSuivi[] {
  return [...suivi.historique].filter((evenement) => evenement.remarques.trim() !== '').reverse()
}
