import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { REQUETE_COLONNE, useDisposition } from './useDisposition'

/** Simule un ecran de taille donnee, comme le ferait un vrai appareil. */
function simulerEcran(largeur: number, hauteur: number): void {
  Object.defineProperty(window, 'matchMedia', {
    value: (requete: string) => ({
      matches: requete === REQUETE_COLONNE && largeur >= 768 && hauteur >= 600,
      media: requete,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true })
})

describe('choix de la disposition', () => {
  it('donne le menu lateral sur iPad, debout comme couche', () => {
    simulerEcran(768, 1024)
    expect(renderHook(() => useDisposition()).result.current).toBe('colonne')

    simulerEcran(1024, 768)
    expect(renderHook(() => useDisposition()).result.current).toBe('colonne')
  })

  it('donne la barre d onglets sur iPhone debout', () => {
    simulerEcran(390, 844)
    expect(renderHook(() => useDisposition()).result.current).toBe('onglets')
  })

  it('garde la barre d onglets sur iPhone couche, malgre la largeur', () => {
    // Un iPhone couche fait plus de 768 points de large mais seulement 430 de
    // haut : un menu lateral y serait inutilisable.
    simulerEcran(932, 430)
    expect(renderHook(() => useDisposition()).result.current).toBe('onglets')
  })

  it('donne le menu lateral sur un ecran de Mac', () => {
    simulerEcran(1512, 950)
    expect(renderHook(() => useDisposition()).result.current).toBe('colonne')
  })

  it('choisit les onglets quand le navigateur ne sait pas mesurer l ecran', () => {
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true })
    expect(renderHook(() => useDisposition()).result.current).toBe('onglets')
  })
})
