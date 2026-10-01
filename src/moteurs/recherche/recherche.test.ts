import { describe, expect, it } from 'vitest'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { MAGASIN_DEMO } from '../../donnees/demo'
import { normaliser, rechercher, RESULTATS_MAXIMUM, type SourcesRecherche } from './index'

/** Donnees FICTIVES uniquement. */
const SOURCES: SourcesRecherche = {
  collaborateurs: COLLABORATEURS_DEMO,
  rayons: MAGASIN_DEMO.rayons,
  notes: [
    {
      id: 'n-1',
      date: '2026-09-28',
      titre: 'Inventaire du rayon',
      contenu: 'Comptage des invendus le lundi matin, avant ouverture.',
      importance: 'importante',
      type: 'consigne',
      rayonId: null,
    },
  ],
  documents: [
    {
      id: 'd-1',
      titre: 'Procédure chambre froide',
      categorie: 'procedure',
      contenu: 'Relever la température deux fois par jour.',
      misAJourLe: '2026-09-01',
      obligatoire: false,
    },
  ],
  formations: [],
  besoinsRecrutement: [],
}

describe('recherche globale', () => {
  it('ignore les majuscules et les accents', () => {
    expect(normaliser('  Marée  ÉTÉ ')).toBe('maree ete')
    const resultats = rechercher(SOURCES, 'CHAMBRE froide')
    expect(resultats.map((resultat) => resultat.id)).toContain('document-d-1')
  })

  it('trouve un collaborateur par son prenom', () => {
    const resultats = rechercher(SOURCES, 'camille')
    expect(resultats[0]?.type).toBe('collaborateur')
    expect(resultats[0]?.titre).toBe('Camille D.')
    expect(resultats[0]?.chemin).toBe('/equipe')
  })

  it('trouve un collaborateur par une competence', () => {
    const resultats = rechercher(SOURCES, 'decoupe')
    expect(resultats.some((resultat) => resultat.titre === 'Camille D.')).toBe(true)
  })

  it('exige que chaque mot apparaisse', () => {
    expect(rechercher(SOURCES, 'inventaire lundi')).toHaveLength(1)
    expect(rechercher(SOURCES, 'inventaire dimanche')).toHaveLength(0)
  })

  it('cherche aussi dans le contenu, mais classe d abord les titres', () => {
    const resultats = rechercher(SOURCES, 'rayon')
    const indexNote = resultats.findIndex((resultat) => resultat.id === 'note-n-1')
    const indexCollaborateur = resultats.findIndex((resultat) => resultat.type === 'collaborateur')
    expect(indexNote).toBeGreaterThanOrEqual(0)
    // « Inventaire du rayon » a le mot dans son titre ; un collaborateur
    // « Adjoint du rayon » aussi dans son poste, mais pas dans son nom.
    expect(indexNote).toBeLessThan(indexCollaborateur)
  })

  it('ne rend rien pour une recherche trop courte', () => {
    expect(rechercher(SOURCES, '')).toEqual([])
    expect(rechercher(SOURCES, ' a ')).toEqual([])
  })

  it('limite le nombre de resultats', () => {
    expect(rechercher(SOURCES, 'em').length).toBeLessThanOrEqual(RESULTATS_MAXIMUM)
  })

  it('n affiche jamais un nom de famille complet', () => {
    for (const resultat of rechercher(SOURCES, 'employe')) {
      expect(resultat.titre).toMatch(/^\S+ [A-ZÉ]\.$/)
    }
  })

  it('rend le meme resultat a donnees egales', () => {
    expect(rechercher(SOURCES, 'fruits')).toEqual(rechercher(SOURCES, 'fruits'))
  })
})
