import { describe, expect, it } from 'vitest'
import type { Mesure } from '../../domaine/mesure'
import { dureeDeLaMesure, mesureEnCours, mesuresDuBloc } from '../../domaine/mesure'
import { CONFIGURATION_FRUITS_LEGUMES } from '../../donnees/demo'
import {
  ECART_MINIMUM_POURCENT,
  MESURES_MINIMUM,
  appliquerLeRecalage,
  mesurerLaCadence,
  proposerUnRecalage,
  uniteDuBloc,
} from './cadences'
import type { Bloc, NiveauQualite } from './types'

/** Donnees FICTIVES uniquement. */

const QUALITE = CONFIGURATION_FRUITS_LEGUMES.coefficientsQualite

function mesure(
  minutes: number,
  quantite: number,
  options: { blocId?: string; qualite?: NiveauQualite | null; id?: string } = {},
): Mesure {
  const debut = new Date('2026-11-02T06:00:00Z')
  const fin = new Date(debut.getTime() + minutes * 60_000)
  return {
    id: options.id ?? `m-${minutes}-${quantite}`,
    rayonId: 'fruits-legumes',
    blocId: options.blocId ?? 'fl-mise-en-place-vrac',
    debut: debut.toISOString(),
    fin: fin.toISOString(),
    quantite,
    unite: 'colis',
    qualite: options.qualite ?? null,
  }
}

function bloc(): Bloc {
  const trouve = CONFIGURATION_FRUITS_LEGUMES.blocs.find((b) => b.id === 'fl-mise-en-place-vrac')
  if (trouve === undefined) throw new Error('Bloc de démonstration introuvable.')
  return trouve
}

describe('durée d’une mesure', () => {
  it('calcule la durée en minutes', () => {
    expect(dureeDeLaMesure(mesure(90, 30))).toBe(90)
  })

  it('renvoie rien tant que le chrono tourne', () => {
    expect(dureeDeLaMesure({ ...mesure(90, 30), fin: null })).toBeNull()
  })

  it('refuse une fin antérieure au début', () => {
    const inversee = { ...mesure(90, 30), fin: '2026-11-02T05:00:00Z' }
    expect(dureeDeLaMesure(inversee)).toBeNull()
  })

  it('repère le chrono en cours, et un seul', () => {
    const mesures = [mesure(30, 10, { id: 'a' }), { ...mesure(0, 5, { id: 'b' }), fin: null }]
    expect(mesureEnCours(mesures)?.id).toBe('b')
    expect(mesureEnCours([mesure(30, 10)])).toBeUndefined()
  })

  it('ne garde que les mesures terminées d’un bloc, les plus récentes d’abord', () => {
    const mesures = [
      mesure(30, 10, { id: 'a' }),
      { ...mesure(0, 5, { id: 'b' }), fin: null },
      mesure(40, 12, { id: 'c', blocId: 'autre' }),
    ]
    expect(mesuresDuBloc(mesures, 'fl-mise-en-place-vrac').map((m) => m.id)).toEqual(['a'])
  })
})

describe('cadence mesurée', () => {
  it('ne dit rien sans mesure', () => {
    expect(mesurerLaCadence([], 'fl-mise-en-place-vrac', QUALITE)).toBeNull()
  })

  it('calcule minutes par unité et unités par heure', () => {
    // 60 minutes pour 30 colis : 2 min par colis, 30 colis par heure.
    const cadence = mesurerLaCadence([mesure(60, 30)], 'fl-mise-en-place-vrac', QUALITE)
    expect(cadence?.minutesParUnite).toBeCloseTo(2, 6)
    expect(cadence?.unitesParHeure).toBeCloseTo(30, 6)
  })

  it('pondère par les quantités', () => {
    // 10 colis en 30 min (3 min/colis) et 90 colis en 90 min (1 min/colis).
    const cadence = mesurerLaCadence(
      [mesure(30, 10, { id: 'a' }), mesure(90, 90, { id: 'b' })],
      'fl-mise-en-place-vrac',
      QUALITE,
    )
    // 120 min pour 100 colis = 1,2 min par colis.
    expect(cadence?.minutesParUnite).toBeCloseTo(1.2, 6)
    expect(cadence?.quantiteTotale).toBe(100)
  })

  it('ramène une mesure de mauvaise qualité à une qualité normale', () => {
    // 108 min pour 30 colis en qualité C (coefficient 1,8) = 2 min/colis normal.
    const cadence = mesurerLaCadence(
      [mesure(108, 30, { qualite: 'C' })],
      'fl-mise-en-place-vrac',
      QUALITE,
    )
    expect(cadence?.minutesParUnite).toBeCloseTo(2, 6)
  })

  it('ignore les mesures d’un autre bloc', () => {
    expect(
      mesurerLaCadence([mesure(60, 30, { blocId: 'autre' })], 'fl-mise-en-place-vrac', QUALITE),
    ).toBeNull()
  })

  it('ignore une mesure sans quantité', () => {
    expect(mesurerLaCadence([mesure(60, 0)], 'fl-mise-en-place-vrac', QUALITE)).toBeNull()
  })
})

