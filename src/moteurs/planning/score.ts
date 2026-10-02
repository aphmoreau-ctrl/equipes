import { estAutonome, type Collaborateur } from '../../domaine/collaborateur'
import { TRANCHE_MINUTES } from '../../domaine/temps'
import type { BesoinJour } from '../besoin'
import { dureeTravailEffectif, type Vacation } from '../regles'
import { couvreLaTranche } from '../indicateurs'

/**
 * Contraintes SOUPLES du generateur (cahier des charges §9.2).
 *
 * Les contraintes DURES (disponibilites, absences, competences critiques,
 * regles legales bloquantes) ne sont pas ici : elles sont verifiees avant, et
 * ne se negocient pas. Ce module ne fait que classer ce qui reste permis.
 *
 * Tous les poids sont reglables : c'est ce qui permet a l'utilisateur de dire
 * « je prefere de la regularite, quitte a un peu de sureffectif ».
 */

export interface PoidsPenalites {
  /** Par heure d'ecart aux heures du contrat, en plus ou en moins. */
  readonly ecartAuContrat: number
  /** Par personne en trop sur une tranche. */
  readonly sureffectif: number
  /** Par vacation effectuee hors du rayon principal. */
  readonly rayonSecondaire: number
  /** Par point d'ecart aux sujetions deja accumulees (samedis, dimanches...). */
  readonly equite: number
  /** Par horaire type different utilise dans la semaine pour une meme personne. */
  readonly irregularite: number
  /** Par vacation qui differe du planning de la semaine precedente. */
  readonly changement: number
  /** Par personne manquante sur une tranche. Le plus lourd. */
  readonly manque: number
  /** Prime accordee a la couverture d'une competence critique. */
  readonly competenceCritique: number
}

export const POIDS_PAR_DEFAUT: PoidsPenalites = {
  ecartAuContrat: 6,
  sureffectif: 4,
  rayonSecondaire: 2,
  equite: 1.5,
  irregularite: 1,
  changement: 1,
  manque: 20,
  competenceCritique: 15,
}

/** Somme des sujetions deja accumulees par une personne. */
export function sujetions(collaborateur: Collaborateur): number {
  const compteurs = collaborateur.compteursEquite
  return (
    compteurs.samedisTravailles +
    compteurs.dimanchesTravailles +
    compteurs.fermetures +
    compteurs.feriesTravailles
  )
}

/**
 * Personnes-tranches de besoin non couvert, pour un rayon et un jour.
 * C'est la mesure que le generateur cherche a faire descendre en premier.
 */
export function manqueRestant(
  besoin: BesoinJour,
  vacations: readonly Vacation[],
): number {
  let manque = 0
  for (const tranche of besoin.tranches) {
    if (tranche.personnes === 0) continue
    const presents = vacations.filter(
      (vacation) =>
        vacation.rayonId === besoin.rayonId &&
        vacation.jour === besoin.date &&
        couvreLaTranche(vacation, tranche.index),
    ).length
    manque += Math.max(0, tranche.personnes - presents)
  }
  return manque
}

/** Personnes-tranches en sureffectif, pour un rayon et un jour. */
export function sureffectifRestant(
  besoin: BesoinJour,
  vacations: readonly Vacation[],
): number {
  let trop = 0
  for (const tranche of besoin.tranches) {
    const presents = vacations.filter(
      (vacation) =>
        vacation.rayonId === besoin.rayonId &&
        vacation.jour === besoin.date &&
        couvreLaTranche(vacation, tranche.index),
    ).length
    trop += Math.max(0, presents - tranche.personnes)
  }
  return trop
}

/**
 * Competences critiques encore decouvertes sur un rayon et un jour.
 * Elles passent avant tout le reste : un comptoir sans boucher est un
 * probleme d'une autre nature qu'un comptoir en sous-effectif.
 */
export function competencesCritiquesDecouvertes(
  besoin: BesoinJour,
  vacations: readonly Vacation[],
  collaborateurs: readonly Collaborateur[],
): number {
  let decouvertes = 0
  for (const tranche of besoin.tranches) {
    for (const competence of tranche.competencesCritiques) {
      const couverte = vacations.some((vacation) => {
        if (vacation.rayonId !== besoin.rayonId || vacation.jour !== besoin.date) return false
        if (!couvreLaTranche(vacation, tranche.index)) return false
        const collaborateur = collaborateurs.find((c) => c.id === vacation.collaborateurId)
        return collaborateur !== undefined && estAutonome(collaborateur, competence)
      })
      if (!couverte) decouvertes += 1
    }
  }
  return decouvertes
}

export interface DetailPenalites {
  readonly ecartAuContrat: number
  readonly sureffectif: number
  readonly rayonSecondaire: number
  readonly equite: number
  readonly irregularite: number
  readonly changement: number
  readonly manque: number
  readonly competencesCritiques: number
  readonly total: number
}

/**
 * Penalite totale d'un planning. Plus elle est basse, meilleur il est.
 * Le detail est conserve : c'est ce qui permet d'expliquer un choix.
 */
