import { describe, expect, it } from 'vitest'
import {
  codeCorrespond,
  codeValide,
  creerVerrou,
  empreinte,
  genererSel,
  messageDeValidation,
} from './code'

describe('validation du code', () => {
  it('accepte 4 a 6 chiffres', () => {
    for (const code of ['0000', '12345', '987654']) {
      expect(codeValide(code)).toBe(true)
      expect(messageDeValidation(code)).toBeNull()
    }
  })

  it('refuse un code trop court, trop long, ou contenant autre chose que des chiffres', () => {
    expect(messageDeValidation('123')).toMatch(/au moins 4 chiffres/)
    expect(messageDeValidation('1234567')).toMatch(/dépasser 6 chiffres/)
    expect(messageDeValidation('12a4')).toMatch(/que des chiffres/)
    expect(messageDeValidation('')).toMatch(/au moins 4 chiffres/)
  })
})

describe('empreinte du code', () => {
  it('donne toujours le meme resultat pour un meme code et un meme sel', async () => {
    const sel = genererSel()
    expect(await empreinte('4242', sel)).toBe(await empreinte('4242', sel))
  })

  it('donne un resultat different si le code change', async () => {
    const sel = genererSel()
    expect(await empreinte('4242', sel)).not.toBe(await empreinte('4243', sel))
  })

  it('donne un resultat different sur deux appareils, meme avec le meme code', async () => {
    expect(await empreinte('4242', genererSel())).not.toBe(await empreinte('4242', genererSel()))
  })

  it('produit une empreinte SHA-256 complete', async () => {
    expect(await empreinte('4242', 'sel-de-test')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('sel', () => {
  it('tire un sel different a chaque appel', () => {
    expect(genererSel()).not.toBe(genererSel())
  })

  it('produit 16 octets en hexadecimal', () => {
    expect(genererSel()).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('verrou', () => {
  it('reconnait le bon code', async () => {
    const verrou = await creerVerrou('4242')
    expect(await codeCorrespond('4242', verrou)).toBe(true)
  })

  it('refuse un code faux', async () => {
    const verrou = await creerVerrou('4242')
    expect(await codeCorrespond('4243', verrou)).toBe(false)
    expect(await codeCorrespond('424', verrou)).toBe(false)
    expect(await codeCorrespond('', verrou)).toBe(false)
  })

  it('n enregistre jamais le code en clair', async () => {
    const verrou = await creerVerrou('4242')
    expect(JSON.stringify(verrou)).not.toContain('4242')
  })

  it('refuse de creer un verrou avec un code invalide', async () => {
    await expect(creerVerrou('12')).rejects.toThrow(/au moins 4 chiffres/)
  })
})
