import { describe, expect, it } from 'vitest'
import { absenceDuJour, absencesDuJour, estAbsent, joursAbsentsDans, type Absence } from './absence'

/** Donnees FICTIVES uniquement. */

const ABSENCES: Absence[] = [
  { id: 'a1', collaborateurId: 'c-01', debut: '2026-11-02', fin: '2026-11-06', type: 'conge-paye', prevue: true },
  { id: 'a2', collaborateurId: 'c-02', debut: '2026-11-03', fin: '2026-11-03', type: 'maladie', prevue: false },
]

describe('absences', () => {
  it('reconnaît une absence en cours, bornes comprises', () => {
    expect(estAbsent(ABSENCES, 'c-01', '2026-11-02')).toBe(true)
    expect(estAbsent(ABSENCES, 'c-01', '2026-11-06')).toBe(true)
    expect(estAbsent(ABSENCES, 'c-01', '2026-11-07')).toBe(false)
    expect(estAbsent(ABSENCES, 'c-01', '2026-11-01')).toBe(false)
  })

  it('ne confond pas deux personnes', () => {
    expect(estAbsent(ABSENCES, 'c-02', '2026-11-02')).toBe(false)
    expect(estAbsent(ABSENCES, 'c-02', '2026-11-03')).toBe(true)
  })

  it('retrouve l’absence du jour et son type', () => {
    expect(absenceDuJour(ABSENCES, 'c-02', '2026-11-03')?.type).toBe('maladie')
    expect(absenceDuJour(ABSENCES, 'c-02', '2026-11-04')).toBeUndefined()
  })

  it('liste les absences d’une journée', () => {
    expect(absencesDuJour(ABSENCES, '2026-11-03').map((a) => a.collaborateurId)).toEqual([
      'c-01',
      'c-02',
    ])
    expect(absencesDuJour(ABSENCES, '2026-11-10')).toEqual([])
  })

  it('compte les jours absents sur une période', () => {
    const semaine = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
    expect(joursAbsentsDans(ABSENCES, 'c-01', semaine)).toBe(5)
    expect(joursAbsentsDans(ABSENCES, 'c-02', semaine)).toBe(1)
  })

  it('n’enregistre que le type, jamais le motif', () => {
    for (const absence of ABSENCES) {
      expect(Object.keys(absence).sort()).toEqual([
        'collaborateurId',
        'debut',
        'fin',
        'id',
        'prevue',
        'type',
      ])
    }
  })
})
