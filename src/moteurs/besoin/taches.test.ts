import { describe, expect, it } from 'vitest'
import type { TachePlanifiee } from '../../domaine/organisation'
import { CONFIGURATIONS_LA_VAUGINE, RAYON } from '../../donnees/modele-la-vaugine'
import { indexTranche, enMinutes } from '../../domaine/temps'
import { blocDeLaTache, calculerBesoin, configurationAvecTaches, joursDeLaTache } from './index'

const tache = (champs: Partial<TachePlanifiee>): TachePlanifiee => ({
  id: 't',
  nom: 'Emballage',
  nature: 'tache',
  actif: true,
  rayonId: RAYON.maree,
  competence: null,
  fonction: null,
  rayonsRepresentes: [],
  personnesDesignees: [],
  jours: [1, 2, 3, 4],
  moment: { type: 'libre' },
  dureeMinutes: 120,
  occurrencesParSemaine: null,
  fenetre: { debut: '13:00', fin: '17:00' },
  ...champs,
})

const tranche = (h: string) => indexTranche(enMinutes(h))
const LUNDI = '2026-11-02'
const VENDREDI = '2026-11-06'

function besoin(taches: TachePlanifiee[], date: string) {
  const configuration = CONFIGURATIONS_LA_VAUGINE.find((c) => c.rayonId === RAYON.maree)!
  return calculerBesoin(configurationAvecTaches(configuration, taches), {
    date,
    clientsParTranche: new Array<number>(96).fill(0),
    tranchesOuvertes: new Set(),
    meteo: 'normal',
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  })
}

describe('tâches de la fiche rayon', () => {
  it('ne comptent pas tant qu’il manque la plage, la durée ou les jours', () => {
    expect(blocDeLaTache(tache({ fenetre: null }))).toBeNull()
    expect(blocDeLaTache(tache({ dureeMinutes: null }))).toBeNull()
    expect(blocDeLaTache(tache({ jours: null }))).toBeNull()
    expect(blocDeLaTache(tache({ nature: 'reunion' }))).toBeNull()
  })

  it('font le nombre de fois voulu dans la semaine', () => {
    expect(joursDeLaTache(tache({ occurrencesParSemaine: 2 }))).toEqual([1, 2])
  })

  it('s’ajoutent à la présence en vente sur leur plage', () => {
    // 2 h a faire entre 13 h et 17 h : une demi-personne, arrondie a une.
    const sans = besoin([], LUNDI).tranches[tranche('14:00')]!
    const avec = besoin([tache({ personnes: 1 })], LUNDI).tranches[tranche('14:00')]!
    expect(avec.personnes).toBe(sans.personnes + 1)
    expect(avec.cible).toBe((sans.cible ?? 0) + 1)
    expect(besoin([tache({})], LUNDI).tranches[tranche('18:00')]?.personnes).toBe(sans.personnes)
  })

  it('n’ajoutent rien un jour où elles ne se font pas', () => {
    const sans = besoin([], VENDREDI).tranches[tranche('14:00')]!
    expect(besoin([tache({})], VENDREDI).tranches[tranche('14:00')]?.personnes).toBe(sans.personnes)
  })

  it('à heure fixe : la charge tombe sur l’heure, deux personnes = double', () => {
    const fixe = tache({ moment: { type: 'heure', heure: '06:30' }, dureeMinutes: 60, personnes: 2, fenetre: null })
    const bloc = blocDeLaTache(fixe)!
    expect(bloc.plage).toEqual({ debut: '06:30', fin: '07:30' })
    expect(bloc.minutes).toBe(120)
  })

  it('gardent les personnes désignées', () => {
    expect(blocDeLaTache(tache({ personnesDesignees: ['c-a'] }))?.personnesDesignees).toEqual(['c-a'])
  })
})
