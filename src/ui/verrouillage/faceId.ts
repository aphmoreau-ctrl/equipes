/**
 * Deverrouillage par le visage ou l'empreinte (Face ID sur iPhone et iPad,
 * Touch ID sur Mac), au moyen d'une CLE D'ACCES (norme WebAuthn / passkey).
 *
 * PORTEE REELLE DE CETTE PROTECTION - a lire avant de s'y fier :
 * l'application n'a pas encore de serveur. Elle demande donc a l'appareil de
 * verifier l'identite, puis fait confiance a sa reponse. C'est un verrou
 * d'ECRAN, comme le code : tres efficace contre un curieux, insuffisant
 * contre quelqu'un de competent qui aurait l'appareil en main. La vraie
 * protection viendra du lot 4, ou la cle d'acces sera verifiee par Firebase.
 *
 * Le code chiffre reste indispensable : c'est le secours quand Face ID
 * echoue, quand le visage n'est pas reconnu, ou sur un appareil qui ne sait
 * pas le faire.
 */

/** Ce qui est conserve sur l'appareil : l'identifiant de la cle, jamais une donnee biometrique. */
export interface CleAcces {
  readonly identifiant: string
  readonly cree: string
}

export type ResultatFaceId = 'reussi' | 'annule' | 'echec'

const DELAI_MS = 60_000

export function enBase64Url(donnees: ArrayBuffer): string {
  let binaire = ''
  for (const octet of new Uint8Array(donnees)) binaire += String.fromCharCode(octet)
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function depuisBase64Url(texte: string): Uint8Array<ArrayBuffer> {
  const base64 = texte.replace(/-/g, '+').replace(/_/g, '/')
  const complet = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binaire = atob(complet)
  const octets = new Uint8Array(binaire.length)
  for (let index = 0; index < binaire.length; index += 1) {
    octets[index] = binaire.charCodeAt(index)
  }
  return octets
}

function hasard(taille: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(taille))
}

/**
 * Vrai si cet appareil sait reconnaitre son proprietaire (Face ID, Touch ID).
 * Renvoie false sans jamais lever d'erreur : un appareil ancien ou un
 * navigateur qui ne connait pas la norme doit simplement garder le code.
 */
export async function faceIdDisponible(): Promise<boolean> {
  try {
    if (typeof window.PublicKeyCredential === 'undefined') return false
    const verification = window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    if (typeof verification !== 'function') return false
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/**
 * Enregistre une cle d'acces sur cet appareil.
 * Doit etre appelee depuis un geste de l'utilisateur (Safari l'exige).
 */
export async function creerCleAcces(): Promise<CleAcces> {
  const identification = await navigator.credentials.create({
    publicKey: {
      challenge: hasard(32),
      // « id » omis volontairement : l'appareil retient le site courant.
      rp: { name: 'Équipes' },
      user: {
        id: hasard(16),
        name: 'Équipes',
        displayName: 'Équipes — cet appareil',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        // « platform » : la cle reste sur l'appareil, pas de cle USB.
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      attestation: 'none',
      timeout: DELAI_MS,
    },
  })

  if (identification === null) {
    throw new Error("L’appareil n’a pas enregistré de clé d’accès.")
  }

  return {
    identifiant: enBase64Url((identification as PublicKeyCredential).rawId),
    cree: new Date().toISOString(),
  }
}

/**
 * Demande a l'appareil de reconnaitre son proprietaire.
 * Doit egalement etre appelee depuis un geste de l'utilisateur.
 */
export async function verifierCleAcces(cle: CleAcces): Promise<ResultatFaceId> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: hasard(32),
        allowCredentials: [{ type: 'public-key', id: depuisBase64Url(cle.identifiant) }],
        userVerification: 'required',
        timeout: DELAI_MS,
      },
    })
    return assertion === null ? 'echec' : 'reussi'
  } catch (probleme) {
    // L'utilisateur a ferme la demande, ou le visage n'a pas ete reconnu.
    if (probleme instanceof Error && probleme.name === 'NotAllowedError') return 'annule'
    return 'echec'
  }
}
