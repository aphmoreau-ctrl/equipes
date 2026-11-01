import { describe, expect, it } from 'vitest'
import { appliquerGrillesDuWeekEnd, journeesARemplir } from './grilles-week-end'
import { construireEtatReel } from './import-equipe'
import { RAYON } from './modele-la-vaugine'
import type { EtatApplication } from './etat'

/** Une equipe importee AVANT les grilles du week-end : vendredi-dimanche vides. */
function anciennesDonnees(): EtatApplication {
  const etat = construireEtatReel([{ prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] }])
  return {
    ...etat,
    configurations: etat.configurations.map((c) =>
      c.grilleEffectifs === undefined || ![RAYON.maree, RAYON.fruitsLegumes].includes(c.rayonId as never)
        ? c
        : { ...c, grilleEffectifs: { ...c.grilleEffectifs, jours: { ...c.grilleEffectifs.jours, 5: null, 6: null, 7: null } } },
    ),
    organisation: { ...etat.organisation, plagesAffluence: { ...etat.organisation.plagesAffluence, 6: null } },
  }
}

describe('grilles du week-end', () => {
  it('remplit les jours encore à définir, et l’affluence du samedi', () => {
    const avant = anciennesDonnees()
    expect(journeesARemplir(avant)).toBe(6)
    const { etat, journees, affluenceSamedi } = appliquerGrillesDuWeekEnd(avant)
    expect(journees).toBe(6)
    expect(affluenceSamedi).toBe(true)
    const maree = etat.configurations.find((c) => c.rayonId === RAYON.maree)!.grilleEffectifs!
    expect(maree.jours[6]?.[2]).toMatchObject({ debut: '10:00', fin: '13:00', minimum: 2, cible: 3, provisoire: true })
    expect(maree.jours[7]?.[1]).toMatchObject({ debut: '08:30', fin: '12:45', minimum: 1, cible: 1 })
    expect(etat.organisation.plagesAffluence[6]).toEqual([
      { debut: '10:00', fin: '13:00' },
      { debut: '15:00', fin: '19:00' },
    ])
    expect(journeesARemplir(etat)).toBe(0)
  })

  it('n’écrase jamais un jour déjà saisi', () => {
    const avant = anciennesDonnees()
    const saisi = {
      ...avant,
      configurations: avant.configurations.map((c) =>
        c.rayonId === RAYON.maree
          ? { ...c, grilleEffectifs: { ...c.grilleEffectifs!, jours: { ...c.grilleEffectifs!.jours, 5: [{ debut: '06:30', fin: '20:00', minimum: 4, cible: 4 }] } } }
          : c,
      ),
    }
    const { etat } = appliquerGrillesDuWeekEnd(saisi)
    expect(etat.configurations.find((c) => c.rayonId === RAYON.maree)!.grilleEffectifs!.jours[5]).toEqual([
      { debut: '06:30', fin: '20:00', minimum: 4, cible: 4 },
    ])
  })

  it('les ouvertures suivent les horaires du rayon ce jour-là', () => {
    const { etat } = appliquerGrillesDuWeekEnd(anciennesDonnees())
    const fl = etat.configurations.find((c) => c.rayonId === RAYON.fruitsLegumes)!.grilleEffectifs!
    expect(fl.jours[5]?.[0]?.debut).toBe('05:00')
    expect(fl.jours[7]?.[0]?.debut).toBe('07:00')
  })
})

describe('horaires de la préparation traiteur', () => {
  it('fin à 12 h en semaine, 13 h 30 le samedi, grille comprise', async () => {
    const { appliquerHorairesDeLaPreparation, horairesDeLaPreparationAAppliquer } = await import('./grilles-week-end')
    const etat = construireEtatReel([{ prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.preparationTraiteur] }])
    // Donnees importees avant la reponse : 13 h 30 partout, a confirmer.
    const ancien = {
      ...etat,
      magasin: {
        ...etat.magasin,
        rayons: etat.magasin.rayons.map((r) =>
          r.id === RAYON.preparationTraiteur
            ? {
                ...r,
                horairesAConfirmer: [1, 2, 3, 4, 5, 6] as const,
                horairesPropres: { ...r.horairesPropres!, 1: { ouvert: true, ouverture: '06:00', fermeture: '13:30' } },
              }
            : r,
        ),
      },
      configurations: etat.configurations.map((c) =>
        c.rayonId === RAYON.preparationTraiteur
          ? { ...c, grilleEffectifs: { ...c.grilleEffectifs!, jours: { ...c.grilleEffectifs!.jours, 1: [{ debut: '06:00', fin: '13:30', minimum: null, cible: null }] } } }
          : c,
      ),
    }
    expect(horairesDeLaPreparationAAppliquer(ancien)).toBe(true)
    const apres = appliquerHorairesDeLaPreparation(ancien)
    const rayon = apres.magasin.rayons.find((r) => r.id === RAYON.preparationTraiteur)!
    expect(rayon.horairesPropres![1].fermeture).toBe('12:00')
    expect(rayon.horairesPropres![6].fermeture).toBe('13:30')
    expect(rayon.horairesAConfirmer).toEqual([])
    expect(apres.configurations.find((c) => c.rayonId === RAYON.preparationTraiteur)!.grilleEffectifs!.jours[1]![0]!.fin).toBe('12:00')
    expect(horairesDeLaPreparationAAppliquer(apres)).toBe(false)
  })
})
