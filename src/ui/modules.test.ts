import { describe, expect, it } from 'vitest'
import { IDS_ONGLETS, MODULES, moduleParChemin, modulesPrincipaux, modulesSecondaires } from './modules'

describe('carte des modules', () => {
  it('n utilise aucun identifiant en double', () => {
    const identifiants = MODULES.map((module) => module.id)
    expect(new Set(identifiants).size).toBe(identifiants.length)
  })

  it('n utilise aucun chemin en double', () => {
    const chemins = MODULES.map((module) => module.chemin)
    expect(new Set(chemins).size).toBe(chemins.length)
  })

  it('definit un seul ecran d accueil', () => {
    expect(MODULES.filter((module) => module.chemin === '/')).toHaveLength(1)
  })

  it('fait commencer tous les chemins par une barre oblique', () => {
    for (const module of MODULES) {
      expect(module.chemin.startsWith('/')).toBe(true)
    }
  })

  it('donne a chaque module un titre, un resume et un moment de livraison', () => {
    for (const module of MODULES) {
      expect(module.titre.trim().length).toBeGreaterThan(0)
      expect(module.resume.trim().length).toBeGreaterThan(10)
      expect(module.livraison.trim().length).toBeGreaterThan(0)
    }
  })

  it('couvre les modules attendus du cahier des charges', () => {
    const attendus = [
      'aujourdhui',
      'planning',
      'besoin',
      'equipe',
      'alertes',
      'heures',
      'conges',
      'competences',
      'pilotage',
      'communication',
      'documents',
      'parametres',
    ]
    expect(MODULES.map((module) => module.id).sort()).toEqual([...attendus].sort())
  })

  it('ne declare pret que ce qui est reellement construit', () => {
    // A mettre a jour a chaque lot livre.
    expect(MODULES.filter((module) => module.pret).map((module) => module.id)).toEqual([
      'aujourdhui',
      'planning',
      'besoin',
      'equipe',
      'alertes',
      'heures',
      'conges',
      'competences',
      'pilotage',
      'parametres',
    ])
  })

  it('retrouve un module par son chemin', () => {
    expect(moduleParChemin('/planning')?.titre).toBe('Planning')
    expect(moduleParChemin('/inconnu')).toBeUndefined()
  })
})


describe('repartition entre les onglets de l iPhone et le menu « Plus »', () => {
  it('place quatre onglets, dans l ordre voulu', () => {
    expect(modulesPrincipaux().map((module) => module.id)).toEqual([
      'aujourdhui',
      'planning',
      'equipe',
      'besoin',
    ])
  })

  it('met tous les autres modules derriere « Plus »', () => {
    const secondaires = modulesSecondaires().map((module) => module.id)
    expect(secondaires).toContain('parametres')
    expect(secondaires).toContain('documents')
    expect(secondaires).toContain('alertes')
    expect(secondaires).not.toContain('planning')
  })

  it('n oublie et ne duplique aucun module', () => {
    const principaux = modulesPrincipaux().map((module) => module.id)
    const secondaires = modulesSecondaires().map((module) => module.id)
    const reunis = [...principaux, ...secondaires]

    expect(new Set(reunis).size).toBe(reunis.length)
    expect(reunis.sort()).toEqual(MODULES.map((module) => module.id).sort())
  })

  it('ne designe comme onglet que des modules qui existent', () => {
    for (const identifiant of IDS_ONGLETS) {
      expect(MODULES.some((module) => module.id === identifiant)).toBe(true)
    }
  })

  it('garde une barre d onglets tenable : quatre onglets plus « Plus »', () => {
    expect(modulesPrincipaux()).toHaveLength(4)
  })
})
