import type { Collaborateur } from '../../domaine/collaborateur'
import { dureeMaximaleHebdomadaire, dureeMaximaleQuotidienne, dureeMoyenneSur12Semaines } from './regles/durees'
import { contingentHeuresSupplementaires } from './regles/heures-supplementaires'
import { jeuneTravailleur } from './regles/jeunes'
import { travailDeNuit } from './regles/nuit'
import { pauseObligatoire } from './regles/pause'
import { delaiDePrevenance } from './regles/prevenance'
import { reposHebdomadaire, reposQuotidien } from './regles/repos'
import {
  coupuresTempsPartiel,
  heuresComplementaires,
  verifierDureeMinimaleTempsPartiel,
} from './regles/temps-partiel'
import type { ContexteVerification, Infraction, ParametresRegles, Regle, Vacation } from './types'

/**
 * Toutes les regles du chapitre 8 du cahier des charges.
 * En ajouter une nouvelle : l'ecrire dans « regles/ », puis l'ajouter ici.
 */
export const REGLES_IMPLEMENTEES: readonly Regle[] = [
  dureeMaximaleQuotidienne,
  dureeMaximaleHebdomadaire,
  dureeMoyenneSur12Semaines,
  reposQuotidien,
  reposHebdomadaire,
  pauseObligatoire,
  coupuresTempsPartiel,
  heuresComplementaires,
  delaiDePrevenance,
  contingentHeuresSupplementaires,
  travailDeNuit,
  jeuneTravailleur,
]

/** Construit un contexte complet a partir du minimum indispensable. */
export function contexteDeVerification(
  vacations: readonly Vacation[],
  parametres: ParametresRegles,
  complements: Partial<Omit<ContexteVerification, 'vacations' | 'parametres'>> = {},
): ContexteVerification {
  return {
    vacations,
    parametres,
    collaborateurs: complements.collaborateurs ?? [],
    vacationsAnterieures: complements.vacationsAnterieures ?? [],
    datePublication: complements.datePublication ?? null,
    heuresSupplementairesAnnuelles: complements.heuresSupplementairesAnnuelles ?? {},
  }
}

/**
 * Passe un planning au crible de toutes les regles.
 * Le resultat est trie : a donnees egales, l'ordre est toujours le meme.
 */
export function verifier(contexte: ContexteVerification): Infraction[] {
  const infractions = REGLES_IMPLEMENTEES.flatMap((regle) => regle.verifier(contexte))
  return trier(infractions)
}

/** Controles portant sur les contrats, independamment de tout planning. */
export function verifierLesContrats(
  collaborateurs: readonly Collaborateur[],
  parametres: ParametresRegles,
): Infraction[] {
  return trier(verifierDureeMinimaleTempsPartiel(collaborateurs, parametres))
}

function trier(infractions: readonly Infraction[]): Infraction[] {
  return [...infractions].sort(
    (a, b) =>
      a.collaborateurId.localeCompare(b.collaborateurId) ||
      a.jour.localeCompare(b.jour) ||
      a.regle.localeCompare(b.regle) ||
      a.libelle.localeCompare(b.libelle),
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

/** Infractions concernant une personne donnee. */
export function infractionsDe(
  infractions: readonly Infraction[],
  collaborateurId: string,
): Infraction[] {
  return infractions.filter((infraction) => infraction.collaborateurId === collaborateurId)
}
