import { describe, expect, it } from 'vitest'
import { duree } from '../domaine/temps'
import { JOURS_SEMAINE } from '../domaine/calendrier'
import { clientsParTranche, tranchesOuvertes } from '../domaine/magasin'
import { calculerBesoin, pointeDeLaJournee, type ConfigurationRayon } from '../moteurs/besoin'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from './demo'
import {
  MODELE_BOUCHERIE,
  MODELE_BOULANGERIE,
  MODELE_CHARCUTERIE,
  MODELE_FROMAGE,
  MODELE_MAREE,
  MODELES_AUTRES_RAYONS,
} from './modeles-rayons'

/** Donnees FICTIVES uniquement. */

function contexteDemo(date: string, rayonId: string) {
  return {
    date,
    clientsParTranche: clientsParTranche(MAGASIN_DEMO, date),
    tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, date, rayonId),
    meteo: 'normal' as const,
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  }
}

describe('couverture des rayons', () => {
  it('modelise les neuf rayons', () => {
    expect(CONFIGURATIONS_DEMO).toHaveLength(9)
    expect(CONFIGURATIONS_DEMO.map((c) => c.rayonId).sort()).toEqual(
      MAGASIN_DEMO.rayons.map((r) => r.id).sort(),
    )
  })

  it('rattache chaque modele a un rayon qui existe', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      expect(MAGASIN_DEMO.rayons.some((r) => r.id === configuration.rayonId)).toBe(true)
    }
  })

  it('n utilise aucun identifiant de bloc en double, dans aucun rayon', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      const identifiants = configuration.blocs.map((bloc) => bloc.id)
      expect(new Set(identifiants).size).toBe(identifiants.length)
    }
  })

  it('donne des plages et des jours valides a tous les blocs', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      for (const bloc of configuration.blocs) {
        expect(duree(bloc.plage.debut, bloc.plage.fin)).toBeGreaterThan(0)
        expect(bloc.jours.length).toBeGreaterThan(0)
        for (const jour of bloc.jours) expect(JOURS_SEMAINE).toContain(jour)
      }
    }
  })

  it('donne un coefficient de saison pour les douze mois, dans chaque rayon', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      for (let mois = 1; mois <= 12; mois += 1) {
        expect(configuration.coefficientsSaison[mois]).toBeGreaterThan(0)
      }
    }
  })
})

