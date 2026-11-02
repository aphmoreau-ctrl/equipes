import { estAbsent, type Absence } from '../../domaine/absence'
import { ajouterJours, jourDeLaSemaine, lundiDeLaSemaine } from '../../domaine/calendrier'
import type { Vacation } from '../regles'

/**
 * Dimanche travaille : un jour de repos COMPLET la semaine avant ou apres
 * (regle d'Arnaud, reglable : regles internes).
 *
 * Module pur, partage par le controle de la semaine et le generateur.
 *
 * - « La semaine avant » : du lundi au samedi qui precedent ce dimanche.
 * - « La semaine apres » : du lundi au samedi qui le suivent.
 * - Un jour de repos complet : aucun poste, et pas d'absence ni de conge
 *   (un conge paye n'est pas un repos).
 */

/** Du lundi au samedi de la semaine de ce dimanche, puis de la suivante. */
export function semainesAutourDuDimanche(dimanche: string): { avant: string[]; apres: string[] } {
  const lundi = lundiDeLaSemaine(dimanche)
  return {
    avant: [0, 1, 2, 3, 4, 5].map((n) => ajouterJours(lundi, n)),
    apres: [7, 8, 9, 10, 11, 12].map((n) => ajouterJours(lundi, n)),
  }
}

/** Jours de repos complets d'une personne parmi ces dates. */
export function joursDeReposComplets(
  dates: readonly string[],
  collaborateurId: string,
  vacations: readonly Vacation[],
  absences: readonly Absence[],
): string[] {
  return dates.filter(
    (jour) =>
      !vacations.some((v) => v.collaborateurId === collaborateurId && v.jour === jour) &&
      !estAbsent(absences, collaborateurId, jour),
  )
}

/** Dimanches travailles par une personne. */
export function dimanchesTravailles(collaborateurId: string, vacations: readonly Vacation[]): string[] {
  return [
    ...new Set(
      vacations
        .filter((v) => v.collaborateurId === collaborateurId && jourDeLaSemaine(v.jour) === 7)
        .map((v) => v.jour),
    ),
  ].sort()
}

export type EtatReposDimanche = 'tenu' | 'manque' | 'a-prevoir'

/**
 * Pour un dimanche travaille : repos tenu (avant ou apres), manquant, ou
 * encore a prevoir la semaine suivante (pas encore planifiee).
 */
export function reposAutourDuDimanche(
  dimanche: string,
  collaborateurId: string,
  vacations: readonly Vacation[],
  absences: readonly Absence[],
  semaineSuivanteConnue: boolean,
): EtatReposDimanche {
  const { avant, apres } = semainesAutourDuDimanche(dimanche)
  if (joursDeReposComplets(avant, collaborateurId, vacations, absences).length > 0) return 'tenu'
  if (!semaineSuivanteConnue) return 'a-prevoir'
  return joursDeReposComplets(apres, collaborateurId, vacations, absences).length > 0 ? 'tenu' : 'manque'
}
