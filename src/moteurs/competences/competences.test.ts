import { describe, expect, it } from 'vitest'
import type { Collaborateur } from '../../domaine/collaborateur'
import type { Formation } from '../../domaine/formation'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import {
  besoinsDeFormation,
  competencesConnues,
  couvertureDesCompetences,
  grilleDePolyvalence,
} from './index'

/** Donnees FICTIVES uniquement. */

function personne(id: string, competences: Record<string, 0 | 1 | 2 | 3>): Collaborateur {
  return {
    id, prenom: id, initiale: 'X.', serviceId: 'frais',
    rayonPrincipal: 'fruits-legumes', rayonsSecondaires: [], poste: 'Employé',
    statut: 'employe', niveauClassification: 'Niveau 2', contrat: 'cdi',
    heuresHebdomadaires: 35, tempsPlein: true, dateEntree: '2020-01-01',
    finPeriodeEssai: null, finContrat: null, disponibilites: [], competences,
    habilitations: [],
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    periodesFormation: [],
    trancheAge: 'majeur', contactAutorise: false, actif: true,
  }
}

describe('grille de polyvalence', () => {
  it('place les plus polyvalents en premier', () => {
    const grille = grilleDePolyvalence(
      [personne('a', { x: 2 }), personne('b', { x: 2, y: 3, z: 2 })],
      ['x', 'y', 'z'],
    )
    expect(grille[0]?.collaborateurId).toBe('b')
    expect(grille[0]?.polyvalence).toBe(3)
    expect(grille[1]?.polyvalence).toBe(1)
  })

  it('donne un niveau pour chaque compétence, même absente', () => {
    const grille = grilleDePolyvalence([personne('a', { x: 2 })], ['x', 'y'])
    expect(grille[0]?.niveaux).toEqual({ x: 2, y: 0 })
  })

  it('ignore les personnes sorties de l’effectif', () => {
    const sortie = { ...personne('a', { x: 3 }), actif: false }
    expect(grilleDePolyvalence([sortie], ['x'])).toEqual([])
  })
})

describe('couverture des compétences', () => {
  it('compte autonomes et apprentis', () => {
    const couverture = couvertureDesCompetences(
      [personne('a', { x: 2 }), personne('b', { x: 1 }), personne('c', { x: 3 })],
      ['x'],
    )
    expect(couverture[0]?.autonomes).toBe(2)
    expect(couverture[0]?.enApprentissage).toBe(1)
    expect(couverture[0]?.fragile).toBe(false)
  })

  it('signale une compétence tenue par une seule personne', () => {
    const couverture = couvertureDesCompetences([personne('a', { x: 2 })], ['x'])
    expect(couverture[0]?.fragile).toBe(true)
  })

  it('signale une compétence que personne ne tient', () => {
    const couverture = couvertureDesCompetences([personne('a', { x: 1 })], ['x'])
    expect(couverture[0]?.autonomes).toBe(0)
    expect(couverture[0]?.fragile).toBe(true)
  })

  it('place les compétences les plus fragiles en premier', () => {
    const couverture = couvertureDesCompetences(
      [personne('a', { solide: 2, fragile: 0 }), personne('b', { solide: 2 })],
      ['solide', 'fragile'],
    )
    expect(couverture[0]?.competence).toBe('fragile')
  })

  it('compte les formations prévues', () => {
    const formation: Formation = {
      id: 'f1', collaborateurId: 'b', intitule: 'Découpe', debut: '2027-01-05',
      fin: '2027-01-09', competenceVisee: 'x', niveauVise: 2, etat: 'prevue',
      habilitationDelivree: null,
    }
    const couverture = couvertureDesCompetences([personne('a', { x: 2 })], ['x'], [formation])
    expect(couverture[0]?.enFormation).toBe(1)
  })
})

describe('besoins de formation', () => {
  it('propose de former quand une seule personne est autonome', () => {
    const besoins = besoinsDeFormation(
      [personne('a', { x: 2 }), personne('b', { x: 1 })],
      ['x'],
    )
    expect(besoins).toHaveLength(1)
    expect(besoins[0]?.manque).toBe(1)
    expect(besoins[0]?.message).toContain('Une seule personne')
    expect(besoins[0]?.candidats[0]?.collaborateurId).toBe('b')
  })

  it('signale l’urgence quand personne n’est autonome', () => {
    const besoins = besoinsDeFormation([personne('a', { x: 1 })], ['x'])
    expect(besoins[0]?.message).toContain('la plus urgente')
    expect(besoins[0]?.manque).toBe(2)
  })

  it('ne propose rien quand deux personnes sont autonomes', () => {
    expect(besoinsDeFormation([personne('a', { x: 2 }), personne('b', { x: 3 })], ['x'])).toEqual([])
  })

  it('tient compte des formations déjà prévues', () => {
    const formation: Formation = {
      id: 'f1', collaborateurId: 'b', intitule: 'Découpe', debut: '2027-01-05',
      fin: '2027-01-09', competenceVisee: 'x', niveauVise: 2, etat: 'prevue',
      habilitationDelivree: null,
    }
    expect(besoinsDeFormation([personne('a', { x: 2 })], ['x'], [formation])).toEqual([])
  })

  it('classe les candidats par niveau atteint', () => {
    const besoins = besoinsDeFormation(
      [personne('a', { x: 2 }), personne('debutant', { x: 0 }), personne('avance', { x: 1 })],
      ['x'],
    )
    expect(besoins[0]?.candidats[0]?.collaborateurId).toBe('avance')
  })
})

describe('compétences connues', () => {
  it('rassemble toutes les compétences de l’équipe', () => {
    const competences = competencesConnues(COLLABORATEURS_DEMO)
    expect(competences).toContain('boucherie')
    expect(competences).toContain('mise en place')
    expect(competences.length).toBeGreaterThan(5)
  })

  it('accepte des compétences supplémentaires', () => {
    expect(competencesConnues([], ['nouvelle'])).toEqual(['nouvelle'])
  })

  it('n’en cite aucune deux fois', () => {
    const competences = competencesConnues(COLLABORATEURS_DEMO, ['boucherie'])
    expect(new Set(competences).size).toBe(competences.length)
  })
})
