import { describe, expect, it } from 'vitest'
import { PARAMETRES_PAR_DEFAUT } from './parametres'
import { dureeTravailEffectif, grouperParJournee } from './regroupement'
import { REGLES_IMPLEMENTEES, resumerInfractions, verifier } from './verifier'
import type { ParametresRegles, Vacation } from './types'

/**
 * Donnees FICTIVES. Aucun salarie reel ne doit apparaitre dans les tests
 * (cahier des charges §3 et consignes permanentes).
 */
function vacation(partiel: Partial<Vacation> & Pick<Vacation, 'debut' | 'fin'>): Vacation {
  return {
    id: `v-${partiel.debut}-${partiel.fin}`,
    collaborateurId: 'demo-1',
    jour: '2026-11-02',
    pauseMinutes: 0,
    ...partiel,
  }
}

describe('dureeTravailEffectif', () => {
  it('deduit la pause de l amplitude', () => {
    expect(dureeTravailEffectif(vacation({ debut: '05:30', fin: '12:30', pauseMinutes: 20 }))).toBe(400)
  })

  it('compte une vacation de nuit qui passe minuit', () => {
    expect(dureeTravailEffectif(vacation({ debut: '22:00', fin: '05:00' }))).toBe(420)
  })

  it('refuse une pause plus longue que la vacation', () => {
    expect(() =>
      dureeTravailEffectif(vacation({ debut: '08:00', fin: '09:00', pauseMinutes: 90 })),
    ).toThrow(/pause.*depasse/)
  })
})

describe('grouperParJournee', () => {
  it('rassemble les vacations d une meme personne le meme jour', () => {
    const journees = grouperParJournee([
      vacation({ debut: '05:30', fin: '09:00' }),
      vacation({ debut: '14:00', fin: '18:00' }),
    ])
    expect(journees).toHaveLength(1)
    expect(journees[0]?.vacations).toHaveLength(2)
  })

  it('ne melange jamais deux personnes ni deux jours', () => {
    const journees = grouperParJournee([
      vacation({ debut: '05:30', fin: '09:00', collaborateurId: 'demo-1' }),
      vacation({ debut: '05:30', fin: '09:00', collaborateurId: 'demo-2' }),
      vacation({ debut: '05:30', fin: '09:00', jour: '2026-11-03' }),
    ])
    expect(journees).toHaveLength(3)
  })

  it('rend toujours le meme ordre, quel que soit l ordre d entree', () => {
    const a = vacation({ debut: '05:30', fin: '09:00', collaborateurId: 'demo-2' })
    const b = vacation({ debut: '05:30', fin: '09:00', collaborateurId: 'demo-1' })
    const c = vacation({ debut: '05:30', fin: '09:00', collaborateurId: 'demo-1', jour: '2026-11-01' })

    const cles = (liste: Vacation[]) =>
      grouperParJournee(liste).map((j) => `${j.collaborateurId} ${j.jour}`)

    expect(cles([a, b, c])).toEqual(['demo-1 2026-11-01', 'demo-1 2026-11-02', 'demo-2 2026-11-02'])
    expect(cles([c, a, b])).toEqual(cles([a, b, c]))
    expect(cles([b, c, a])).toEqual(cles([a, b, c]))
  })
})

