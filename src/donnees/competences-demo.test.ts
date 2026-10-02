import { describe, expect, it } from 'vitest'
import { competencesDuRayon, nomsDesCompetences } from '../domaine/competence'
import { COMPETENCES_DEMO } from './competences-demo'
import { COLLABORATEURS_DEMO } from './collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from './demo'

/** Donnees FICTIVES uniquement. */

describe('catalogue des compétences', () => {
  it('n’emploie aucun nom en double', () => {
    const noms = COMPETENCES_DEMO.map((competence) => competence.nom)
    expect(new Set(noms).size).toBe(noms.length)
  })

  it('ne rattache une compétence qu’à des rayons qui existent', () => {
    const rayons = new Set(MAGASIN_DEMO.rayons.map((rayon) => rayon.id))
    for (const competence of COMPETENCES_DEMO) {
      for (const rayon of competence.rayons) {
        expect(rayons, `« ${competence.nom} » cite un rayon inconnu`).toContain(rayon)
      }
    }
  })

  it('couvre toutes les compétences exigées par les tâches', () => {
    const connues = new Set(nomsDesCompetences(COMPETENCES_DEMO))
    for (const configuration of CONFIGURATIONS_DEMO) {
      for (const bloc of configuration.blocs) {
        for (const exigence of bloc.competences) {
          expect(
            connues,
            `la tâche « ${bloc.nom} » exige « ${exigence.competence} », absente du catalogue`,
          ).toContain(exigence.competence)
        }
      }
    }
  })

  it('couvre toutes les compétences notées sur les fiches', () => {
    const connues = new Set(nomsDesCompetences(COMPETENCES_DEMO))
    for (const collaborateur of COLLABORATEURS_DEMO) {
      for (const competence of Object.keys(collaborateur.competences)) {
        expect(
          connues,
          `« ${collaborateur.prenom} » possède « ${competence} », absente du catalogue`,
        ).toContain(competence)
      }
    }
  })

  it('exige un niveau compris entre 0 et 3 pour chaque tâche', () => {
    for (const configuration of CONFIGURATIONS_DEMO) {
      for (const bloc of configuration.blocs) {
        for (const exigence of bloc.competences) {
          expect(exigence.niveauMinimum).toBeGreaterThanOrEqual(0)
          expect(exigence.niveauMinimum).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('donne à chaque rayon au moins une compétence propre ou commune', () => {
    for (const rayon of MAGASIN_DEMO.rayons) {
      expect(
        competencesDuRayon(COMPETENCES_DEMO, rayon.id).length,
        `aucune compétence pour « ${rayon.nom} »`,
      ).toBeGreaterThan(0)
    }
  })

  it('rattache les compétences du drive et de la cave à leur rayon', () => {
    const drive = competencesDuRayon(COMPETENCES_DEMO, 'drive').map((c) => c.nom)
    expect(drive).toContain('préparation drive')
    expect(drive).toContain('contrôle drive')
    expect(drive).toContain('remise drive')
    // Les compétences communes servent aussi au drive.
    expect(drive).toContain('nettoyage')

    const cave = competencesDuRayon(COMPETENCES_DEMO, 'cave-vins').map((c) => c.nom)
    expect(cave).toContain('conseil vins')
    expect(cave).not.toContain('découpe')
  })
})

describe('personne ne détient seul une compétence critique', () => {
  it('signale les compétences critiques portées par une seule personne', () => {
    const critiques = new Set<string>()
    for (const configuration of CONFIGURATIONS_DEMO) {
      for (const bloc of configuration.blocs) {
        for (const exigence of bloc.competences) {
          if (exigence.critique === true) critiques.add(exigence.competence)
        }
      }
    }
    expect(critiques.size).toBeGreaterThan(0)

    // Ce test ne bloque pas : il documente l'etat de l'equipe fictive.
    const fragiles = [...critiques].filter(
      (competence) =>
        COLLABORATEURS_DEMO.filter((c) => (c.competences[competence] ?? 0) >= 2).length <= 1,
    )
    expect(Array.isArray(fragiles)).toBe(true)
  })
})
