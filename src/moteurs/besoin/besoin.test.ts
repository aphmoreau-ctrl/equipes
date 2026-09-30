import { describe, expect, it } from 'vitest'
import { enMinutes, TRANCHES_PAR_JOUR } from '../../domaine/temps'
import {
  calculerBesoin,
  coefficientDuBloc,
  coefficientQualite,
  minutesBrutesDuBloc,
  minutesParBlocSurLaJournee,
  personnesNecessaires,
  pointeDeLaJournee,
  repartirSurLaPlage,
  tranchesDeLaPlage,
  valeurDuCoefficient,
} from './index'
import type { Bloc, ConfigurationRayon, ContexteJour } from './types'

/** Toutes les donnees de ce fichier sont FICTIVES. */

const TOUS_LES_JOURS = [1, 2, 3, 4, 5, 6, 7] as const

function configuration(modifications: Partial<ConfigurationRayon> = {}): ConfigurationRayon {
  return {
    rayonId: 'demo',
    taille: { metresLineaires: 20, etals: 4, meublesFroids: 2, nombreReferences: 150 },
    blocs: [],
    presenceMinimum: 0,
    tolerance: 0.2,
    coefficientsQualite: { A: 1, B: 1.3, C: 1.8, refus: 0.5 },
    coefficientsMeteo: { normal: 1, chaud: 1.1, 'tres-chaud': 1.25, froid: 0.95, pluie: 0.9 },
    coefficientsSaison: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 },
    coefficientPromotion: 1.2,
    ...modifications,
  }
}

function contexte(modifications: Partial<ContexteJour> = {}): ContexteJour {
  return {
    date: '2026-11-02', // un lundi
    clientsParTranche: new Array<number>(TRANCHES_PAR_JOUR).fill(0),
    tranchesOuvertes: new Set<number>(),
    meteo: 'normal',
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
    ...modifications,
  }
}

function tacheFixe(modifications: Partial<Bloc> = {}): Bloc {
  return {
    id: 'tache',
    nom: 'Relevé de températures',
    type: 'tache-fixe',
    actif: true,
    jours: [...TOUS_LES_JOURS],
    plage: { debut: '06:00', fin: '07:00' },
    competences: [],
    coefficients: [],
    minutes: 30,
    ...modifications,
  } as Bloc
}

// --------------------------------------------------------------- Formule

describe('nombre de personnes sur une tranche', () => {
  it('applique la formule du cahier des charges', () => {
    // 30 min de travail sur 30 min de tranche, tolerance 0,2 : une personne.
    expect(personnesNecessaires(30, 0, 0.2)).toBe(1)
    expect(personnesNecessaires(60, 0, 0.2)).toBe(2)
    expect(personnesNecessaires(90, 0, 0.2)).toBe(3)
  })

  it('absorbe les petites quantites grace a la tolerance', () => {
    // 6 minutes = 0,2 personne : absorbe. 7 minutes : une personne.
    expect(personnesNecessaires(6, 0, 0.2)).toBe(0)
    expect(personnesNecessaires(7, 0, 0.2)).toBe(1)
  })

  it('ne descend jamais sous la presence minimum pendant l ouverture', () => {
    expect(personnesNecessaires(0, 1, 0.2)).toBe(1)
    expect(personnesNecessaires(5, 2, 0.2)).toBe(2)
    expect(personnesNecessaires(90, 1, 0.2)).toBe(3)
  })

  it('ne renvoie jamais un nombre negatif', () => {
    expect(personnesNecessaires(0, 0, 0.5)).toBe(0)
  })

  it('suit une tolerance modifiee par l utilisateur', () => {
    expect(personnesNecessaires(35, 0, 0)).toBe(2)
    expect(personnesNecessaires(35, 0, 0.5)).toBe(1)
  })
})

// ----------------------------------------------------------- Repartition

