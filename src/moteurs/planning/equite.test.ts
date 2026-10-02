import { describe, expect, it } from 'vitest'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import type { Vacation } from '../regles'
import { aSoulager, mesurerLEquite, semainesObservees } from './equite'

/** Donnees FICTIVES uniquement. */

const SEMAINE = '2026-11-02' // un lundi

function vacation(partiel: Partial<Vacation> & Pick<Vacation, 'collaborateurId' | 'jour'>): Vacation {
  return {
    id: `${partiel.collaborateurId}-${partiel.jour}-${partiel.debut ?? '08:00'}`,
    rayonId: 'fruits-legumes',
    debut: '08:00',
    fin: '15:00',
    pauseMinutes: 20,
    ...partiel,
  }
}

describe('fenêtre de quatre semaines', () => {
  it('observe la semaine en cours et les trois précédentes', () => {
    expect(semainesObservees(SEMAINE)).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
      '2026-11-02',
    ])
  })

  it('ignore ce qui est plus ancien', () => {
    const vieux = [vacation({ collaborateurId: 'c-01', jour: '2026-09-05' })] // un samedi, trop vieux
    const equite = mesurerLEquite(SEMAINE, vieux, COLLABORATEURS_DEMO)
    expect(equite.every((personne) => personne.samedis === 0)).toBe(true)
  })
})

describe('mesure des sujétions', () => {
  it('compte les samedis, dimanches, ouvertures et fermetures', () => {
    const vacations = [
      vacation({ collaborateurId: 'c-01', jour: '2026-11-07' }), // samedi
      vacation({ collaborateurId: 'c-01', jour: '2026-11-08' }), // dimanche
      vacation({ collaborateurId: 'c-01', jour: '2026-11-03', debut: '05:30', fin: '12:30' }),
      vacation({ collaborateurId: 'c-01', jour: '2026-11-04', debut: '13:30', fin: '20:30' }),
    ]
    const sienne = mesurerLEquite(SEMAINE, vacations, COLLABORATEURS_DEMO).find(
      (personne) => personne.collaborateurId === 'c-01',
    )

    expect(sienne?.samedis).toBe(1)
    expect(sienne?.dimanches).toBe(1)
    expect(sienne?.ouvertures).toBe(1)
    expect(sienne?.fermetures).toBe(1)
  })

  it('pèse plus lourd un dimanche qu’un samedi', () => {
    const samedi = mesurerLEquite(
      SEMAINE,
      [vacation({ collaborateurId: 'c-01', jour: '2026-11-07' })],
      COLLABORATEURS_DEMO,
    ).find((p) => p.collaborateurId === 'c-01')

    const dimanche = mesurerLEquite(
      SEMAINE,
      [vacation({ collaborateurId: 'c-01', jour: '2026-11-08' })],
      COLLABORATEURS_DEMO,
    ).find((p) => p.collaborateurId === 'c-01')

    expect(dimanche?.total ?? 0).toBeGreaterThan(samedi?.total ?? 0)
  })

  it('classe en tête celui qui porte le plus', () => {
    const vacations = [
      vacation({ collaborateurId: 'c-02', jour: '2026-11-07' }),
      vacation({ collaborateurId: 'c-02', jour: '2026-10-31' }),
      vacation({ collaborateurId: 'c-02', jour: '2026-10-24' }),
    ]
    const equite = mesurerLEquite(SEMAINE, vacations, COLLABORATEURS_DEMO)
    expect(equite[0]?.collaborateurId).toBe('c-02')
    expect(equite[0]?.ecart ?? 0).toBeGreaterThan(0)
  })

  it('désigne qui soulager en priorité', () => {
    const vacations = ['2026-11-07', '2026-10-31', '2026-10-24', '2026-10-17'].map((jour) =>
      vacation({ collaborateurId: 'c-02', jour }),
    )
    const aAlleger = aSoulager(mesurerLEquite(SEMAINE, vacations, COLLABORATEURS_DEMO))
    expect(aAlleger.map((p) => p.collaborateurId)).toContain('c-02')
  })

  it('ne retient personne quand tout est équilibré', () => {
    expect(aSoulager(mesurerLEquite(SEMAINE, [], COLLABORATEURS_DEMO))).toEqual([])
  })
})
