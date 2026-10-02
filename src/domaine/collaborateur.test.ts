import { describe, expect, it } from 'vitest'
import { COLLABORATEURS_DEMO } from '../donnees/collaborateurs-demo'
import { MAGASIN_DEMO } from '../donnees/demo'
import {
  capaciteHebdomadaire,
  collaborateursDuRayon,
  disponibiliteDuJour,
  estAutonome,
  estDisponible,
  minutesHebdomadaires,
  niveauDeCompetence,
  nomAffiche,
  peutTravaillerDans,
  rayonsPossibles,
} from './collaborateur'

/** Donnees FICTIVES uniquement. */

const CAMILLE = COLLABORATEURS_DEMO[0]!
const LUCAS = COLLABORATEURS_DEMO.find((c) => c.id === 'c-04')!

describe('identite affichee', () => {
  it('se limite au prenom et a l initiale', () => {
    expect(nomAffiche(CAMILLE)).toBe('Camille D.')
  })

  it('n expose jamais de nom de famille complet dans les donnees de demonstration', () => {
    for (const collaborateur of COLLABORATEURS_DEMO) {
      expect(collaborateur.initiale).toMatch(/^[A-ZÉÈÀÇ]\.$/)
    }
  })
})

describe('contrat', () => {
  it('convertit les heures du contrat en minutes', () => {
    expect(minutesHebdomadaires(CAMILLE)).toBe(2100)
    expect(minutesHebdomadaires(LUCAS)).toBe(720)
  })

  it('distingue temps plein et temps partiel', () => {
    expect(CAMILLE.tempsPlein).toBe(true)
    expect(LUCAS.tempsPlein).toBe(false)
  })
})

describe('disponibilites', () => {
  it('considere disponible par defaut', () => {
    expect(estDisponible(CAMILLE, 1)).toBe(true)
    expect(disponibiliteDuJour(CAMILLE, 1).plage).toBeNull()
  })

  it('respecte une indisponibilite declaree', () => {
    const sofia = COLLABORATEURS_DEMO.find((c) => c.id === 'c-03')!
    expect(estDisponible(sofia, 3)).toBe(false)
    expect(estDisponible(sofia, 2)).toBe(true)
  })

  it('respecte une plage restreinte', () => {
    expect(estDisponible(LUCAS, 6)).toBe(true)
    expect(disponibiliteDuJour(LUCAS, 6).plage).toEqual({ debut: '05:00', fin: '14:00' })
    expect(estDisponible(LUCAS, 1)).toBe(false)
  })
})

describe('competences', () => {
  it('renvoie zero pour une competence absente', () => {
    expect(niveauDeCompetence(CAMILLE, 'boucherie')).toBe(0)
    expect(estAutonome(CAMILLE, 'boucherie')).toBe(false)
  })

  it('considere autonome a partir du niveau 2', () => {
    expect(estAutonome(CAMILLE, 'mise en place')).toBe(true)
    expect(estAutonome(LUCAS, 'mise en place')).toBe(true)
  })
})

describe('rayons', () => {
  it('reunit le rayon principal et les secondaires', () => {
    expect(rayonsPossibles(CAMILLE)).toEqual(['fruits-legumes', 'cremerie'])
    expect(peutTravaillerDans(CAMILLE, 'cremerie')).toBe(true)
    expect(peutTravaillerDans(CAMILLE, 'boucherie')).toBe(false)
  })

  it('liste les personnes pouvant intervenir dans un rayon', () => {
    const equipe = collaborateursDuRayon(COLLABORATEURS_DEMO, 'fruits-legumes')
    expect(equipe.length).toBeGreaterThan(4)
    expect(equipe.map(nomAffiche)).toEqual([...equipe.map(nomAffiche)].sort((a, b) => a.localeCompare(b, 'fr')))
  })

  it('rattache chaque collaborateur a un rayon qui existe', () => {
    const identifiants = MAGASIN_DEMO.rayons.map((rayon) => rayon.id)
    for (const collaborateur of COLLABORATEURS_DEMO) {
      expect(identifiants).toContain(collaborateur.rayonPrincipal)
      for (const secondaire of collaborateur.rayonsSecondaires) {
        expect(identifiants).toContain(secondaire)
      }
    }
  })
})

describe('capacite', () => {
  it('additionne les heures contractuelles d un rayon', () => {
    const heures = capaciteHebdomadaire(COLLABORATEURS_DEMO, 'fruits-legumes')
    expect(heures).toBe(35 + 35 + 30 + 12 + 35)
  })

  it('ne compte pas les rayons secondaires dans la capacite du rayon', () => {
    expect(capaciteHebdomadaire(COLLABORATEURS_DEMO, 'fromage')).toBe(35)
  })
})

describe('equipe de demonstration', () => {
  it('compte entre quinze et trente personnes', () => {
    expect(COLLABORATEURS_DEMO.length).toBeGreaterThanOrEqual(15)
    expect(COLLABORATEURS_DEMO.length).toBeLessThanOrEqual(30)
  })

  it('n utilise aucun identifiant en double', () => {
    const identifiants = COLLABORATEURS_DEMO.map((c) => c.id)
    expect(new Set(identifiants).size).toBe(identifiants.length)
  })

  it('couvre les neuf rayons', () => {
    const rayons = new Set(COLLABORATEURS_DEMO.map((c) => c.rayonPrincipal))
    expect(rayons.size).toBe(9)
  })

  it('mélange les contrats et les durées, comme une vraie équipe', () => {
    const contrats = new Set(COLLABORATEURS_DEMO.map((c) => c.contrat))
    expect(contrats.size).toBeGreaterThanOrEqual(4)
    expect(COLLABORATEURS_DEMO.some((c) => !c.tempsPlein)).toBe(true)
  })
})
