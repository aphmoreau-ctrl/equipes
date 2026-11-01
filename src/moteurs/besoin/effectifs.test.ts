import { describe, expect, it } from 'vitest'
import type { GrilleEffectifs } from '../../domaine/organisation'
import { indexTranche, enMinutes } from '../../domaine/temps'
import { calculerBesoin, effectifDeLaTranche, type ContexteJour } from './index'
import { CONFIGURATIONS_LA_VAUGINE, RAYON } from '../../donnees/modele-la-vaugine'

const tranche = (heure: string) => indexTranche(enMinutes(heure))

const GRILLE: GrilleEffectifs = {
  competence: 'Marée',
  jours: {
    1: [
      { debut: '07:00', fin: '08:30', minimum: 1, cible: 1 },
      { debut: '11:00', fin: '13:00', minimum: 1, cible: 2 },
      { debut: '13:00', fin: '17:00', minimum: null, cible: null },
    ],
    2: [],
    3: [],
    4: [],
    5: null,
    6: [],
    7: [],
  },
  planchers: [
    { id: 'p', libelle: 'Présence', jours: [1, 5], debut: '08:30', fin: '20:00', minimum: 1 },
  ],
}

describe('effectif d’une tranche', () => {
  it('lit le minimum et la cible du créneau', () => {
    expect(effectifDeLaTranche(GRILLE, 1, tranche('11:00'))).toEqual({ minimum: 1, cible: 2 })
    expect(effectifDeLaTranche(GRILLE, 1, tranche('12:45'))).toEqual({ minimum: 1, cible: 2 })
  })

  it('s’arrête à la fin du créneau', () => {
    expect(effectifDeLaTranche(GRILLE, 1, tranche('06:45'))).toEqual({ minimum: 0, cible: 0 })
  })

  it('applique le plancher là où la grille ne demande rien', () => {
    expect(effectifDeLaTranche(GRILLE, 1, tranche('09:00'))).toEqual({ minimum: 1, cible: 1 })
  })

  it('ne remplit pas une valeur à définir, mais garde le plancher', () => {
    expect(effectifDeLaTranche(GRILLE, 1, tranche('14:00'))).toEqual({ minimum: 1, cible: 1 })
    expect(effectifDeLaTranche(GRILLE, 1, tranche('20:00'))).toEqual({ minimum: 0, cible: 0 })
  })

  it('tient le plancher un jour entier à définir', () => {
    expect(effectifDeLaTranche(GRILLE, 5, tranche('10:00'))).toEqual({ minimum: 1, cible: 1 })
    expect(effectifDeLaTranche(GRILLE, 5, tranche('07:00'))).toEqual({ minimum: 0, cible: 0 })
  })
})

function contexte(date: string): ContexteJour {
  return {
    date,
    clientsParTranche: new Array<number>(96).fill(0),
    tranchesOuvertes: new Set(),
    meteo: 'normal',
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  }
}

function besoin(rayonId: string, date: string) {
  const configuration = CONFIGURATIONS_LA_VAUGINE.find((c) => c.rayonId === rayonId)
  if (configuration === undefined) throw new Error(rayonId)
  return calculerBesoin(configuration, contexte(date))
}

// 2026-11-02 est un lundi.
const LUNDI = '2026-11-02'
const VENDREDI = '2026-11-06'
const SAMEDI = '2026-11-07'
const DIMANCHE = '2026-11-08'

describe('besoin d’un rayon piloté par sa grille', () => {
  it('Marée, lundi 11 h : minimum 1, cible 2, compétence exigée', () => {
    const t = besoin(RAYON.maree, LUNDI).tranches[tranche('11:00')]
    expect(t?.personnes).toBe(1)
    expect(t?.cible).toBe(2)
    expect(t?.competencesCritiques).toEqual(['Marée'])
    expect(t?.niveauxMinimum['Marée']).toBe(2)
  })

  it('Fruits & Légumes, lundi 6 h (ouverture) : 2 personnes, 3 souhaitées', () => {
    const t = besoin(RAYON.fruitsLegumes, LUNDI).tranches[tranche('06:00')]
    expect(t?.personnes).toBe(2)
    expect(t?.cible).toBe(3)
  })

  it('vendredi non encore défini : la présence permanente tient seule', () => {
    const b = besoin(RAYON.maree, VENDREDI)
    expect(b.tranches[tranche('09:00')]?.personnes).toBe(1)
    expect(b.tranches[tranche('07:00')]?.personnes).toBe(0)
  })

  it('Charcuterie / Fromage : deux personnes le samedi', () => {
    expect(besoin(RAYON.charcuterieFromage, SAMEDI).tranches[tranche('15:00')]?.personnes).toBe(2)
  })

  it('dimanche : présence de 8 h 30 à 12 h 30 seulement', () => {
    const b = besoin(RAYON.boucherieTrad, DIMANCHE)
    expect(b.tranches[tranche('12:15')]?.personnes).toBe(1)
    expect(b.tranches[tranche('12:30')]?.personnes).toBe(0)
  })

  it('Cuisine mobile : une personne le vendredi, personne le lundi', () => {
    expect(besoin(RAYON.cuisineMobile, VENDREDI).tranches[tranche('10:00')]?.personnes).toBe(1)
    expect(besoin(RAYON.cuisineMobile, LUNDI).heuresPresence).toBe(0)
  })

  it('Préparation traiteur : une personne le samedi, la semaine reste à définir', () => {
    expect(besoin(RAYON.preparationTraiteur, SAMEDI).tranches[tranche('07:00')]?.personnes).toBe(1)
    expect(besoin(RAYON.preparationTraiteur, LUNDI).heuresPresence).toBe(0)
  })

  it('Boucherie LS : personne n’est exigé de 19 h à 20 h, un est souhaité', () => {
    const t = besoin(RAYON.boucherieLs, LUNDI).tranches[tranche('19:00')]
    expect(t?.personnes).toBe(0)
    expect(t?.cible).toBe(1)
  })
})
