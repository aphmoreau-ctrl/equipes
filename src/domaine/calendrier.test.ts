import { describe, expect, it } from 'vitest'
import {
  ajouterJours,
  ajouterMois,
  dateEnTexte,
  estAvant,
  estDansIntervalle,
  estDateValide,
  jourDeLaSemaine,
  lundiDeLaSemaine,
  moisDe,
  nomDuJour,
  nomDuMois,
  semaineDe,
} from './calendrier'

describe('validite des dates', () => {
  it('accepte une date reelle', () => {
    expect(estDateValide('2026-11-02')).toBe(true)
    expect(estDateValide('2024-02-29')).toBe(true)
  })

  it('refuse un format approximatif ou un jour inexistant', () => {
    for (const date of ['2026-11-2', '02/11/2026', '2026-13-01', '2026-02-30', '', '2025-02-29']) {
      expect(estDateValide(date)).toBe(false)
    }
  })
})

describe('jour de la semaine', () => {
  it('numerote de 1 pour lundi a 7 pour dimanche', () => {
    expect(jourDeLaSemaine('2026-11-02')).toBe(1)
    expect(jourDeLaSemaine('2026-11-07')).toBe(6)
    expect(jourDeLaSemaine('2026-11-08')).toBe(7)
  })

  it('ne se decale pas selon le fuseau horaire', () => {
    // Un 1er janvier tombe le meme jour, quel que soit l'endroit ou l'on est.
    expect(jourDeLaSemaine('2026-01-01')).toBe(4)
  })

  it('nomme les jours en francais', () => {
    expect(nomDuJour(1)).toBe('lundi')
    expect(nomDuJour(7)).toBe('dimanche')
  })
})

describe('mois', () => {
  it('numerote de 1 a 12', () => {
    expect(moisDe('2026-01-15')).toBe(1)
    expect(moisDe('2026-12-31')).toBe(12)
  })

  it('nomme les mois en francais', () => {
    expect(nomDuMois(8)).toBe('août')
    expect(() => nomDuMois(13)).toThrow(/Mois invalide/)
  })
})

describe('affichage', () => {
  it('ecrit une date en toutes lettres', () => {
    expect(dateEnTexte('2026-11-02')).toBe('lundi 2 novembre 2026')
  })
})

describe('deplacements dans le calendrier', () => {
  it('ajoute et retire des jours, y compris en changeant de mois', () => {
    expect(ajouterJours('2026-11-02', 5)).toBe('2026-11-07')
    expect(ajouterJours('2026-11-30', 1)).toBe('2026-12-01')
    expect(ajouterJours('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('gere les annees bissextiles', () => {
    expect(ajouterJours('2024-02-28', 1)).toBe('2024-02-29')
    expect(ajouterJours('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('trouve le lundi de la semaine', () => {
    expect(lundiDeLaSemaine('2026-11-05')).toBe('2026-11-02')
    expect(lundiDeLaSemaine('2026-11-02')).toBe('2026-11-02')
    expect(lundiDeLaSemaine('2026-11-08')).toBe('2026-11-02')
  })

  it('donne les sept jours de la semaine, du lundi au dimanche', () => {
    const semaine = semaineDe('2026-11-05')
    expect(semaine).toHaveLength(7)
    expect(semaine[0]).toBe('2026-11-02')
    expect(semaine[6]).toBe('2026-11-08')
    expect(semaine.map(jourDeLaSemaine)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('comparaisons', () => {
  it('compare deux dates', () => {
    expect(estAvant('2026-11-02', '2026-11-03')).toBe(true)
    expect(estAvant('2026-11-03', '2026-11-02')).toBe(false)
    expect(estAvant('2026-11-02', '2026-11-02')).toBe(false)
  })

  it('situe une date dans un intervalle, bornes comprises', () => {
    expect(estDansIntervalle('2026-11-05', '2026-11-02', '2026-11-08')).toBe(true)
    expect(estDansIntervalle('2026-11-02', '2026-11-02', '2026-11-08')).toBe(true)
    expect(estDansIntervalle('2026-11-08', '2026-11-02', '2026-11-08')).toBe(true)
    expect(estDansIntervalle('2026-11-09', '2026-11-02', '2026-11-08')).toBe(false)
  })
})

describe('ajout de mois', () => {
  it('ajoute des mois en calendrier réel', () => {
    expect(ajouterMois('2026-01-15', 1)).toBe('2026-02-15')
    expect(ajouterMois('2024-10-01', 24)).toBe('2026-10-01')
  })

  it('ne déborde pas sur le mois suivant', () => {
    // Le 31 janvier plus un mois donne le 28 février, pas le 3 mars.
    expect(ajouterMois('2026-01-31', 1)).toBe('2026-02-28')
    expect(ajouterMois('2024-01-31', 1)).toBe('2024-02-29')
  })

  it('traverse les années', () => {
    expect(ajouterMois('2026-11-15', 3)).toBe('2027-02-15')
    expect(ajouterMois('2026-02-15', -3)).toBe('2025-11-15')
  })

  it('reste exact là où le calcul en jours dérivait', () => {
    // 24 mois valent 730 jours ici, pas 24 x 30 = 720.
    expect(ajouterMois('2024-10-01', 24)).not.toBe(ajouterJours('2024-10-01', 24 * 30))
  })
})
