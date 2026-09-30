import { estDansIntervalle } from './calendrier'

/**
 * Absences et conges (cahier des charges §12).
 *
 * RGPD : on enregistre le TYPE et les DATES, jamais le motif. « Maladie »
 * suffit a organiser le travail ; la nature de la maladie ne regarde pas
 * l'employeur et n'a rien a faire dans cette application.
 */

export type TypeAbsence =
  | 'conge-paye'
  | 'rtt'
  | 'maladie'
  | 'absence-autorisee'
  | 'formation'
  | 'accident-travail'
  | 'autre'

export const LIBELLES_ABSENCE: Readonly<Record<TypeAbsence, string>> = {
  'conge-paye': 'Congé payé',
  rtt: 'RTT ou repos compensateur',
  maladie: 'Maladie',
  'absence-autorisee': 'Absence autorisée',
  formation: 'Formation',
  'accident-travail': 'Accident du travail',
  autre: 'Autre',
}

/** Absences qui se savent a l'avance : elles entrent dans la capacite prevue. */
export const ABSENCES_PREVISIBLES: readonly TypeAbsence[] = ['conge-paye', 'rtt', 'formation']

export interface Absence {
  readonly id: string
  readonly collaborateurId: string
  readonly debut: string
  readonly fin: string
  readonly type: TypeAbsence
  /** Absence connue a l'avance, ou survenue le jour meme. */
  readonly prevue: boolean
}

/** Vrai si la personne est absente ce jour-la. */
export function estAbsent(
  absences: readonly Absence[],
  collaborateurId: string,
  date: string,
): boolean {
  return absences.some(
    (absence) =>
      absence.collaborateurId === collaborateurId &&
      estDansIntervalle(date, absence.debut, absence.fin),
  )
}

/** Absence en cours pour cette personne ce jour-la, s'il y en a une. */
export function absenceDuJour(
  absences: readonly Absence[],
  collaborateurId: string,
  date: string,
): Absence | undefined {
  return absences.find(
    (absence) =>
      absence.collaborateurId === collaborateurId &&
      estDansIntervalle(date, absence.debut, absence.fin),
  )
}

/** Toutes les absences d'une journee. */
export function absencesDuJour(absences: readonly Absence[], date: string): Absence[] {
  return absences
    .filter((absence) => estDansIntervalle(date, absence.debut, absence.fin))
    .sort((a, b) => a.collaborateurId.localeCompare(b.collaborateurId))
}

/** Jours d'absence d'une personne dans un intervalle, pour la capacite prevue. */
export function joursAbsentsDans(
  absences: readonly Absence[],
  collaborateurId: string,
  dates: readonly string[],
): number {
  return dates.filter((date) => estAbsent(absences, collaborateurId, date)).length
}
