import { describe, expect, it } from 'vitest'
import { MODULES, moduleParChemin } from './modules'

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
      'parametres',
    ]
    expect(MODULES.map((module) => module.id).sort()).toEqual([...attendus].sort())
  })

  it('ne declare pret que ce qui est reellement construit a l etape 0', () => {
    expect(MODULES.filter((module) => module.pret).map((module) => module.id)).toEqual([
      'parametres',
    ])
  })

  it('retrouve un module par son chemin', () => {
    expect(moduleParChemin('/planning')?.titre).toBe('Planning')
    expect(moduleParChemin('/inconnu')).toBeUndefined()
  })
})
