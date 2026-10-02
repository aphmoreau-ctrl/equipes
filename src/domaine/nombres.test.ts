import { describe, expect, it } from 'vitest'
import { ecartEnTexte, eurosEnTexte, heuresEnTexte, nombreEnTexte } from './nombres'

describe('nombres a la francaise', () => {
  it('sépare les décimales par une virgule', () => {
    expect(nombreEnTexte(794.5)).toBe('794,5')
    expect(nombreEnTexte(0)).toBe('0,0')
    expect(nombreEnTexte(35)).toBe('35,0')
  })

  it('arrondit au nombreEnTexte de décimales demandé', () => {
    expect(nombreEnTexte(1.25, 2)).toBe('1,25')
    expect(nombreEnTexte(1.249, 2)).toBe('1,25')
    expect(nombreEnTexte(1.2, 0)).toBe('1')
  })

  it('écrit les heuresEnTexte avec leur unité', () => {
    expect(heuresEnTexte(794.5)).toBe('794,5 h')
    expect(heuresEnTexte(0)).toBe('0,0 h')
  })

  it('signe toujours les écarts, avec un vrai signe moins', () => {
    expect(ecartEnTexte(2.5)).toBe('+2,5')
    expect(ecartEnTexte(-10)).toBe('−10,0')
  })

  it('n’écrit jamais « −0,0 » : un écart nul est nul', () => {
    expect(ecartEnTexte(0)).toBe('0,0')
    expect(ecartEnTexte(-0)).toBe('0,0')
    expect(ecartEnTexte(-0.01)).toBe('0,0')
    expect(nombreEnTexte(-0)).toBe('0,0')
  })

  it('écrit les sommes avec deux décimales et une espace insécable', () => {
    expect(eurosEnTexte(1234.5)).toBe('1 234,50 €')
    expect(eurosEnTexte(18)).toBe('18,00 €')
  })
})
