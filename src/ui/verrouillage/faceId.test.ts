import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  creerCleAcces,
  depuisBase64Url,
  enBase64Url,
  faceIdDisponible,
  verifierCleAcces,
} from './faceId'

function definirSurFenetre(nom: string, valeur: unknown): void {
  Object.defineProperty(window, nom, { value: valeur, configurable: true, writable: true })
}

function simulerAppareil(reponses: {
  create?: () => Promise<unknown>
  get?: () => Promise<unknown>
}): void {
  Object.defineProperty(navigator, 'credentials', {
    value: {
      create: reponses.create ?? vi.fn(),
      get: reponses.get ?? vi.fn(),
    },
    configurable: true,
  })
}

afterEach(() => {
  definirSurFenetre('PublicKeyCredential', undefined)
})

describe('encodage base64url', () => {
  it('revient a l identique', () => {
    const origine = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
    expect(Array.from(depuisBase64Url(enBase64Url(origine.buffer)))).toEqual(Array.from(origine))
  })

  it('n utilise aucun caractere interdit dans une adresse', () => {
    const octets = new Uint8Array(64).map((_, index) => index * 3)
    expect(enBase64Url(octets.buffer)).not.toMatch(/[+/=]/)
  })

  it('gere les longueurs qui ne tombent pas juste', () => {
    for (const taille of [1, 2, 3, 4, 5, 16, 31]) {
      const octets = new Uint8Array(taille).fill(7)
      expect(depuisBase64Url(enBase64Url(octets.buffer))).toHaveLength(taille)
    }
  })
})

describe('faceIdDisponible', () => {
  it('renvoie false sur un appareil qui ne connait pas la norme', async () => {
    definirSurFenetre('PublicKeyCredential', undefined)
    expect(await faceIdDisponible()).toBe(false)
  })

  it('renvoie true quand l appareil sait reconnaitre son proprietaire', async () => {
    definirSurFenetre('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
    })
    expect(await faceIdDisponible()).toBe(true)
  })

  it('renvoie false quand l appareil repond non', async () => {
    definirSurFenetre('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(false),
    })
    expect(await faceIdDisponible()).toBe(false)
  })

  it('ne laisse jamais passer une erreur', async () => {
    definirSurFenetre('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => {
        throw new Error('indisponible')
      },
    })
    expect(await faceIdDisponible()).toBe(false)
  })
})

describe('creerCleAcces', () => {
  it('retient l identifiant rendu par l appareil', async () => {
    const rawId = new Uint8Array([1, 2, 3, 4]).buffer
    simulerAppareil({ create: () => Promise.resolve({ rawId }) })

    const cle = await creerCleAcces()
    expect(cle.identifiant).toBe(enBase64Url(rawId))
    expect(Date.parse(cle.cree)).not.toBeNaN()
  })

  it('signale clairement un refus de l appareil', async () => {
    simulerAppareil({ create: () => Promise.resolve(null) })
    await expect(creerCleAcces()).rejects.toThrow(/clé d’accès/)
  })
})

describe('verifierCleAcces', () => {
  const cle = { identifiant: enBase64Url(new Uint8Array([9, 9, 9]).buffer), cree: '2026-09-30' }

  it('reussit quand l appareil reconnait son proprietaire', async () => {
    simulerAppareil({ get: () => Promise.resolve({ id: 'peu-importe' }) })
    expect(await verifierCleAcces(cle)).toBe('reussi')
  })

  it('distingue une demande fermee par l utilisateur', async () => {
    const refus = new Error('refus')
    refus.name = 'NotAllowedError'
    simulerAppareil({ get: () => Promise.reject(refus) })
    expect(await verifierCleAcces(cle)).toBe('annule')
  })

  it('signale un echec pour toute autre erreur', async () => {
    simulerAppareil({ get: () => Promise.reject(new Error('panne')) })
    expect(await verifierCleAcces(cle)).toBe('echec')
  })

  it('signale un echec quand l appareil ne rend rien', async () => {
    simulerAppareil({ get: () => Promise.resolve(null) })
    expect(await verifierCleAcces(cle)).toBe('echec')
  })
})
