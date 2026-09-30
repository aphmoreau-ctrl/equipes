import { describe, expect, it } from 'vitest'
import type { Vacation } from '../moteurs/regles'
import {
  afficheEquipeImprimable,
  changerEtat,
  datePublication,
  dateSoumission,
  dossierPatronImprimable,
  etatsSuivants,
  planningVide,
  remarquesDuPatron,
  vacationsDuJour,
  vacationsDuRayon,
} from './planning'

/** Donnees FICTIVES uniquement. */

function vacation(partiel: Partial<Vacation> = {}): Vacation {
  return {
    id: 'v1',
    collaborateurId: 'c-01',
    rayonId: 'fruits-legumes',
    jour: '2026-11-02',
    debut: '06:00',
    fin: '13:20',
    pauseMinutes: 20,
    ...partiel,
  }
}

describe('circuit de suivi', () => {
  it('commence en brouillon, sans historique', () => {
    const planning = planningVide('2026-11-02')
    expect(planning.etat).toBe('brouillon')
    expect(planning.historique).toEqual([])
    expect(planning.version).toBe(1)
  })

  it('propose les bons états suivants', () => {
    expect(etatsSuivants('brouillon')).toEqual(['soumis'])
    expect(etatsSuivants('soumis')).toEqual(['valide', 'a-corriger'])
    expect(etatsSuivants('valide')).toEqual(['publie', 'a-corriger'])
    expect(etatsSuivants('a-corriger')).toEqual(['brouillon', 'soumis'])
    expect(etatsSuivants('publie')).toEqual(['a-corriger'])
  })

  it('enregistre chaque changement d’état, daté', () => {
    const planning = changerEtat(planningVide('2026-11-02'), 'soumis', '2026-10-20')
    expect(planning.etat).toBe('soumis')
    expect(planning.historique).toHaveLength(1)
    expect(planning.historique[0]?.date).toBe('2026-10-20')
  })

  it('n’écrase jamais l’historique', () => {
    let planning = planningVide('2026-11-02')
    planning = changerEtat(planning, 'soumis', '2026-10-20')
    planning = changerEtat(planning, 'a-corriger', '2026-10-21', 'Revoir le samedi matin.')
    planning = changerEtat(planning, 'soumis', '2026-10-22')
    planning = changerEtat(planning, 'valide', '2026-10-23')

    expect(planning.historique).toHaveLength(4)
    expect(planning.historique.map((e) => e.etat)).toEqual([
      'soumis',
      'a-corriger',
      'soumis',
      'valide',
    ])
  })

  it('crée une nouvelle version à chaque nouvelle soumission après correction', () => {
    let planning = changerEtat(planningVide('2026-11-02'), 'soumis', '2026-10-20')
    expect(planning.version).toBe(1)

    planning = changerEtat(planning, 'a-corriger', '2026-10-21', 'Trop de monde le mardi.')
    planning = changerEtat(planning, 'soumis', '2026-10-22')
    expect(planning.version).toBe(2)
  })

  it('conserve les remarques du patron, de la plus récente à la plus ancienne', () => {
    let planning = changerEtat(planningVide('2026-11-02'), 'soumis', '2026-10-20')
    planning = changerEtat(planning, 'a-corriger', '2026-10-21', 'Revoir le samedi.')
    planning = changerEtat(planning, 'soumis', '2026-10-22')
    planning = changerEtat(planning, 'a-corriger', '2026-10-23', 'Encore trop d’heures.')

    const remarques = remarquesDuPatron(planning)
    expect(remarques).toHaveLength(2)
    expect(remarques[0]?.remarques).toBe('Encore trop d’heures.')
  })

  it('retrouve les dates de soumission et de publication', () => {
    let planning = changerEtat(planningVide('2026-11-02'), 'soumis', '2026-10-20')
    expect(dateSoumission(planning)).toBe('2026-10-20')
    expect(datePublication(planning)).toBeNull()

    planning = changerEtat(planning, 'valide', '2026-10-22')
    planning = changerEtat(planning, 'publie', '2026-10-23')
    expect(datePublication(planning)).toBe('2026-10-23')
  })
})

describe('impression des documents', () => {
  it('n’autorise l’affichage équipe qu’une fois publié', () => {
    let planning = planningVide('2026-11-02')
    expect(afficheEquipeImprimable(planning)).toBe(false)

    planning = changerEtat(planning, 'soumis', '2026-10-20')
    expect(afficheEquipeImprimable(planning)).toBe(false)

    planning = changerEtat(planning, 'valide', '2026-10-22')
    expect(afficheEquipeImprimable(planning)).toBe(false)

    planning = changerEtat(planning, 'publie', '2026-10-23')
    expect(afficheEquipeImprimable(planning)).toBe(true)
  })

  it('autorise le dossier à présenter au patron à tout moment', () => {
    expect(dossierPatronImprimable()).toBe(true)
  })
})

describe('contenu du planning', () => {
  const planning = {
    ...planningVide('2026-11-02'),
    vacations: [
      vacation({ id: 'a', rayonId: 'fruits-legumes', jour: '2026-11-02' }),
      vacation({ id: 'b', rayonId: 'boucherie', jour: '2026-11-02' }),
      vacation({ id: 'c', rayonId: 'fruits-legumes', jour: '2026-11-03' }),
    ],
  }

  it('filtre par rayon', () => {
    expect(vacationsDuRayon(planning, 'fruits-legumes').map((v) => v.id)).toEqual(['a', 'c'])
  })

  it('filtre par jour', () => {
    expect(vacationsDuJour(planning, '2026-11-02').map((v) => v.id)).toEqual(['a', 'b'])
  })
})
