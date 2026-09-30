import { dureeMaximaleQuotidienne } from './regles/duree-maximale-quotidienne'
import type { Infraction, ParametresRegles, Regle, Vacation } from './types'

/**
 * Regles effectivement implementees a ce jour.
 *
 * Les autres regles du §8 sont deja declarees dans « types.ts » et deja
 * reglables dans « parametres.ts » : il suffira de les ajouter a cette liste,
 * sans rien modifier ailleurs dans l'application.
 */
export const REGLES_IMPLEMENTEES: readonly Regle[] = [dureeMaximaleQuotidienne]

/**
 * Passe un ensemble de vacations au crible de toutes les regles implementees.
 * Le resultat est trie : a donnees egales, l'ordre est toujours le meme.
 */
export function verifier(
  vacations: readonly Vacation[],
  parametres: ParametresRegles,
): Infraction[] {
  const infractions = REGLES_IMPLEMENTEES.flatMap((regle) => regle.verifier(vacations, parametres))

  return infractions.sort(
    (a, b) =>
      a.collaborateurId.localeCompare(b.collaborateurId) ||
      a.jour.localeCompare(b.jour) ||
      a.regle.localeCompare(b.regle),
  )
}

/** Compte les manquements par severite, pour afficher un resume. */
export function resumerInfractions(infractions: readonly Infraction[]): {
  readonly bloquantes: number
  readonly avertissements: number
} {
  let bloquantes = 0
  let avertissements = 0
  for (const infraction of infractions) {
    if (infraction.severite === 'bloquante') bloquantes += 1
    else avertissements += 1
  }
  return { bloquantes, avertissements }
}
