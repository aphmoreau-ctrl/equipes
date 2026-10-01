import { describe, expect, it } from 'vitest'
import { semaineDe } from '../../domaine/calendrier'
import { clientsParTranche, tranchesOuvertes } from '../../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../../donnees/demo'
import { calculerBesoin, type BesoinJour } from '../besoin'
import { PARAMETRES_PAR_DEFAUT, type Vacation } from '../regles'
import {
  comparerLesScenarios,
  expliquerLaDifference,
  meilleurScenario,
  type Scenario,
} from './scenarios'

/** Donnees FICTIVES uniquement. */

const SEMAINE = '2026-11-02'

function besoinsDeLaSemaine(): BesoinJour[] {
  const configuration = CONFIGURATIONS_DEMO.find((c) => c.rayonId === 'fruits-legumes')!
  return semaineDe(SEMAINE).map((date) =>
    calculerBesoin(configuration, {
      date,
      clientsParTranche: clientsParTranche(MAGASIN_DEMO, date),
      tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, date, 'fruits-legumes'),
      meteo: 'normal',
      coefficientEvenements: 1,
      enPromotion: false,
      saisiesQualite: [],
    }),
  )
}

function vacation(collaborateurId: string, jour: string, rayonId = 'fruits-legumes'): Vacation {
  return {
    id: `v-${collaborateurId}-${jour}`,
    collaborateurId,
    rayonId,
    jour,
    debut: '05:30',
    fin: '12:30',
    pauseMinutes: 20,
    pauseDebut: '09:00',
  }
}

function scenario(id: string, nom: string, vacations: Vacation[]): Scenario {
  return { id, nom, semaine: SEMAINE, vacations, creeLe: '2026-10-25' }
}

const VIDE = scenario('vide', 'Semaine vide', [])
const PETIT = scenario('petit', 'Deux jours', [
  vacation('c-01', '2026-11-02'),
  vacation('c-02', '2026-11-03'),
])
const FOURNI = scenario(
  'fourni',
  'Cinq jours',
  ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].flatMap((jour) => [
    vacation('c-01', jour),
    vacation('c-02', jour),
  ]),
)

function comparer(scenarios: Scenario[]) {
  return comparerLesScenarios({
    scenarios,
    besoins: besoinsDeLaSemaine(),
    collaborateurs: COLLABORATEURS_DEMO,
    parametres: PARAMETRES_PAR_DEFAUT,
  })
}

describe('comparaison de scénarios', () => {
  it('ne compare rien quand il n’y a aucun scénario', () => {
    expect(comparer([])).toEqual([])
    expect(meilleurScenario([])).toBeNull()
  })

  it('mesure chaque scénario sur les mêmes indicateurs', () => {
    const resultat = comparer([PETIT])
    expect(resultat).toHaveLength(1)
    expect(resultat[0]?.nom).toBe('Deux jours')
    expect(resultat[0]?.heuresPrevues).toBeCloseTo(13.3, 1)
    expect(resultat[0]?.heuresManquantes).toBeGreaterThan(0)
    expect(resultat[0]?.couverture).toBeGreaterThan(0)
    expect(resultat[0]?.couverture).toBeLessThan(1)
  })

  it('classe le scénario qui couvre le mieux en premier', () => {
    const resultat = comparer([VIDE, FOURNI, PETIT])
    expect(resultat[0]?.scenarioId).toBe('fourni')
    expect(meilleurScenario(resultat)).toBe('fourni')
  })

  it('considère une semaine vide comme entièrement découverte', () => {
    const resultat = comparer([VIDE])
    expect(resultat[0]?.couverture).toBe(0)
    expect(resultat[0]?.heuresPrevues).toBe(0)
  })

  it('relègue d’office un scénario qui enfreint une règle', () => {
    // Sept jours d'affilee : interdit, meme si la couverture est meilleure.
    const illegal = scenario(
      'illegal',
      'Sept jours',
      semaineDe(SEMAINE).flatMap((jour) => [vacation('c-01', jour), vacation('c-02', jour)]),
    )
    const resultat = comparer([illegal, FOURNI])

    expect(resultat[0]?.scenarioId).toBe('fourni')
    expect(resultat[0]?.reglesEnfreintes).toBe(0)
    expect(resultat[1]?.reglesEnfreintes).toBeGreaterThan(0)
  })

  it('compte les renforts venus d’un autre rayon', () => {
    // Thierry M. est boucher : le placer en fruits et legumes est un renfort.
    const avecRenfort = scenario('renfort', 'Avec renfort', [
      vacation('c-01', '2026-11-02'),
      vacation('c-06', '2026-11-02'),
    ])
    expect(comparer([avecRenfort])[0]?.renforts).toBe(1)
    expect(comparer([PETIT])[0]?.renforts).toBe(0)
  })

  it('mesure l’écart moyen aux contrats', () => {
    const resultat = comparer([VIDE, FOURNI])
    const vide = resultat.find((c) => c.scenarioId === 'vide')!
    const fourni = resultat.find((c) => c.scenarioId === 'fourni')!
    // Une semaine vide laisse tout le monde loin de son contrat.
    expect(vide.ecartMoyenAuContrat).toBeGreaterThan(fourni.ecartMoyenAuContrat)
  })

  it('rend le même classement à données égales', () => {
    expect(comparer([VIDE, PETIT, FOURNI])).toEqual(comparer([FOURNI, PETIT, VIDE]))
  })
})

describe('explication des différences', () => {
  it('dit en français ce qui change d’un scénario à l’autre', () => {
    const resultat = comparer([PETIT, FOURNI])
    const petit = resultat.find((c) => c.scenarioId === 'petit')!
    const fourni = resultat.find((c) => c.scenarioId === 'fourni')!

    const differences = expliquerLaDifference(petit, fourni)
    expect(differences.join(' · ')).toMatch(/points de couverture/)
    expect(differences.join(' · ')).toMatch(/h de travail prévu/)
  })

  it('ne dit rien quand les deux scénarios se valent', () => {
    const resultat = comparer([PETIT])
    expect(expliquerLaDifference(resultat[0]!, resultat[0]!)).toEqual([])
  })

  it('signale une règle enfreinte en plus', () => {
    const illegal = scenario(
      'illegal',
      'Sept jours',
      semaineDe(SEMAINE).map((jour) => vacation('c-01', jour)),
    )
    const resultat = comparer([PETIT, illegal])
    const petit = resultat.find((c) => c.scenarioId === 'petit')!
    const mauvais = resultat.find((c) => c.scenarioId === 'illegal')!
    expect(expliquerLaDifference(petit, mauvais).join(' · ')).toMatch(/règle/)
  })
})