describe('regle : duree maximale quotidienne', () => {
  const p = PARAMETRES_PAR_DEFAUT

  it('accepte exactement 10 h de travail effectif', () => {
    // 05:00 a 15:20 avec 20 min de pause = 600 min pile.
    expect(verifier([vacation({ debut: '05:00', fin: '15:20', pauseMinutes: 20 })], p)).toEqual([])
  })

  it('signale le depassement du plafond, meme d une minute', () => {
    const infractions = verifier([vacation({ debut: '05:00', fin: '15:21', pauseMinutes: 20 })], p)
    expect(infractions).toHaveLength(1)
    expect(infractions[0]?.regle).toBe('duree-maximale-quotidienne')
    expect(infractions[0]?.severite).toBe('bloquante')
    expect(infractions[0]?.explication).toContain('1 min de plus')
  })

  it('additionne les vacations coupees du meme jour', () => {
    const infractions = verifier(
      [
        vacation({ id: 'matin', debut: '05:00', fin: '11:00' }),
        vacation({ id: 'soir', debut: '14:00', fin: '19:30' }),
      ],
      p,
    )
    // 6 h + 5 h 30 = 11 h 30, au-dela des 10 h.
    expect(infractions).toHaveLength(1)
    expect(infractions[0]?.libelle).toContain('11 h 30')
  })

  it('ne signale rien quand la pause ramene sous le plafond', () => {
    // 05:00 a 15:30 = 10 h 30 d amplitude, mais 45 min de pause = 9 h 45.
    expect(verifier([vacation({ debut: '05:00', fin: '15:30', pauseMinutes: 45 })], p)).toEqual([])
  })

  it('applique le plafond de derogation quand le jour est marque', () => {
    const longue = vacation({ debut: '05:00', fin: '16:20', pauseMinutes: 20 }) // 11 h
    expect(verifier([longue], p)).toHaveLength(1)
    expect(verifier([{ ...longue, derogation: true }], p)).toEqual([])
  })

  it('signale meme un jour en derogation au-dela de 12 h', () => {
    const infractions = verifier(
      [vacation({ debut: '05:00', fin: '17:30', pauseMinutes: 20, derogation: true })],
      p,
    )
    expect(infractions).toHaveLength(1)
    expect(infractions[0]?.explication).toContain('dérogation')
  })

  it('suit le plafond modifie par l utilisateur', () => {
    const magasinPlusStrict: ParametresRegles = { ...p, dureeMaximaleQuotidienneMinutes: 9 * 60 }
    const journee = vacation({ debut: '05:00', fin: '14:30' }) // 9 h 30
    expect(verifier([journee], p)).toEqual([])
    expect(verifier([journee], magasinPlusStrict)).toHaveLength(1)
  })

  it('suit la severite choisie par l utilisateur', () => {
    const enAvertissement: ParametresRegles = {
      ...p,
      severites: { ...p.severites, 'duree-maximale-quotidienne': 'avertissement' },
    }
    const trop = vacation({ debut: '05:00', fin: '16:00' })
    expect(verifier([trop], p)[0]?.severite).toBe('bloquante')
    expect(verifier([trop], enAvertissement)[0]?.severite).toBe('avertissement')
  })

  it('traite chaque personne separement', () => {
    const infractions = verifier(
      [
        vacation({ debut: '05:00', fin: '16:00', collaborateurId: 'demo-1' }),
        vacation({ debut: '05:00', fin: '09:00', collaborateurId: 'demo-2' }),
      ],
      p,
    )
    expect(infractions).toHaveLength(1)
    expect(infractions[0]?.collaborateurId).toBe('demo-1')
  })
})

describe('verifier', () => {
  it('ne signale rien sur un planning vide', () => {
    expect(verifier([], PARAMETRES_PAR_DEFAUT)).toEqual([])
  })

  it('rend le meme resultat quel que soit l ordre des vacations', () => {
    const a = vacation({ debut: '05:00', fin: '16:00', collaborateurId: 'demo-2' })
    const b = vacation({ debut: '05:00', fin: '17:00', collaborateurId: 'demo-1' })
    expect(verifier([a, b], PARAMETRES_PAR_DEFAUT)).toEqual(verifier([b, a], PARAMETRES_PAR_DEFAUT))
  })

  it('compte les manquements par severite', () => {
    const infractions = verifier(
      [
        vacation({ debut: '05:00', fin: '16:00', collaborateurId: 'demo-1' }),
        vacation({ debut: '05:00', fin: '17:00', collaborateurId: 'demo-2' }),
      ],
      PARAMETRES_PAR_DEFAUT,
    )
    expect(resumerInfractions(infractions)).toEqual({ bloquantes: 2, avertissements: 0 })
  })
})

describe('coherence du jeu de regles', () => {
  it('donne une severite a chaque regle implementee', () => {
    for (const regle of REGLES_IMPLEMENTEES) {
      expect(PARAMETRES_PAR_DEFAUT.severites[regle.id]).toBeDefined()
    }
  })

  it('donne un nom et une reference a chaque regle', () => {
    for (const regle of REGLES_IMPLEMENTEES) {
      expect(regle.nom.length).toBeGreaterThan(0)
      expect(regle.reference.length).toBeGreaterThan(0)
    }
  })

  it('n utilise aucun identifiant de regle en double', () => {
    const identifiants = REGLES_IMPLEMENTEES.map((regle) => regle.id)
    expect(new Set(identifiants).size).toBe(identifiants.length)
  })
})
