import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'

/**
 * jsdom ne fournit pas « crypto.subtle ». On installe l'implementation de Node,
 * identique a celle du navigateur, pour que le calcul d'empreinte du code de
 * verrouillage soit teste dans les memes conditions qu'en production.
 */
if (globalThis.crypto?.subtle === undefined) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}
