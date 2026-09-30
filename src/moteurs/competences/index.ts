import {
  estAutonome,
  niveauDeCompetence,
  nomAffiche,
  type Collaborateur,
} from '../../domaine/collaborateur'
import type { Formation } from '../../domaine/formation'

/**
 * Grille de polyvalence et besoins de formation (§13, module 10).
 *
 * Module pur. Il ne juge personne : il compte qui sait faire quoi, et signale
 * les postes qui ne tiennent qu'a une seule personne.
 */

export interface LigneDePolyvalence {
  readonly collaborateurId: string
  readonly nom: string
  readonly niveaux: Readonly<Record<string, number>>
  /** Nombre de competences tenues en autonomie. */
  readonly polyvalence: number
}

export function grilleDePolyvalence(
  collaborateurs: readonly Collaborateur[],
  competences: readonly string[],
): LigneDePolyvalence[] {
  return collaborateurs
    .filter((collaborateur) => collaborateur.actif)
    .map((collaborateur) => {
      const niveaux: Record<string, number> = {}
      for (const competence of competences) {
        niveaux[competence] = niveauDeCompetence(collaborateur, competence)
      }
      return {
        collaborateurId: collaborateur.id,
        nom: nomAffiche(collaborateur),
        niveaux,
        polyvalence: competences.filter((competence) => estAutonome(collaborateur, competence))
          .length,
      }
    })
    .sort((a, b) => b.polyvalence - a.polyvalence || a.nom.localeCompare(b.nom, 'fr'))
}

export interface CouvertureCompetence {
  readonly competence: string
  readonly autonomes: number
  readonly enApprentissage: number
  readonly enFormation: number
  /** Une seule personne autonome, ou aucune. */
  readonly fragile: boolean
}

/** Couverture de chaque competence : l'indicateur de dependance du cahier. */
export function couvertureDesCompetences(
  collaborateurs: readonly Collaborateur[],
  competences: readonly string[],
  formations: readonly Formation[] = [],
): CouvertureCompetence[] {
  const actifs = collaborateurs.filter((collaborateur) => collaborateur.actif)

  return competences
    .map((competence) => {
      const autonomes = actifs.filter((collaborateur) =>
        estAutonome(collaborateur, competence),
      ).length
      return {
        competence,
        autonomes,
        enApprentissage: actifs.filter(
          (collaborateur) => niveauDeCompetence(collaborateur, competence) === 1,
        ).length,
        enFormation: formations.filter(
          (formation) => formation.competenceVisee === competence && formation.etat === 'prevue',
        ).length,
        fragile: autonomes <= 1,
      }
    })
    .sort((a, b) => a.autonomes - b.autonomes || a.competence.localeCompare(b.competence, 'fr'))
}

export interface BesoinDeFormation {
  readonly competence: string
  readonly manque: number
  readonly candidats: readonly {
    readonly collaborateurId: string
    readonly nom: string
    readonly niveau: number
  }[]
  readonly message: string
}

/** Formations a prevoir pour qu'aucune competence ne repose sur une seule personne. */
export function besoinsDeFormation(
  collaborateurs: readonly Collaborateur[],
  competences: readonly string[],
  formations: readonly Formation[] = [],
  autonomesSouhaites = 2,
): BesoinDeFormation[] {
  const actifs = collaborateurs.filter((collaborateur) => collaborateur.actif)

  return couvertureDesCompetences(actifs, competences, formations)
    .filter((couverture) => couverture.autonomes + couverture.enFormation < autonomesSouhaites)
    .map((couverture) => {
      const manque = autonomesSouhaites - couverture.autonomes - couverture.enFormation
      const candidats = actifs
        .filter((collaborateur) => !estAutonome(collaborateur, couverture.competence))
        .map((collaborateur) => ({
          collaborateurId: collaborateur.id,
          nom: nomAffiche(collaborateur),
          niveau: niveauDeCompetence(collaborateur, couverture.competence),
        }))
        .sort((a, b) => b.niveau - a.niveau || a.nom.localeCompare(b.nom, 'fr'))
        .slice(0, 3)

      return {
        competence: couverture.competence,
        manque,
        candidats,
        message:
          couverture.autonomes === 0
            ? `Personne n’est autonome en « ${couverture.competence} ». C’est la formation la plus urgente.`
            : `Une seule personne est autonome en « ${couverture.competence} ». ` +
              `Former ${manque} personne${manque > 1 ? 's' : ''} de plus mettrait le rayon à l’abri.`,
      }
    })
}

/** Toutes les competences citees quelque part. */
export function competencesConnues(
  collaborateurs: readonly Collaborateur[],
  supplementaires: readonly string[] = [],
): string[] {
  const competences = new Set<string>(supplementaires)
  for (const collaborateur of collaborateurs) {
    for (const competence of Object.keys(collaborateur.competences)) competences.add(competence)
  }
  return [...competences].sort((a, b) => a.localeCompare(b, 'fr'))
}