describe('repartition sur une plage horaire', () => {
  it('couvre exactement les tranches de la plage', () => {
    expect(tranchesDeLaPlage({ debut: '06:00', fin: '08:00' })).toEqual([12, 13, 14, 15])
    expect(tranchesDeLaPlage({ debut: '06:00', fin: '06:30' })).toEqual([12])
  })

  it('refuse une plage ou la fin precede le debut', () => {
    expect(() => tranchesDeLaPlage({ debut: '08:00', fin: '06:00' })).toThrow(/Plage horaire/)
  })

  it('partage les minutes a parts egales', () => {
    const reparti = repartirSurLaPlage(120, { debut: '06:00', fin: '08:00' })
    expect(reparti[12]).toBe(30)
    expect(reparti[15]).toBe(30)
    expect(reparti.reduce((somme, valeur) => somme + valeur, 0)).toBe(120)
  })

  it('ne repartit rien quand il n y a rien a faire', () => {
    expect(repartirSurLaPlage(0, { debut: '06:00', fin: '08:00' }).every((v) => v === 0)).toBe(true)
  })
})

// ---------------------------------------------------------- Coefficients

describe('coefficient de qualite a la reception', () => {
  it('suppose une qualite A quand rien n a ete saisi', () => {
    expect(coefficientQualite(configuration(), contexte())).toBe(1)
  })

  it('prend le coefficient du niveau saisi', () => {
    const avecSaisie = contexte({
      saisiesQualite: [
        { id: 's1', date: '2026-11-02', rayonId: 'demo', produit: 'Fraises', quantite: 1, niveau: 'C' },
      ],
    })
    expect(coefficientQualite(configuration(), avecSaisie)).toBe(1.8)
  })

  it('pondere par les quantites receptionnees', () => {
    const avecSaisies = contexte({
      saisiesQualite: [
        { id: 's1', date: '2026-11-02', rayonId: 'demo', produit: 'Fraises', quantite: 1, niveau: 'C' },
        { id: 's2', date: '2026-11-02', rayonId: 'demo', produit: 'Pommes', quantite: 3, niveau: 'A' },
      ],
    })
    // (1 x 1,8 + 3 x 1,0) / 4 = 1,2
    expect(coefficientQualite(configuration(), avecSaisies)).toBeCloseTo(1.2, 10)
  })

  it('ignore les saisies d un autre rayon ou d un autre jour', () => {
    const ailleurs = contexte({
      saisiesQualite: [
        { id: 's1', date: '2026-11-02', rayonId: 'autre', produit: 'X', quantite: 5, niveau: 'C' },
        { id: 's2', date: '2026-11-03', rayonId: 'demo', produit: 'Y', quantite: 5, niveau: 'C' },
      ],
    })
    expect(coefficientQualite(configuration(), ailleurs)).toBe(1)
  })
})

describe('valeur de chaque coefficient', () => {
  it('lit le coefficient de saison du mois', () => {
    const config = configuration({ coefficientsSaison: { ...configuration().coefficientsSaison, 11: 1.4 } })
    expect(valeurDuCoefficient('saison', config, contexte())).toBe(1.4)
  })

  it('lit le coefficient de la meteo du jour', () => {
    expect(valeurDuCoefficient('meteo', configuration(), contexte({ meteo: 'tres-chaud' }))).toBe(1.25)
  })

  it('reprend le coefficient des evenements', () => {
    expect(valeurDuCoefficient('evenement', configuration(), contexte({ coefficientEvenements: 1.6 }))).toBe(1.6)
  })

  it('n applique la promotion que si le rayon est en promotion', () => {
    expect(valeurDuCoefficient('promotion', configuration(), contexte())).toBe(1)
    expect(valeurDuCoefficient('promotion', configuration(), contexte({ enPromotion: true }))).toBe(1.2)
  })
})

describe('coefficient d un bloc', () => {
  it('vaut 1 quand le bloc ne subit aucun coefficient', () => {
    expect(coefficientDuBloc(tacheFixe(), configuration(), contexte({ meteo: 'chaud' }))).toBe(1)
  })

  it('multiplie entre eux les coefficients declares', () => {
    const bloc = tacheFixe({ coefficients: ['meteo', 'promotion'] })
    const resultat = coefficientDuBloc(bloc, configuration(), contexte({ meteo: 'chaud', enPromotion: true }))
    expect(resultat).toBeCloseTo(1.1 * 1.2, 10)
  })
})

