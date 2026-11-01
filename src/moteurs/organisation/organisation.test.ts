import { describe, expect, it } from 'vitest'
import { joursEnTexte, pointsADefinir } from './index'
import {
  CONFIGURATIONS_LA_VAUGINE,
  MAGASIN_LA_VAUGINE,
  ORGANISATION_LA_VAUGINE,
} from '../../donnees/modele-la-vaugine'
import { etatInitial } from '../../donnees/etat'

const MODELE = {
  magasin: MAGASIN_LA_VAUGINE,
  configurations: CONFIGURATIONS_LA_VAUGINE,
  organisation: ORGANISATION_LA_VAUGINE,
  collaborateurs: [],
}

describe('jours en texte', () => {
  it('écrit les suites et les listes en français', () => {
    expect(joursEnTexte([6])).toBe('samedi')
    expect(joursEnTexte([5, 6, 7])).toBe('vendredi au dimanche')
    expect(joursEnTexte([1, 3])).toBe('lundi et mercredi')
    expect(joursEnTexte([1, 3, 5])).toBe('lundi, mercredi et vendredi')
  })
})

describe('points à définir', () => {
  const points = pointsADefinir(MODELE)
  const libelles = points.map((p) => p.libelle)

  it('marque provisoires les effectifs donnés, semaine et week-end', () => {
    for (const rayon of ['Fruits & Légumes', 'Marée', 'Charcuterie / Fromage', 'Boucherie Trad', 'Boucherie LS']) {
      expect(libelles).toContain(`${rayon} : effectifs du lundi au dimanche à affiner.`)
      expect(libelles.some((l) => l.startsWith(`${rayon} : effectifs du vendredi`))).toBe(false)
    }
    expect(libelles.some((l) => l.startsWith('Fraîche découpe : effectifs'))).toBe(false)
  })

  it('relève l’effectif de semaine et les heures de fin de la préparation traiteur', () => {
    expect(libelles).toContain('Préparation traiteur & charcuterie : minimum et cible du lundi au vendredi.')
    expect(libelles).toContain(
      'Préparation traiteur & charcuterie : heure de fin du lundi au samedi à confirmer.',
    )
  })

  it('relève les personnes à désigner quand l’équipe n’est pas encore là', () => {
    expect(libelles).toContain('Samedi en préparation traiteur : désignez au moins deux personnes qui tournent.')
    expect(libelles).toContain('Réunion managers : aucune personne n’a la fonction « Manager ».')
  })

  it('garde les questions RH tant qu’elles ne sont pas vérifiées', () => {
    expect(points.filter((p) => p.nature === 'a-verifier')).toHaveLength(2)
    const verifie = {
      ...MODELE,
      organisation: {
        ...ORGANISATION_LA_VAUGINE,
        pointsAVerifier: ORGANISATION_LA_VAUGINE.pointsAVerifier.map((p) => ({ ...p, verifie: true })),
      },
    }
    expect(pointsADefinir(verifie).filter((p) => p.nature === 'a-verifier')).toHaveLength(0)
  })

  it('ne signale rien pour la démonstration', () => {
    const etat = etatInitial()
    expect(pointsADefinir(etat)).toEqual([])
  })

  it('a des identifiants uniques', () => {
    expect(new Set(points.map((p) => p.id)).size).toBe(points.length)
  })
})
