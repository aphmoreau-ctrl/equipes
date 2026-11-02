import { describe, expect, it } from 'vitest'
import type { Absence } from '../../domaine/absence'
import type { Vacation } from '../regles'
import { reposAutourDuDimanche, semainesAutourDuDimanche } from './dimanche'

/** Donnees ENTIEREMENT FICTIVES. Semaine du lundi 2 au dimanche 8 novembre 2026. */

const v = (jour: string): Vacation => ({ id: jour, collaborateurId: 'a', rayonId: 'r', jour, debut: '07:00', fin: '13:00', pauseMinutes: 0 })
const LUNDI_A_SAMEDI = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
const SEMAINE_SUIVANTE = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']

describe('dimanche travaillé : un jour de repos complet la semaine avant ou après', () => {
  it('la semaine avant et la semaine après, du lundi au samedi', () => {
    expect(semainesAutourDuDimanche('2026-11-08')).toEqual({ avant: LUNDI_A_SAMEDI, apres: SEMAINE_SUIVANTE })
  })

  it('tenu si un jour de la semaine est libre', () => {
    const vacations = [...LUNDI_A_SAMEDI.slice(1), '2026-11-08'].map(v)
    expect(reposAutourDuDimanche('2026-11-08', 'a', vacations, [], false)).toBe('tenu')
  })

  it('un congé n’est pas un repos : à prévoir la semaine suivante', () => {
    const vacations = [...LUNDI_A_SAMEDI.slice(1), '2026-11-08'].map(v)
    const conge: Absence[] = [{ id: 'cp', collaborateurId: 'a', debut: '2026-11-02', fin: '2026-11-02', type: 'conge-paye', prevue: true }]
    expect(reposAutourDuDimanche('2026-11-08', 'a', vacations, conge, false)).toBe('a-prevoir')
  })

  it('manquant si ni la semaine avant ni la semaine après n’ont de jour libre', () => {
    const conge: Absence[] = [{ id: 'cp', collaborateurId: 'a', debut: '2026-11-02', fin: '2026-11-02', type: 'conge-paye', prevue: true }]
    const vacations = [...LUNDI_A_SAMEDI.slice(1), '2026-11-08', ...SEMAINE_SUIVANTE].map(v)
    expect(reposAutourDuDimanche('2026-11-08', 'a', vacations, conge, true)).toBe('manque')
    // Un jour libre la semaine suivante suffit.
    expect(reposAutourDuDimanche('2026-11-08', 'a', vacations.filter((x) => x.jour !== '2026-11-11'), conge, true)).toBe('tenu')
  })
})