// ----------------------------------------------------------------- Blocs

describe('calcul de chaque type de bloc', () => {
  const jours = [...TOUS_LES_JOURS]

  it('reception : palettes multipliees par le temps de controle', () => {
    const bloc: Bloc = {
      id: 'rec', nom: 'Réception', type: 'reception', actif: true, jours,
      plage: { debut: '05:00', fin: '07:00' }, competences: ['réception'], coefficients: [],
      palettesParJour: { 1: 4, 2: 2, 3: 2, 4: 2, 5: 3, 6: 5, 7: 0 },
      minutesParPalette: 15,
    }
    const minutes = minutesBrutesDuBloc(bloc, configuration(), contexte())
    expect(minutes.reduce((s, v) => s + v, 0)).toBe(60) // 4 palettes x 15 min
  })

  it('mise en place : colis divises par la cadence', () => {
    const bloc: Bloc = {
      id: 'mep', nom: 'Mise en place', type: 'mise-en-place', actif: true, jours,
      plage: { debut: '05:00', fin: '09:00' }, competences: [], coefficients: [],
      colisParJour: { 1: 60, 2: 40, 3: 40, 4: 40, 5: 50, 6: 80, 7: 0 },
      cadenceColisParHeure: 30,
    }
    const minutes = minutesBrutesDuBloc(bloc, configuration(), contexte())
    expect(minutes.reduce((s, v) => s + v, 0)).toBe(120) // 60 colis / 30 par heure = 2 h
  })

  it('mise en place : refuse une cadence nulle', () => {
    const bloc: Bloc = {
      id: 'mep', nom: 'Mise en place', type: 'mise-en-place', actif: true, jours,
      plage: { debut: '05:00', fin: '09:00' }, competences: [], coefficients: [],
      colisParJour: { 1: 60, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
      cadenceColisParHeure: 0,
    }
    expect(() => minutesBrutesDuBloc(bloc, configuration(), contexte())).toThrow(/cadence/)
  })

  it('reassort : proportionnel aux clients presents', () => {
    const clients = new Array<number>(TRANCHES_PAR_JOUR).fill(0)
    clients[20] = 200 // 10:00
    clients[21] = 100
    const bloc: Bloc = {
      id: 'rea', nom: 'Réassort', type: 'reassort', actif: true, jours,
      plage: { debut: '09:00', fin: '12:00' }, competences: [], coefficients: [],
      minutesPour100Clients: 10,
    }
    const minutes = minutesBrutesDuBloc(bloc, configuration(), contexte({ clientsParTranche: clients }))
    expect(minutes[20]).toBe(20)
    expect(minutes[21]).toBe(10)
    expect(minutes.reduce((s, v) => s + v, 0)).toBe(30)
  })

  it('tri et facing : proportionnels aux metres lineaires', () => {
    const base = { actif: true, jours, plage: { debut: '09:00', fin: '10:00' }, competences: [], coefficients: [] }
    const tri: Bloc = { ...base, id: 'tri', nom: 'Tri', type: 'tri', minutesParMetre: 2 }
    const facing: Bloc = { ...base, id: 'fac', nom: 'Facing', type: 'facing', minutesParMetre: 1.5 }
    expect(minutesBrutesDuBloc(tri, configuration(), contexte()).reduce((s, v) => s + v, 0)).toBe(40)
    expect(minutesBrutesDuBloc(facing, configuration(), contexte()).reduce((s, v) => s + v, 0)).toBe(30)
  })

  it('controle des dates : proportionnel au nombre de references', () => {
    const bloc: Bloc = {
      id: 'dat', nom: 'Contrôle des dates', type: 'controle-dates', actif: true, jours,
      plage: { debut: '09:00', fin: '10:00' }, competences: [], coefficients: [],
      minutesParReference: 0.2,
    }
    expect(minutesBrutesDuBloc(bloc, configuration(), contexte()).reduce((s, v) => s + v, 0)).toBeCloseTo(30, 10)
  })

  it('nettoyage : proportionnel aux meubles et aux etals', () => {
    const bloc: Bloc = {
      id: 'net', nom: 'Nettoyage', type: 'nettoyage', actif: true, jours,
      plage: { debut: '19:00', fin: '20:00' }, competences: [], coefficients: [],
      minutesParMeuble: 10,
    }
    // 2 meubles froids + 4 etals = 6 x 10 min
    expect(minutesBrutesDuBloc(bloc, configuration(), contexte()).reduce((s, v) => s + v, 0)).toBe(60)
  })

  it('transformation : production, mise en route et nettoyage', () => {
    const bloc: Bloc = {
      id: 'tra', nom: 'Fruits découpés', type: 'transformation', actif: true, jours,
      plage: { debut: '06:00', fin: '09:00' }, competences: ['hygiène'], coefficients: [],
      produits: [
        { nom: 'Salade de fruits', quantite: 10, minutesParUnite: 4 },
        { nom: 'Jus pressé', quantite: 20, minutesParUnite: 2 },
      ],
      minutesMiseEnRoute: 15,
      minutesNettoyage: 25,
      postes: 2,
    }
    // 40 + 40 + 15 + 25 = 120
    expect(minutesBrutesDuBloc(bloc, configuration(), contexte()).reduce((s, v) => s + v, 0)).toBe(120)
  })

  it('ne compte rien un jour ou le bloc ne s applique pas', () => {
    const bloc = tacheFixe({ jours: [6, 7] }) // samedi et dimanche
    expect(minutesBrutesDuBloc(bloc, configuration(), contexte()).every((v) => v === 0)).toBe(true)
  })

  it('ne compte rien quand le bloc est desactive', () => {
    expect(minutesBrutesDuBloc(tacheFixe({ actif: false }), configuration(), contexte()).every((v) => v === 0)).toBe(true)
  })
})

// --------------------------------------------------------- Calcul complet

describe('calcul du besoin d une journee', () => {
  const blocs: Bloc[] = [
    tacheFixe({ id: 'temperatures', minutes: 30, plage: { debut: '06:00', fin: '06:30' } }),
    tacheFixe({ id: 'commandes', nom: 'Commandes', minutes: 60, plage: { debut: '06:00', fin: '07:00' } }),
  ]

  it('rend une valeur pour chacune des 48 tranches', () => {
    const besoin = calculerBesoin(configuration({ blocs }), contexte())
    expect(besoin.tranches).toHaveLength(48)
    expect(besoin.tranches[0]?.debutMinutes).toBe(0)
    expect(besoin.tranches[47]?.debutMinutes).toBe(enMinutes('23:30'))
  })

  it('additionne les minutes de tous les blocs', () => {
    const besoin = calculerBesoin(configuration({ blocs }), contexte())
    expect(besoin.minutesTotal).toBe(90)
    expect(besoin.heuresTotal).toBeCloseTo(1.5, 10)
  })

  it('decompose le travail bloc par bloc', () => {
    const besoin = calculerBesoin(configuration({ blocs }), contexte())
    const trancheSixHeures = besoin.tranches[12]
    expect(trancheSixHeures?.minutesParBloc['temperatures']).toBe(30)
    expect(trancheSixHeures?.minutesParBloc['commandes']).toBe(30)
    expect(trancheSixHeures?.minutesTotal).toBe(60)
    expect(trancheSixHeures?.personnes).toBe(2)
  })

  it('totalise les minutes par bloc sur la journee', () => {
    const besoin = calculerBesoin(configuration({ blocs }), contexte())
    expect(minutesParBlocSurLaJournee(besoin)).toEqual({ temperatures: 30, commandes: 60 })
  })

  it('donne la pointe de la journee', () => {
    expect(pointeDeLaJournee(calculerBesoin(configuration({ blocs }), contexte()))).toBe(2)
  })

  it('rassemble les competences requises par tranche', () => {
    const avecCompetence = tacheFixe({
      id: 'labo', nom: 'Laboratoire', competences: ['hygiène', 'découpe'],
      plage: { debut: '06:00', fin: '06:30' },
    })
    const besoin = calculerBesoin(configuration({ blocs: [avecCompetence] }), contexte())
    expect(besoin.tranches[12]?.competences).toEqual(['découpe', 'hygiène'])
    expect(besoin.tranches[20]?.competences).toEqual([])
  })

  it('impose la presence minimum pendant les heures d ouverture', () => {
    const ouvertures = new Set([16, 17, 18]) // 08:00 a 09:30
    const besoin = calculerBesoin(
      configuration({ blocs: [], presenceMinimum: 1 }),
      contexte({ tranchesOuvertes: ouvertures }),
    )
    expect(besoin.tranches[16]?.personnes).toBe(1)
    expect(besoin.tranches[15]?.personnes).toBe(0)
    expect(besoin.heuresPresence).toBeCloseTo(1.5, 10)
  })

  it('applique les coefficients aux blocs qui les declarent', () => {
    const sensible = tacheFixe({ id: 'sensible', minutes: 100, coefficients: ['meteo'] })
    const insensible = tacheFixe({ id: 'insensible', minutes: 100, coefficients: [] })
    const besoin = calculerBesoin(
      configuration({ blocs: [sensible, insensible] }),
      contexte({ meteo: 'tres-chaud' }),
    )
    const totaux = minutesParBlocSurLaJournee(besoin)
    expect(totaux['sensible']).toBeCloseTo(125, 10)
    expect(totaux['insensible']).toBeCloseTo(100, 10)
  })

  it('rend compte des coefficients appliques', () => {
    const besoin = calculerBesoin(
      configuration(),
      contexte({ meteo: 'chaud', enPromotion: true, coefficientEvenements: 1.5 }),
    )
    expect(besoin.coefficientsAppliques.meteo).toBe(1.1)
    expect(besoin.coefficientsAppliques.promotion).toBe(1.2)
    expect(besoin.coefficientsAppliques.evenement).toBe(1.5)
  })

  it('signale un depassement de capacite en transformation', () => {
    const bloc: Bloc = {
      id: 'labo', nom: 'Laboratoire', type: 'transformation', actif: true, jours: [...TOUS_LES_JOURS],
      plage: { debut: '06:00', fin: '07:00' }, competences: [], coefficients: [],
      produits: [{ nom: 'Barquettes', quantite: 100, minutesParUnite: 3 }],
      minutesMiseEnRoute: 0, minutesNettoyage: 0, postes: 2,
    }
    // 300 min sur 2 tranches = 150 min par tranche = 5 postes, pour 2 disponibles.
    const besoin = calculerBesoin(configuration({ blocs: [bloc] }), contexte())
    expect(besoin.alertes.some((alerte) => alerte.includes('postes en pointe'))).toBe(true)
  })

  it('signale le travail absorbe par la tolerance sans personne prevue', () => {
    const miette = tacheFixe({ id: 'miette', minutes: 4, plage: { debut: '06:00', fin: '06:30' } })
    const besoin = calculerBesoin(configuration({ blocs: [miette] }), contexte())
    expect(besoin.tranches[12]?.personnes).toBe(0)
    expect(besoin.alertes.some((alerte) => alerte.includes('tolérance'))).toBe(true)
  })

  it('rend le meme resultat a donnees egales', () => {
    const config = configuration({ blocs })
    expect(calculerBesoin(config, contexte())).toEqual(calculerBesoin(config, contexte()))
  })

  it('ne demande personne quand il n y a ni travail ni ouverture', () => {
    const besoin = calculerBesoin(configuration(), contexte())
    expect(besoin.minutesTotal).toBe(0)
    expect(besoin.heuresPresence).toBe(0)
    expect(besoin.tranches.every((tranche) => tranche.personnes === 0)).toBe(true)
  })
})