describe('proposition de recalage', () => {
  it('ne propose rien tant que les mesures sont trop rares', () => {
    const peu = Array.from({ length: MESURES_MINIMUM - 1 }, (_, i) => mesure(60, 15, { id: `m${i}` }))
    expect(proposerUnRecalage(bloc(), peu, CONFIGURATION_FRUITS_LEGUMES)).toBeNull()
  })

  it('ne propose rien quand l’écart est négligeable', () => {
    // Le bloc est regle a 22 colis/h : on mesure quasiment la meme chose.
    const proches = Array.from({ length: 4 }, (_, i) => mesure(60, 22, { id: `m${i}` }))
    expect(proposerUnRecalage(bloc(), proches, CONFIGURATION_FRUITS_LEGUMES)).toBeNull()
  })

  it('propose un recalage progressif quand l’écart est net', () => {
    // 40 colis par heure mesures, contre 22 regles.
    const rapides = Array.from({ length: 5 }, (_, i) => mesure(60, 40, { id: `m${i}` }))
    const proposition = proposerUnRecalage(bloc(), rapides, CONFIGURATION_FRUITS_LEGUMES)

    expect(proposition).not.toBeNull()
    expect(proposition?.valeurActuelle).toBe(22)
    expect(proposition?.valeurMesuree).toBeCloseTo(40, 1)
    // 80 % de 22 plus 20 % de 40 = 25,6
    expect(proposition?.valeurProposee).toBeCloseTo(25.6, 2)
    expect(proposition?.nombreDeMesures).toBe(5)
    expect(Math.abs(proposition?.ecartPourcent ?? 0)).toBeGreaterThan(ECART_MINIMUM_POURCENT)
  })

  it('ne bouleverse jamais un paramètre d’un coup', () => {
    const tresRapides = Array.from({ length: 5 }, (_, i) => mesure(30, 60, { id: `m${i}` }))
    const proposition = proposerUnRecalage(bloc(), tresRapides, CONFIGURATION_FRUITS_LEGUMES)
    // La mesure vaut 120 colis/h, mais on ne propose qu'un pas vers elle.
    expect(proposition?.valeurProposee).toBeLessThan(45)
    expect(proposition?.valeurProposee).toBeGreaterThan(22)
  })

  it('ne propose rien pour un bloc qui ne se mesure pas à l’unité', () => {
    const reassort = CONFIGURATION_FRUITS_LEGUMES.blocs.find((b) => b.type === 'reassort')!
    const mesures = Array.from({ length: 5 }, (_, i) =>
      mesure(60, 30, { id: `m${i}`, blocId: reassort.id }),
    )
    expect(proposerUnRecalage(reassort, mesures, CONFIGURATION_FRUITS_LEGUMES)).toBeNull()
  })
})

describe('application du recalage', () => {
  it('modifie le bon paramètre selon le type de bloc', () => {
    const misEnPlace = appliquerLeRecalage(bloc(), 26)
    expect(misEnPlace.type === 'mise-en-place' && misEnPlace.cadenceColisParHeure).toBe(26)

    const reception = CONFIGURATION_FRUITS_LEGUMES.blocs.find((b) => b.type === 'reception')!
    const recale = appliquerLeRecalage(reception, 15)
    expect(recale.type === 'reception' && recale.minutesParPalette).toBe(15)
  })

  it('laisse intact un bloc qui ne se recale pas', () => {
    const comptoirFictif = CONFIGURATION_FRUITS_LEGUMES.blocs.find((b) => b.type === 'reassort')!
    expect(appliquerLeRecalage(comptoirFictif, 99)).toEqual(comptoirFictif)
  })
})

describe('unité de mesure du chrono', () => {
  it('choisit l’unité qui correspond au bloc', () => {
    expect(uniteDuBloc(bloc())).toBe('colis')
    const reception = CONFIGURATION_FRUITS_LEGUMES.blocs.find((b) => b.type === 'reception')!
    expect(uniteDuBloc(reception)).toBe('palette')
    const tri = CONFIGURATION_FRUITS_LEGUMES.blocs.find((b) => b.type === 'tri')!
    expect(uniteDuBloc(tri)).toBe('metre')
  })
})
