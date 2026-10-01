import { describe, expect, it } from 'vitest'
import { etatInitial, VERSION_ETAT } from './etat'
import {
  creerSauvegarde,
  FORMAT_SAUVEGARDE,
  lireSauvegarde,
  nomDuFichier,
  resumerSauvegarde,
} from './sauvegarde'

/** Donnees FICTIVES uniquement. */
const MAINTENANT = new Date('2026-10-01T08:30:00Z')

describe('sauvegarde sur fichier', () => {
  it('restaure exactement ce qui a ete sauvegarde', () => {
    const etat = { ...etatInitial(), demonstration: false, chiffreAffairesParSemaine: { '2026-09-28': 41000 } }
    const lecture = lireSauvegarde(creerSauvegarde(etat, MAINTENANT))
    expect(lecture.ok).toBe(true)
    if (!lecture.ok) return
    expect(lecture.etat).toEqual(etat)
    expect(lecture.exporteLe).toBe('2026-10-01T08:30:00.000Z')
  })

  it('nomme le fichier avec la date du jour', () => {
    expect(nomDuFichier(MAINTENANT)).toBe('equipes-sauvegarde-2026-10-01.json')
  })

  it('refuse un fichier illisible', () => {
    const lecture = lireSauvegarde('{pas du json')
    expect(lecture.ok).toBe(false)
  })

  it('refuse un JSON qui n est pas une sauvegarde', () => {
    expect(lireSauvegarde('{"nom":"autre chose"}').ok).toBe(false)
    expect(lireSauvegarde('[1,2,3]').ok).toBe(false)
    expect(lireSauvegarde('null').ok).toBe(false)
  })

  it('refuse une sauvegarde d une version plus recente', () => {
    const texte = JSON.stringify({
      format: FORMAT_SAUVEGARDE,
      version: VERSION_ETAT + 1,
      exporteLe: '',
      donnees: etatInitial(),
    })
    const lecture = lireSauvegarde(texte)
    expect(lecture.ok).toBe(false)
    if (lecture.ok) return
    expect(lecture.raison).toMatch(/plus récente/)
  })

  it('refuse une sauvegarde endommagee', () => {
    const texte = JSON.stringify({
      format: FORMAT_SAUVEGARDE,
      version: VERSION_ETAT,
      donnees: { ...etatInitial(), collaborateurs: 'abime' },
    })
    expect(lireSauvegarde(texte).ok).toBe(false)
  })

  it('complete une ancienne sauvegarde avec les champs apparus depuis', () => {
    const { notes: _notes, documents: _documents, ...ancien } = etatInitial()
    const texte = JSON.stringify({ format: FORMAT_SAUVEGARDE, version: VERSION_ETAT, donnees: ancien })
    const lecture = lireSauvegarde(texte)
    expect(lecture.ok).toBe(true)
    if (!lecture.ok) return
    expect(lecture.etat.notes).toEqual([])
    expect(lecture.etat.documents).toEqual([])
  })

  it('resume le contenu avant restauration', () => {
    expect(resumerSauvegarde(etatInitial())).toMatch(/^20 collaborateurs, 0 semaine de planning/)
  })
})
