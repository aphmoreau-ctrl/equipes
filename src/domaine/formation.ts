import type { NiveauCompetence } from './collaborateur'

/**
 * Plan de formation (cahier des charges §13, module 10).
 *
 * RGPD : intitule, dates, competence visee. Aucune appreciation sur la
 * personne, aucun commentaire sur ses capacites.
 */

export type EtatFormation = 'prevue' | 'realisee' | 'annulee'

export const LIBELLES_FORMATION: Readonly<Record<EtatFormation, string>> = {
  prevue: 'Prévue',
  realisee: 'Réalisée',
  annulee: 'Annulée',
}

export interface Formation {
  readonly id: string
  readonly collaborateurId: string
  readonly intitule: string
  readonly debut: string
  readonly fin: string
  /** Competence que la formation doit faire progresser. */
  readonly competenceVisee: string
  /** Niveau attendu a l'issue. */
  readonly niveauVise: NiveauCompetence
  readonly etat: EtatFormation
  /** Habilitation delivree, le cas echeant (hygiene, transpalette...). */
  readonly habilitationDelivree: string | null
}

export function formationsDe(
  formations: readonly Formation[],
  collaborateurId: string,
): Formation[] {
  return formations
    .filter((formation) => formation.collaborateurId === collaborateurId)
    .sort((a, b) => b.debut.localeCompare(a.debut))
}

/** Formations prevues qui n'ont pas encore eu lieu. */
export function formationsAVenir(formations: readonly Formation[], date: string): Formation[] {
  return formations
    .filter((formation) => formation.etat === 'prevue' && formation.fin >= date)
    .sort((a, b) => a.debut.localeCompare(b.debut))
}
