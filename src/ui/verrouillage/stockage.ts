import type { Verrou } from './code'
import type { CleAcces } from './faceId'

/**
 * Conservation du verrou et de la cle d'acces sur l'appareil.
 *
 * Le stockage du navigateur peut etre indisponible (navigation privee,
 * donnees de site bloquees) : chaque acces est donc protege. L'application
 * doit continuer a fonctionner meme si rien ne peut etre enregistre.
 */
const CLE_VERROU = 'equipes.verrou.v1'
const CLE_ACCES = 'equipes.cle-acces.v1'

function lire<T>(cle: string, estValide: (valeur: unknown) => valeur is T): T | null {
  try {
    const brut = window.localStorage.getItem(cle)
    if (brut === null) return null
    const valeur: unknown = JSON.parse(brut)
    return estValide(valeur) ? valeur : null
  } catch {
    return null
  }
}

function ecrire(cle: string, valeur: unknown): void {
  try {
    window.localStorage.setItem(cle, JSON.stringify(valeur))
  } catch {
    // Stockage indisponible : la donnee sera redemandee au prochain lancement.
  }
}

function supprimer(cle: string): void {
  try {
    window.localStorage.removeItem(cle)
  } catch {
    // Rien a faire : il n'y avait deja rien d'enregistre.
  }
}

function estVerrou(valeur: unknown): valeur is Verrou {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    typeof (valeur as Verrou).sel === 'string' &&
    typeof (valeur as Verrou).empreinte === 'string'
  )
}

function estCleAcces(valeur: unknown): valeur is CleAcces {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    typeof (valeur as CleAcces).identifiant === 'string' &&
    (valeur as CleAcces).identifiant.length > 0
  )
}

export function lireVerrou(): Verrou | null {
  return lire(CLE_VERROU, estVerrou)
}

export function enregistrerVerrou(verrou: Verrou): void {
  ecrire(CLE_VERROU, verrou)
}

export function effacerVerrou(): void {
  supprimer(CLE_VERROU)
}

export function lireCleAcces(): CleAcces | null {
  return lire(CLE_ACCES, estCleAcces)
}

export function enregistrerCleAcces(cle: CleAcces): void {
  ecrire(CLE_ACCES, cle)
}

export function effacerCleAcces(): void {
  supprimer(CLE_ACCES)
}
