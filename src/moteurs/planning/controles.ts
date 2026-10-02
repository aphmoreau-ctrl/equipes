import type { Collaborateur } from '../../domaine/collaborateur'
import { nomAffiche } from '../../domaine/collaborateur'
import type { BesoinJour } from '../besoin'
import { calculerCouverture } from '../indicateurs'
import { dureeTravailEffectif, type Infraction, type Vacation } from '../regles'
import { heuresEnTexte } from '../../domaine/nombres'

/**
 * Controles avant validation (§9.10).
 *
 * Avant de soumettre un planning au patron, puis avant de le publier a
 * l'equipe, on verifie ce qui ne se rattrape pas apres coup. Un seul controle
 * BLOQUE : une regle legale enfreinte. Les autres alertent, parce qu'ils
 * relevent d'un arbitrage — un ecart au contrat peut etre assume, pas une
 * duree de travail illegale.
 */

export type ResultatControle = 'bon' | 'alerte' | 'bloquant'

export interface Controle {
  readonly id: string
  readonly titre: string
  readonly resultat: ResultatControle
  readonly detail: string
  /** Ce qu'il faut faire, quand quelque chose cloche. */
  readonly conseil?: string
}

export interface EntreesControles {
  readonly besoins: readonly BesoinJour[]
  readonly vacations: readonly Vacation[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly infractions: readonly Infraction[]
}

export function controlerAvantValidation(entrees: EntreesControles): Controle[] {
  const controles: Controle[] = []
  const equipe = entrees.collaborateurs.filter((collaborateur) => collaborateur.actif)

  // 1. Regles legales : le seul controle qui bloque.
  const bloquantes = entrees.infractions.filter(
    (infraction) => infraction.severite === 'bloquante',
  )
  controles.push({
    id: 'regles',
    titre: 'Règles légales',
    resultat: bloquantes.length === 0 ? 'bon' : 'bloquant',
    detail:
      bloquantes.length === 0
        ? 'Aucune règle enfreinte.'
        : `${bloquantes.length} règle${bloquantes.length > 1 ? 's' : ''} enfreinte${bloquantes.length > 1 ? 's' : ''} : ${[
            ...new Set(bloquantes.map((infraction) => infraction.libelle)),
          ]
            .slice(0, 3)
            .join(' · ')}`,
    ...(bloquantes.length === 0
      ? {}
      : {
          conseil:
            'Un planning qui enfreint la loi ne doit pas sortir. Corrigez les cases signalées, ' +
            'ou relancez le calcul : il ne propose jamais rien d’illégal.',
        }),
  })

  // 2. Competences critiques : couvertes au bon niveau ?
  let critiquesDecouvertes = 0
  let binomesIncomplets = 0
  for (const besoin of entrees.besoins) {
    const duJour = entrees.vacations.filter(
      (vacation) => vacation.rayonId === besoin.rayonId && vacation.jour === besoin.date,
    )
    const couverture = calculerCouverture(besoin, duJour, entrees.collaborateurs)
    for (const tranche of couverture.tranches) {
      if (tranche.competencesCritiquesManquantes.length > 0) critiquesDecouvertes += 1
      if (tranche.binomesIncomplets.length > 0) binomesIncomplets += 1
    }
  }

  controles.push({
    id: 'competences-critiques',
    titre: 'Compétences critiques',
    resultat: critiquesDecouvertes === 0 ? 'bon' : 'alerte',
    detail:
      critiquesDecouvertes === 0
        ? 'Tous les postes qui exigent une compétence critique sont tenus.'
        : `${critiquesDecouvertes} quart${critiquesDecouvertes > 1 ? 's' : ''} d’heure sans personne qualifiée sur un poste critique.`,
    ...(critiquesDecouvertes === 0
      ? {}
      : { conseil: 'Voyez les conflits : un prêt suffit souvent à couvrir le créneau.' }),
  })

  controles.push({
    id: 'binomes',
    titre: 'Binômes de formation',
    resultat: binomesIncomplets === 0 ? 'bon' : 'alerte',
    detail:
      binomesIncomplets === 0
        ? 'Personne en formation n’est laissé sans accompagnant.'
        : `${binomesIncomplets} quart${binomesIncomplets > 1 ? 's' : ''} d’heure où quelqu’un en formation se retrouve seul sur sa tâche.`,
    ...(binomesIncomplets === 0
      ? {}
      : { conseil: 'Placez sur le même créneau quelqu’un capable de former (niveau 3).' }),
  })

  // 3. Ecarts au contrat.
  const ecarts = equipe
    .map((collaborateur) => ({
      collaborateur,
      heures:
        entrees.vacations
          .filter((vacation) => vacation.collaborateurId === collaborateur.id)
          .reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60,
    }))
    .map(({ collaborateur, heures }) => ({
      collaborateur,
      ecart: heures - collaborateur.heuresHebdomadaires,
    }))
    .filter(({ ecart }) => Math.abs(ecart) >= 2)
    .sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))

  controles.push({
    id: 'contrats',
    titre: 'Écarts au contrat',
    resultat: ecarts.length === 0 ? 'bon' : 'alerte',
    detail:
      ecarts.length === 0
        ? 'Chacun est à moins de deux heures de son contrat.'
        : `${ecarts.length} personne${ecarts.length > 1 ? 's' : ''} à plus de deux heures de son contrat, dont ${ecarts
            .slice(0, 3)
            .map(
              ({ collaborateur, ecart }) =>
                `${nomAffiche(collaborateur)} (${ecart > 0 ? '+' : '−'}${heuresEnTexte(Math.abs(ecart))})`,
            )
            .join(', ')}.`,
    ...(ecarts.length === 0
      ? {}
      : {
          conseil:
            'Un écart peut être assumé — heures supplémentaires, semaine creuse — mais il doit ' +
            'être choisi, pas subi.',
        }),
  })

  // 4. Competences portees par une seule personne.
  const fragiles = competencesFragiles(entrees.besoins, equipe)
  controles.push({
    id: 'competences-fragiles',
    titre: 'Compétences tenues par une seule personne',
    resultat: fragiles.length === 0 ? 'bon' : 'alerte',
    detail:
      fragiles.length === 0
        ? 'Chaque compétence utile est tenue par au moins deux personnes.'
        : `${fragiles.join(', ')} — une seule personne autonome. Une absence et le rayon s’arrête.`,
    ...(fragiles.length === 0
      ? {}
      : {
          conseil:
            'Prévoyez une formation : c’est la seule solution qui règle le problème pour de bon.',
        }),
  })

  return controles
}

/** Competences exigees par les taches et tenues par une seule personne. */
function competencesFragiles(
  besoins: readonly BesoinJour[],
  equipe: readonly Collaborateur[],
): string[] {
  const exigees = new Set<string>()
  for (const besoin of besoins) {
    for (const tranche of besoin.tranches) {
      for (const competence of tranche.competences) exigees.add(competence)
    }
  }

  return [...exigees]
    .filter(
      (competence) =>
        equipe.filter((collaborateur) => (collaborateur.competences[competence] ?? 0) >= 2)
          .length === 1,
    )
    .sort((a, b) => a.localeCompare(b, 'fr'))
}

/** Le planning peut-il sortir ? Une seule chose l'interdit : la loi. */
export function peutSortir(controles: readonly Controle[]): boolean {
  return !controles.some((controle) => controle.resultat === 'bloquant')
}
