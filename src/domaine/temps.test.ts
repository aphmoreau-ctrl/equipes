import { describe, expect, it } from 'vitest'
import {
  MINUTES_PAR_JOUR,
  TRANCHES_PAR_JOUR,
  TRANCHE_MINUTES,
  chevauchement,
  debutDeTranche,
  duree,
  dureeEnTexte,
  enMinutes,
  enTexte,
  estHeureValide,
  indexTranche,
  tranchesCouvertes,
} from './temps'

describe('estHeureValide', () => {
  it('accepte les heures bien formees', () => {
    for (const heure of ['00:00', '05:30', '13:45', '23:59']) {
      expect(estHeureValide(heure)).toBe(true)
    }
  })

  it('refuse les formats approximatifs et les heures impossibles', () => {
    for (const heure of ['5:30', '05h30', '24:00', '12:60', '', '0530', '12:5']) {
      expect(estHeureValide(heure)).toBe(false)
    }
  })
})

describe('enMinutes et enTexte', () => {
  it('convertit dans les deux sens', () => {
    expect(enMinutes('00:00')).toBe(0)
    expect(enMinutes('05:30')).toBe(330)
    expect(enMinutes('23:59')).toBe(1439)
    expect(enTexte(0)).toBe('00:00')
    expect(enTexte(330)).toBe('05:30')
    expect(enTexte(1439)).toBe('23:59')
  })

  it('revient a l identique pour toutes les minutes du jour', () => {
    for (let minute = 0; minute < MINUTES_PAR_JOUR; minute += 1) {
      expect(enMinutes(enTexte(minute))).toBe(minute)
    }
  })

  it('refuse une heure mal formee avec un message explicite', () => {
    expect(() => enMinutes('25:00')).toThrow(/Heure invalide/)
    expect(() => enTexte(MINUTES_PAR_JOUR)).toThrow(/Heure invalide/)
    expect(() => enTexte(-1)).toThrow(/Heure invalide/)
    expect(() => enTexte(12.5)).toThrow(/Heure invalide/)
  })
})

describe('dureeEnTexte', () => {
  it('formate a la francaise', () => {
    expect(dureeEnTexte(45)).toBe('45 min')
    expect(dureeEnTexte(0)).toBe('0 min')
    expect(dureeEnTexte(480)).toBe('8 h')
    expect(dureeEnTexte(450)).toBe('7 h 30')
    expect(dureeEnTexte(425)).toBe('7 h 05')
  })

  it('refuse une duree negative', () => {
    expect(() => dureeEnTexte(-30)).toThrow(/Duree invalide/)
  })
})

describe('duree', () => {
  it('calcule une vacation ordinaire', () => {
    expect(duree('05:30', '12:30')).toBe(420)
    expect(duree('07:00', '14:00')).toBe(420)
    expect(duree('13:30', '20:30')).toBe(420)
  })

  it('gere une vacation qui passe minuit', () => {
    expect(duree('22:00', '05:00')).toBe(420)
    expect(duree('21:00', '00:30')).toBe(210)
  })

  it('refuse un debut egal a la fin, qui serait ambigu', () => {
    expect(() => duree('08:00', '08:00')).toThrow(/identiques/)
  })
})

describe('chevauchement', () => {
  it('mesure la partie commune', () => {
    expect(chevauchement(480, 720, 600, 840)).toBe(120)
    expect(chevauchement(480, 720, 480, 720)).toBe(240)
  })

  it('renvoie zero quand les intervalles ne se touchent pas', () => {
    expect(chevauchement(480, 600, 600, 720)).toBe(0)
    expect(chevauchement(480, 600, 900, 960)).toBe(0)
  })

  it('est symetrique', () => {
    expect(chevauchement(300, 600, 450, 900)).toBe(chevauchement(450, 900, 300, 600))
  })
})

describe('tranches de 15 minutes', () => {
  it('compte 96 tranches par jour', () => {
    expect(TRANCHE_MINUTES).toBe(15)
    expect(TRANCHES_PAR_JOUR).toBe(96)
  })

  it('situe une minute dans sa tranche', () => {
    expect(indexTranche(0)).toBe(0)
    expect(indexTranche(14)).toBe(0)
    expect(indexTranche(15)).toBe(1)
    expect(indexTranche(enMinutes('08:00'))).toBe(32)
    expect(debutDeTranche(32)).toBe(enMinutes('08:00'))
  })

  it('liste les tranches touchees par un intervalle', () => {
    expect(tranchesCouvertes(enMinutes('08:00'), enMinutes('09:00'))).toEqual([32, 33, 34, 35])
    expect(tranchesCouvertes(enMinutes('08:00'), enMinutes('08:15'))).toEqual([32])
    // Entierement contenu dans une seule tranche.
    expect(tranchesCouvertes(enMinutes('08:05'), enMinutes('08:12'))).toEqual([32])
    // A cheval sur deux tranches, meme de quelques minutes : les deux comptent.
    expect(tranchesCouvertes(enMinutes('08:10'), enMinutes('08:20'))).toEqual([32, 33])
  })

  it('ne renvoie rien pour un intervalle vide ou inverse', () => {
    expect(tranchesCouvertes(480, 480)).toEqual([])
    expect(tranchesCouvertes(600, 480)).toEqual([])
  })

  it('couvre exactement la journee pour une amplitude complete', () => {
    expect(tranchesCouvertes(0, MINUTES_PAR_JOUR)).toHaveLength(TRANCHES_PAR_JOUR)
  })
})