export function penaliser(
  vacations: readonly Vacation[],
  besoins: readonly BesoinJour[],
  collaborateurs: readonly Collaborateur[],
  poids: PoidsPenalites,
  planningPrecedent: readonly Vacation[] = [],
): DetailPenalites {
  let manque = 0
  let sureffectif = 0
  let critiques = 0
  for (const besoin of besoins) {
    manque += manqueRestant(besoin, vacations)
    sureffectif += sureffectifRestant(besoin, vacations)
    critiques += competencesCritiquesDecouvertes(besoin, vacations, collaborateurs)
  }

  let ecart = 0
  let secondaire = 0
  let equite = 0
  let irregularite = 0

  const actifs = collaborateurs.filter((collaborateur) => collaborateur.actif)
  const sujetionMoyenne =
    actifs.length === 0 ? 0 : actifs.reduce((somme, c) => somme + sujetions(c), 0) / actifs.length

  for (const collaborateur of actifs) {
    const siennes = vacations.filter((v) => v.collaborateurId === collaborateur.id)
    const heures = siennes.reduce((somme, v) => somme + dureeTravailEffectif(v), 0) / 60
    ecart += Math.abs(heures - collaborateur.heuresHebdomadaires)

    secondaire += siennes.filter((v) => v.rayonId !== collaborateur.rayonPrincipal).length

    // Equite : on penalise de solliciter ceux qui l'ont deja beaucoup ete.
    if (siennes.length > 0) {
      equite += Math.max(0, sujetions(collaborateur) - sujetionMoyenne) * (siennes.length / 5)
    }

    // Regularite : combien d'heures de debut differentes dans la semaine.
    const debuts = new Set(siennes.map((v) => v.debut))
    irregularite += Math.max(0, debuts.size - 1)
  }

  // Changements par rapport a la semaine precedente : meme personne, meme jour
  // de la semaine, meme heure de debut.
  let changement = 0
  if (planningPrecedent.length > 0) {
    const repere = (vacation: Vacation) =>
      `${vacation.collaborateurId}|${vacation.jour.slice(8)}|${vacation.debut}`
    const avant = new Set(planningPrecedent.map(repere))
    changement = vacations.filter((vacation) => !avant.has(repere(vacation))).length
  }

  const detail = {
    ecartAuContrat: ecart * poids.ecartAuContrat,
    sureffectif: sureffectif * poids.sureffectif,
    rayonSecondaire: secondaire * poids.rayonSecondaire,
    equite: equite * poids.equite,
    irregularite: irregularite * poids.irregularite,
    changement: changement * poids.changement,
    manque: manque * poids.manque,
    competencesCritiques: critiques * poids.competenceCritique,
  }

  return {
    ...detail,
    total:
      detail.ecartAuContrat +
      detail.sureffectif +
      detail.rayonSecondaire +
      detail.equite +
      detail.irregularite +
      detail.changement +
      detail.manque +
      detail.competencesCritiques,
  }
}

/** Nombre de tranches couvertes par une vacation. */
export function tranchesCouvertesPar(vacation: Vacation): number {
  return Math.round(dureeTravailEffectif(vacation) / TRANCHE_MINUTES)
}


/**
 * Penalite liee a UNE personne : ecart au contrat, rayons secondaires,
 * equite, regularite, changements. Elle ne depend que de ses propres
 * vacations, ce qui rend les variations calculables sans tout reprendre.
 */
export function penalitePersonne(
  collaborateur: Collaborateur,
  siennes: readonly Vacation[],
  poids: PoidsPenalites,
  sujetionMoyenne: number,
  reperesPrecedents: ReadonlySet<string>,
): number {
  const heures = siennes.reduce((somme, v) => somme + dureeTravailEffectif(v), 0) / 60
  let penalite = Math.abs(heures - collaborateur.heuresHebdomadaires) * poids.ecartAuContrat

  penalite +=
    siennes.filter((v) => v.rayonId !== collaborateur.rayonPrincipal).length *
    poids.rayonSecondaire

  if (siennes.length > 0) {
    penalite +=
      Math.max(0, sujetions(collaborateur) - sujetionMoyenne) *
      (siennes.length / 5) *
      poids.equite
  }

  penalite += Math.max(0, new Set(siennes.map((v) => v.debut)).size - 1) * poids.irregularite

  if (reperesPrecedents.size > 0) {
    penalite +=
      siennes.filter((v) => !reperesPrecedents.has(repereDeVacation(v))).length * poids.changement
  }

  return penalite
}

/** Repere d'une vacation pour la comparer d'une semaine a l'autre. */
export function repereDeVacation(vacation: Vacation): string {
  return `${vacation.collaborateurId}|${vacation.jour.slice(8)}|${vacation.debut}`
}

/**
 * Penalite liee a UN rayon sur UN jour : manque, sureffectif, competences
 * critiques decouvertes. Elle ne depend que des vacations de ce rayon ce
 * jour-la.
 */
export function penaliteRayonJour(
  besoin: BesoinJour,
  vacationsDuRayonEtDuJour: readonly Vacation[],
  collaborateurs: readonly Collaborateur[],
  poids: PoidsPenalites,
): number {
  return (
    manqueRestant(besoin, vacationsDuRayonEtDuJour) * poids.manque +
    sureffectifRestant(besoin, vacationsDuRayonEtDuJour) * poids.sureffectif +
    competencesCritiquesDecouvertes(besoin, vacationsDuRayonEtDuJour, collaborateurs) *
      poids.competenceCritique
  )
}

/** Moyenne des sujetions deja accumulees dans l'equipe. */
export function sujetionMoyenne(collaborateurs: readonly Collaborateur[]): number {
  const actifs = collaborateurs.filter((collaborateur) => collaborateur.actif)
  return actifs.length === 0 ? 0 : actifs.reduce((somme, c) => somme + sujetions(c), 0) / actifs.length
}
