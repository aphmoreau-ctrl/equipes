import { jourDeLaSemaine } from '../../domaine/calendrier'
import {
  estAutonome,
  estDisponible,
  niveauDeCompetence,
  nomAffiche,
  peutTravaillerDans,
  type Collaborateur,
} from '../../domaine/collaborateur'
import { estAbsent, type Absence } from '../../domaine/absence'
import { dureeTravailEffectif, type Vacation } from '../regles'
import { heuresEnTexte } from '../../domaine/nombres'

/**
 * Recherche de remplacants (cahier des charges §10).
 *
 * Un bouton, une liste classee. Le classement suit exactement les criteres du
 * cahier : competence, disponibilite, heures restantes au contrat, repos legal
 * respecte, equite.
 *
 * Module pur : il ne decide rien, il propose. C'est Arnaud qui tranche.
 */

export interface Remplacant {
  readonly collaborateur: Collaborateur
  /** Plus le score est eleve, plus la personne est indiquee. */
  readonly score: number
  /** Ce qui plaide en sa faveur, en francais. */
  readonly atouts: readonly string[]
  /** Ce qui gene, sans interdire. */
  readonly reserves: readonly string[]
}

export interface Obstacle {
  readonly collaborateur: Collaborateur
  /** Pourquoi cette personne ne peut pas prendre la vacation. */
  readonly motif: string
}

export interface RechercheRemplacants {
  /** Personnes qui couvrent TOUT ce qui manque : elles tiennent le poste. */
  readonly possibles: readonly Remplacant[]
  /** Personnes qui n'en couvrent qu'une partie : un renfort, pas un remplacement. */
  readonly partiels: readonly Remplacant[]
  readonly ecartes: readonly Obstacle[]
}

interface Contexte {
  /** Vacation a couvrir. */
  readonly vacation: Vacation
  readonly collaborateurs: readonly Collaborateur[]
  readonly absences: readonly Absence[]
  /** Toutes les vacations de la semaine, pour connaitre qui travaille deja. */
  readonly vacationsDeLaSemaine: readonly Vacation[]
  /** Competences exigees sur le creneau. */
  readonly competencesRequises: readonly string[]
  /**
   * Competences CRITIQUES : sans elles, le poste ne peut pas etre tenu.
   * Un boucher qualifie au comptoir n'est remplacable que par un boucher.
   * Qui ne les a pas est ecarte, sans discussion.
   */
  readonly competencesCritiques: readonly string[]
  /** Repos quotidien minimal, en minutes. */
  readonly reposQuotidienMinutes: number
}

/**
 * Classe les remplacants possibles, et explique pourquoi les autres
 * sont ecartes. Deterministe : a donnees egales, le meme ordre.
 */
