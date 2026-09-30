/**
 * Verrouillage de l'application par un code chiffre.
 *
 * PORTEE REELLE DE CETTE PROTECTION - a lire avant de s'y fier :
 * un code de 4 a 6 chiffres empeche un curieux d'ouvrir l'application sur un
 * iPad laisse sans surveillance. Ce n'est PAS une protection des donnees :
 * un code court se devine par essais successifs, et le code ne chiffre rien.
 * La vraie protection viendra du lot 4 (Firebase + authentification), ou les
 * donnees seront derriere un compte et des regles de securite par utilisateur.
 *
 * Le code lui-meme n'est jamais enregistre : seule son empreinte SHA-256,
 * calculee avec un sel tire au hasard, est conservee sur l'appareil.
 */

export const LONGUEUR_MINIMALE = 4
export const LONGUEUR_MAXIMALE = 6

/** Ce qui est conserve sur l'appareil : jamais le code. */
export interface Verrou {
  readonly sel: string
  readonly empreinte: string
}

/** Vrai si le code respecte la longueur attendue et ne contient que des chiffres. */
export function codeValide(code: string): boolean {
  return messageDeValidation(code) === null
}

/**
 * Renvoie le probleme a afficher a l'utilisateur, ou null si le code convient.
 * Les messages sont en francais et destines a etre montres tels quels.
 */
export function messageDeValidation(code: string): string | null {
  if (code.length < LONGUEUR_MINIMALE) {
    return `Le code doit comporter au moins ${LONGUEUR_MINIMALE} chiffres.`
  }
  if (code.length > LONGUEUR_MAXIMALE) {
    return `Le code ne peut pas dépasser ${LONGUEUR_MAXIMALE} chiffres.`
  }
  if (!/^\d+$/.test(code)) {
    return 'Le code ne doit contenir que des chiffres.'
  }
  return null
}

function enHexadecimal(octets: Uint8Array): string {
  let texte = ''
  for (const octet of octets) texte += octet.toString(16).padStart(2, '0')
  return texte
}

/** Sel tire au hasard, different sur chaque appareil. */
export function genererSel(): string {
  return enHexadecimal(crypto.getRandomValues(new Uint8Array(16)))
}

/** Empreinte SHA-256 du code, liee au sel. */
export async function empreinte(code: string, sel: string): Promise<string> {
  const donnees = new TextEncoder().encode(`${sel}:${code}`)
  const resume = await crypto.subtle.digest('SHA-256', donnees)
  return enHexadecimal(new Uint8Array(resume))
}

/** Prepare le verrou a enregistrer pour un nouveau code. */
export async function creerVerrou(code: string): Promise<Verrou> {
  const probleme = messageDeValidation(code)
  if (probleme !== null) throw new Error(probleme)
  const sel = genererSel()
  return { sel, empreinte: await empreinte(code, sel) }
}

/** Vrai si le code saisi correspond au verrou enregistre. */
export async function codeCorrespond(code: string, verrou: Verrou): Promise<boolean> {
  if (messageDeValidation(code) !== null) return false
  return (await empreinte(code, verrou.sel)) === verrou.empreinte
}