describe('specificites annoncees au cahier des charges', () => {
  function typesDe(configuration: ConfigurationRayon): Set<string> {
    return new Set(configuration.blocs.map((bloc) => bloc.type))
  }

  it('boucherie : comptoir, format de livraison, laboratoire et nettoyage', () => {
    const types = typesDe(MODELE_BOUCHERIE)
    expect(types.has('comptoir')).toBe(true)
    expect(types.has('format-livraison')).toBe(true)
    expect(types.has('transformation')).toBe(true)
    expect(types.has('nettoyage')).toBe(true)
  })

  it('boucherie : au moins un boucher QUALIFIE derriere le comptoir', () => {
    const comptoir = MODELE_BOUCHERIE.blocs.find((bloc) => bloc.type === 'comptoir')
    expect(comptoir?.presenceMinimum).toBeGreaterThanOrEqual(1)
    // La competence est CRITIQUE : personne d'autre ne peut tenir le poste.
    expect(comptoir?.competences).toContainEqual({
      competence: 'boucherie',
      niveauMinimum: 2,
      critique: true,
    })
  })

  it('fromage : comptoir tenu avec celui de la charcuterie', () => {
    const comptoir = MODELE_FROMAGE.blocs.find((bloc) => bloc.type === 'comptoir')
    expect(comptoir?.type === 'comptoir' && comptoir.partageAvecRayon).toBe('charcuterie-traiteur')
  })

  it('un comptoir partage n exige personne de plus', () => {
    const seul = calculerBesoin(MODELE_CHARCUTERIE, contexteDemo('2026-11-06', 'charcuterie-traiteur'))
    const partage = calculerBesoin(MODELE_FROMAGE, contexteDemo('2026-11-06', 'fromage'))
    // La charcuterie impose sa presence minimum toute la journee, pas le fromage.
    expect(seul.heuresPresence).toBeGreaterThan(partage.heuresPresence)
  })

  it('maree : mise en glace le matin et demontage le soir', () => {
    const noms = MODELE_MAREE.blocs.map((bloc) => bloc.nom.toLowerCase())
    expect(noms.some((nom) => nom.includes('glace'))).toBe(true)
    expect(noms.some((nom) => nom.includes('démontage'))).toBe(true)
  })

  it('boulangerie : plan de cuisson le matin et l apres-midi', () => {
    const cuissons = MODELE_BOULANGERIE.blocs.filter((bloc) => bloc.type === 'plan-cuisson')
    expect(cuissons).toHaveLength(2)
  })

  it('les comptoirs imposent tous une presence minimum', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      for (const bloc of configuration.blocs) {
        if (bloc.type === 'comptoir') {
          expect(bloc.presenceMinimum ?? 0).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })
})

describe('besoin calcule pour chaque rayon', () => {
  const SEMAINE = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']

  it('produit un besoin plausible dans chaque rayon', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      const besoin = calculerBesoin(configuration, contexteDemo('2026-11-06', configuration.rayonId))
      expect(besoin.heuresTotal).toBeGreaterThan(1)
      expect(besoin.heuresTotal).toBeLessThan(80)
      expect(pointeDeLaJournee(besoin)).toBeGreaterThan(0)
    }
  })

  it('reste sous le budget hebdomadaire dans chaque rayon', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      const heures = SEMAINE.map(
        (date) => calculerBesoin(configuration, contexteDemo(date, configuration.rayonId)).heuresPresence,
      ).reduce((somme, valeur) => somme + valeur, 0)
      const budget = MAGASIN_DEMO.budgetHeuresParRayon[configuration.rayonId] ?? 0
      expect(heures, `budget dépassé pour ${configuration.rayonId}`).toBeLessThan(budget)
    }
  })

  it('ne signale aucun depassement de capacite sur les modeles fournis', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      for (const date of SEMAINE) {
        const besoin = calculerBesoin(configuration, contexteDemo(date, configuration.rayonId))
        expect(
          besoin.alertes.filter((a) => a.includes('postes en pointe')),
          `${configuration.rayonId} le ${date}`,
        ).toEqual([])
      }
    }
  })

  it('tient compte de la presence minimum au comptoir meme sans client', () => {
    // Dimanche matin : le magasin ouvre de 09:00 a 12:30.
    const besoin = calculerBesoin(MODELE_BOUCHERIE, contexteDemo('2026-11-08', 'boucherie'))
    const trancheDimancheMatin = besoin.tranches[19] // 09:30
    expect(trancheDimancheMatin?.personnes).toBeGreaterThanOrEqual(1)
  })

  it('n ouvre pas la maree le lundi, conformement au modele', () => {
    const lundi = calculerBesoin(MODELE_MAREE, contexteDemo('2026-11-02', 'maree'))
    const mardi = calculerBesoin(MODELE_MAREE, contexteDemo('2026-11-03', 'maree'))
    expect(lundi.heuresTotal).toBe(0)
    expect(mardi.heuresTotal).toBeGreaterThan(0)
  })

  it('demande plus de monde au comptoir le samedi que le mardi', () => {
    const mardi = calculerBesoin(MODELE_BOUCHERIE, contexteDemo('2026-11-03', 'boucherie'))
    const samedi = calculerBesoin(MODELE_BOUCHERIE, contexteDemo('2026-11-07', 'boucherie'))
    expect(pointeDeLaJournee(samedi)).toBeGreaterThanOrEqual(pointeDeLaJournee(mardi))
  })

  it('applique la saison des fetes en decembre', () => {
    const novembre = calculerBesoin(MODELE_BOUCHERIE, contexteDemo('2026-11-06', 'boucherie'))
    const decembre = calculerBesoin(MODELE_BOUCHERIE, contexteDemo('2026-12-04', 'boucherie'))
    expect(decembre.heuresTotal).toBeGreaterThan(novembre.heuresTotal)
  })

  it('compte huit modeles hors fruits et legumes', () => {
    expect(MODELES_AUTRES_RAYONS).toHaveLength(8)
  })
})
