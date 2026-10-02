import { describe, expect, it } from 'vitest'
import { duree } from '../domaine/temps'
import { JOURS_SEMAINE } from '../domaine/calendrier'
import { clientsDuJour, clientsParTranche, rayonsActifs, tranchesOuvertes } from '../domaine/magasin'
import { calculerBesoin } from '../moteurs/besoin'
import {
  CONFIGURATION_FRUITS_LEGUMES,
  CONFIGURATIONS_DEMO,
  HORAIRES_TYPES_DEMO,
  MAGASIN_DEMO,
  RAYONS_DEMO,
  configurationDuRayon,
} from './demo'

describe('magasin de demonstration', () => {
  it('reprend les neuf rayons du service', () => {
    expect(RAYONS_DEMO).toHaveLength(9)
    expect(rayonsActifs(MAGASIN_DEMO, 'frais')).toHaveLength(9)
  })

  it('n utilise aucun identifiant de rayon en double', () => {
    const identifiants = RAYONS_DEMO.map((rayon) => rayon.id)
    expect(new Set(identifiants).size).toBe(identifiants.length)
  })

  it('numerote les rayons de 1 a 9 sans trou', () => {
    expect(RAYONS_DEMO.map((rayon) => rayon.ordre)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('donne des horaires coherents chaque jour', () => {
    for (const jour of JOURS_SEMAINE) {
      const horaires = MAGASIN_DEMO.horaires[jour]
      expect(horaires.ouvert).toBe(true)
      expect(duree(horaires.ouverture, horaires.fermeture)).toBeGreaterThan(0)
    }
  })

  it('donne un budget d heures a chaque rayon', () => {
    for (const rayon of RAYONS_DEMO) {
      expect(MAGASIN_DEMO.budgetHeuresParRayon[rayon.id]).toBeGreaterThan(0)
    }
  })
})

describe('frequentation de demonstration', () => {
  it('decrit la journee en 48 tranches', () => {
    expect(MAGASIN_DEMO.frequentation.profilHoraire).toHaveLength(48)
  })

  it('totalise cent pour cent', () => {
    const somme = MAGASIN_DEMO.frequentation.profilHoraire.reduce((s, v) => s + v, 0)
    expect(somme).toBeCloseTo(100, 6)
  })

  it('repartit exactement les clients du jour', () => {
    const date = '2026-11-06' // un vendredi
    const parTranche = clientsParTranche(MAGASIN_DEMO, date)
    const somme = parTranche.reduce((s, v) => s + v, 0)
    expect(somme).toBeCloseTo(clientsDuJour(MAGASIN_DEMO, date), 6)
  })

  it('n attend aucun client quand le magasin est ferme', () => {
    const parTranche = clientsParTranche(MAGASIN_DEMO, '2026-11-02')
    expect(parTranche[10]).toBe(0) // 05:00
    expect(parTranche[45]).toBe(0) // 22:30
  })

  it('attend plus de clients le samedi que le mardi', () => {
    expect(clientsDuJour(MAGASIN_DEMO, '2026-11-07')).toBeGreaterThan(
      clientsDuJour(MAGASIN_DEMO, '2026-11-03'),
    )
  })
})

describe('horaires types de demonstration', () => {
  it('decrit des vacations conformes au plafond legal', () => {
    for (const horaire of HORAIRES_TYPES_DEMO) {
      const amplitude = duree(horaire.debut, horaire.fin)
      expect(amplitude).toBeGreaterThan(horaire.pauseMinutes)
      expect(amplitude - horaire.pauseMinutes).toBeLessThanOrEqual(600)
    }
  })
})

describe('modele du rayon fruits et legumes', () => {
  it('est rattache au bon rayon et retrouvable', () => {
    expect(CONFIGURATION_FRUITS_LEGUMES.rayonId).toBe('fruits-legumes')
    expect(configurationDuRayon('fruits-legumes')).toBe(CONFIGURATION_FRUITS_LEGUMES)
    expect(configurationDuRayon('rayon-inexistant')).toBeUndefined()
  })

  it('n utilise aucun identifiant de bloc en double', () => {
    const identifiants = CONFIGURATION_FRUITS_LEGUMES.blocs.map((bloc) => bloc.id)
    expect(new Set(identifiants).size).toBe(identifiants.length)
  })

  it('couvre les blocs annonces au cahier des charges pour ce rayon', () => {
    const types = new Set(CONFIGURATION_FRUITS_LEGUMES.blocs.map((bloc) => bloc.type))
    // Etals vrac et libre-service, balances, transformation, tri, reassort.
    for (const attendu of ['reception', 'mise-en-place', 'transformation', 'balances', 'tri', 'reassort']) {
      expect(types.has(attendu as never)).toBe(true)
    }
  })

  it('fait dependre la mise en place de la qualite a la reception', () => {
    const misesEnPlace = CONFIGURATION_FRUITS_LEGUMES.blocs.filter((b) => b.type === 'mise-en-place')
    expect(misesEnPlace.length).toBeGreaterThan(0)
    for (const bloc of misesEnPlace) {
      expect(bloc.coefficients).toContain('qualite')
    }
  })

  it('rend le rayon sensible a la meteo et a la saison', () => {
    expect(CONFIGURATION_FRUITS_LEGUMES.coefficientsMeteo['tres-chaud']).toBeGreaterThan(1)
    expect(CONFIGURATION_FRUITS_LEGUMES.coefficientsSaison[7]).toBeGreaterThan(
      CONFIGURATION_FRUITS_LEGUMES.coefficientsSaison[1] ?? 0,
    )
  })

  it('donne un coefficient de saison pour les douze mois', () => {
    for (let mois = 1; mois <= 12; mois += 1) {
      expect(CONFIGURATION_FRUITS_LEGUMES.coefficientsSaison[mois]).toBeGreaterThan(0)
    }
  })

  it('donne des plages horaires valides a tous les blocs', () => {
    for (const bloc of CONFIGURATION_FRUITS_LEGUMES.blocs) {
      expect(duree(bloc.plage.debut, bloc.plage.fin)).toBeGreaterThan(0)
      expect(bloc.jours.length).toBeGreaterThan(0)
    }
  })
})

describe('besoin calcule sur les donnees de demonstration', () => {
  function contexteDemo(date: string) {
    return {
      date,
      clientsParTranche: clientsParTranche(MAGASIN_DEMO, date),
      tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, date, 'fruits-legumes'),
      meteo: 'normal' as const,
      coefficientEvenements: 1,
      enPromotion: false,
      saisiesQualite: [],
    }
  }

  it('produit un besoin plausible un jour de semaine', () => {
    const besoin = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, contexteDemo('2026-11-02'))
    expect(besoin.heuresTotal).toBeGreaterThan(5)
    expect(besoin.heuresTotal).toBeLessThan(60)
    expect(besoin.tranches).toHaveLength(48)
  })

  it('demande plus de monde le samedi que le mardi', () => {
    const mardi = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, contexteDemo('2026-11-03'))
    const samedi = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, contexteDemo('2026-11-07'))
    expect(samedi.heuresTotal).toBeGreaterThan(mardi.heuresTotal)
  })

  it('reste sous le budget hebdomadaire du rayon', () => {
    const semaine = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
    const heures = semaine
      .map((date) => calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, contexteDemo(date)).heuresPresence)
      .reduce((somme, valeur) => somme + valeur, 0)
    expect(heures).toBeGreaterThan(0)
    expect(heures).toBeLessThan(MAGASIN_DEMO.budgetHeuresParRayon['fruits-legumes'] ?? 0)
  })

  it('augmente le besoin quand la qualite a la reception se degrade', () => {
    const normal = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, contexteDemo('2026-11-02'))
    const mauvaiseQualite = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, {
      ...contexteDemo('2026-11-02'),
      saisiesQualite: [
        { id: 'q1', date: '2026-11-02', rayonId: 'fruits-legumes', produit: 'Fraises', quantite: 6, niveau: 'C' },
      ],
    })
    expect(mauvaiseQualite.heuresTotal).toBeGreaterThan(normal.heuresTotal)
  })

  it('augmente le besoin par forte chaleur', () => {
    const normal = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, contexteDemo('2026-11-02'))
    const canicule = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, {
      ...contexteDemo('2026-11-02'),
      meteo: 'tres-chaud',
    })
    expect(canicule.heuresTotal).toBeGreaterThan(normal.heuresTotal)
  })

  it('ne signale aucune anomalie sur le modele fourni', () => {
    for (const date of ['2026-11-02', '2026-11-07', '2026-11-08']) {
      const besoin = calculerBesoin(CONFIGURATION_FRUITS_LEGUMES, contexteDemo(date))
      expect(besoin.alertes.filter((a) => a.includes('postes en pointe'))).toEqual([])
    }
  })
})

describe('configurations disponibles', () => {
  it('couvre les neuf rayons', () => {
    expect(CONFIGURATIONS_DEMO).toHaveLength(9)
    expect(CONFIGURATIONS_DEMO[0]?.rayonId).toBe('fruits-legumes')
  })
})