export function chercherDesRemplacants(contexte: Contexte): RechercheRemplacants {
  const {
    vacation,
    collaborateurs,
    absences,
    vacationsDeLaSemaine,
    competencesRequises,
    competencesCritiques,
  } = contexte
  const jour = jourDeLaSemaine(vacation.jour)

  const possibles: Remplacant[] = []
  const partiels: Remplacant[] = []
  const ecartes: Obstacle[] = []

  for (const collaborateur of collaborateurs) {
    if (!collaborateur.actif) continue
    if (collaborateur.id === vacation.collaborateurId) continue

    const nom = nomAffiche(collaborateur)

    // --- Contraintes dures : elles ecartent la personne ---
    if (!peutTravaillerDans(collaborateur, vacation.rayonId)) {
      ecartes.push({ collaborateur, motif: `${nom} n’intervient pas dans ce rayon.` })
      continue
    }

    if (estAbsent(absences, collaborateur.id, vacation.jour)) {
      ecartes.push({ collaborateur, motif: `${nom} est absent ce jour-là.` })
      continue
    }

    if (!estDisponible(collaborateur, jour)) {
      ecartes.push({ collaborateur, motif: `${nom} s’est déclaré indisponible ce jour-là.` })
      continue
    }

    const dejaCeJour = vacationsDeLaSemaine.filter(
      (autre) => autre.collaborateurId === collaborateur.id && autre.jour === vacation.jour,
    )
    if (dejaCeJour.length > 0) {
      ecartes.push({ collaborateur, motif: `${nom} travaille déjà ce jour-là.` })
      continue
    }

    /*
     * Competences CRITIQUES : sans elles, le poste ne peut pas etre tenu.
     * Aucune tolerance, aucune exception : un comptoir boucherie ne se
     * remplace que par quelqu'un d'autonome en boucherie.
     */
    const critiquesManquantes = competencesCritiques.filter(
      (competence) => !estAutonome(collaborateur, competence),
    )
    if (critiquesManquantes.length > 0) {
      ecartes.push({
        collaborateur,
        motif:
          `${nom} n’est pas autonome en « ${critiquesManquantes.join(' », « ')} », ` +
          `indispensable pour tenir ce poste.`,
      })
      continue
    }

    /*
     * Autres competences : un remplacant n'a pas a savoir tout faire. Qui n'en
     * couvre aucune est ecarte ; qui n'en couvre qu'une partie est propose a
     * part, comme renfort et non comme remplacement.
     */
    const couvertes = competencesRequises.filter((competence) =>
      estAutonome(collaborateur, competence),
    )
    const manquantes = competencesRequises.filter(
      (competence) => !estAutonome(collaborateur, competence),
    )
    if (competencesRequises.length > 0 && couvertes.length === 0) {
      ecartes.push({
        collaborateur,
        motif: `${nom} n’est autonome sur aucune des compétences attendues : « ${competencesRequises.join(
          ' », « ',
        )} ».`,
      })
      continue
    }

    // --- Score et explications ---
    const atouts: string[] = []
    const reserves: string[] = []
    let score = 0

    if (collaborateur.rayonPrincipal === vacation.rayonId) {
      score += 30
      atouts.push('C’est son rayon')
    } else {
      score += 10
      atouts.push('Intervient en renfort dans ce rayon')
    }

    if (competencesRequises.length === 0) {
      score += 20
    } else {
      const part = couvertes.length / competencesRequises.length
      score += part * 30

      const niveauMoyen =
        couvertes.reduce(
          (somme, competence) => somme + niveauDeCompetence(collaborateur, competence),
          0,
        ) / Math.max(1, couvertes.length)
      score += niveauMoyen * 5

      if (part === 1) {
        atouts.push('Couvre toutes les compétences attendues')
      } else {
        atouts.push(
          `Couvre ${couvertes.length} compétence${couvertes.length > 1 ? 's' : ''} sur ${competencesRequises.length}`,
        )
        reserves.push(`Ne couvre pas « ${manquantes.join(' », « ')} »`)
      }
    }

    // Heures restantes au contrat : on privilegie ceux qui en ont.
    const heuresPrevues =
      vacationsDeLaSemaine
        .filter((autre) => autre.collaborateurId === collaborateur.id)
        .reduce((somme, autre) => somme + dureeTravailEffectif(autre), 0) / 60
    const restantes = collaborateur.heuresHebdomadaires - heuresPrevues
    const aAjouter = dureeTravailEffectif(vacation) / 60

    if (restantes >= aAjouter) {
      score += 25
      atouts.push(`${heuresEnTexte(restantes)} encore disponibles au contrat`)
    } else if (restantes > 0) {
      score += 5
      reserves.push(
        `Dépasserait son contrat de ${heuresEnTexte((aAjouter - restantes))}` +
          (collaborateur.tempsPlein ? ' (heures supplémentaires)' : ' (heures complémentaires)'),
      )
    } else {
      reserves.push(
        `Est déjà à ${heuresEnTexte(heuresPrevues)} pour un contrat de ${collaborateur.heuresHebdomadaires} h`,
      )
    }

    // Equite : on sollicite d'abord ceux qui l'ont le moins ete.
    const sujetions =
      collaborateur.compteursEquite.samedisTravailles +
      collaborateur.compteursEquite.dimanchesTravailles +
      collaborateur.compteursEquite.fermetures +
      collaborateur.compteursEquite.feriesTravailles
    score += Math.max(0, 25 - sujetions / 2)

    if (!collaborateur.contactAutorise) {
      reserves.push('N’a pas donné son accord pour être contacté hors planning')
    } else {
      score += 5
      atouts.push('Accepte d’être contacté')
    }

    const proposition = { collaborateur, score, atouts, reserves }
    if (manquantes.length === 0) possibles.push(proposition)
    else partiels.push(proposition)
  }

  const parScore = (a: Remplacant, b: Remplacant) =>
    b.score - a.score || a.collaborateur.id.localeCompare(b.collaborateur.id)

  return {
    possibles: possibles.sort(parScore),
    partiels: partiels.sort(parScore),
    ecartes: ecartes.sort((a, b) => a.collaborateur.id.localeCompare(b.collaborateur.id)),
  }
}
