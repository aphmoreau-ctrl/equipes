import { describe, expect, it } from 'vitest'
import { duree } from '../domaine/temps'
import { HORAIRES_TYPES_DEMO, RAYONS_DEMO } from './demo'

describe('rayons de demonstration', () => {
  it('reprend les sept rayons frais du cahier des charges', () => {
    expect(RAYONS_DEMO).toHaveLength(7)
  })

  it('n utilise aucun identifiant en double', () => {
    const identifiants = RAYONS_DEMO.map((rayon) => rayon.id)
    expect(new Set(identifiants).size).toBe(identifiants.length)
  })

  it('numerote les rayons de 1 a 7 sans trou', () => {
    expect(RAYONS_DEMO.map((rayon) => rayon.ordre)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('donne un nom lisible a chaque rayon', () => {
    for (const rayon of RAYONS_DEMO) {
      expect(rayon.nom.trim().length).toBeGreaterThan(2)
    }
  })
})

describe('horaires types de demonstration', () => {
  it('decrit des vacations coherentes', () => {
    for (const horaire of HORAIRES_TYPES_DEMO) {
      const amplitude = duree(horaire.debut, horaire.fin)
      expect(amplitude).toBeGreaterThan(horaire.pause)
      // Une vacation type ne depasse jamais le plafond legal de 10 h.
      expect(amplitude - horaire.pause).toBeLessThanOrEqual(600)
    }
  })
})
