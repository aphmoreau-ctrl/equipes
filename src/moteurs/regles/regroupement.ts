import { duree, type Minutes } from '../../domaine/temps'
import type { Vacation } from './types'

/**
 * Travail effectif d'une vacation : amplitude moins la pause.
 * Une pause plus longue que l'amplitude est une erreur de saisie, signalee
 * immediatement plutot que propagee silencieusement dans les calculs.
 */
export function dureeTravailEffectif(vacation: Vacation): Minutes {
  const amplitude = duree(vacation.debut, vacation.fin)
  const effectif = amplitude - vacation.pauseMinutes
  if (effectif < 0) {
    throw new Error(
      `Vacation « ${vacation.id} » : la pause (${vacation.pauseMinutes} min) depasse ` +
        `l'amplitude de ${vacation.debut} a ${vacation.fin} (${amplitude} min).`,
    )
  }
  return effectif
}

/** Une personne, un jour, et toutes ses vacations de ce jour-la. */
export interface JourneeDeTravail {
  readonly collaborateurId: string
  readonly jour: string
  readonly vacations: readonly Vacation[]
}

/**
 * Regroupe les vacations par personne puis par jour.
 * Le resultat est trie (personne, puis jour) pour que les controles rendent
 * toujours le meme ordre a donnees egales : c'est l'exigence de determinisme
 * du cahier des charges (§9.3), indispensable pour comparer deux plannings.
 */
export function grouperParJournee(vacations: readonly Vacation[]): JourneeDeTravail[] {
  const parPersonne = new Map<string, Map<string, Vacation[]>>()

  for (const vacation of vacations) {
    let jours = parPersonne.get(vacation.collaborateurId)
    if (jours === undefined) {
      jours = new Map<string, Vacation[]>()
      parPersonne.set(vacation.collaborateurId, jours)
    }
    const dejaVues = jours.get(vacation.jour)
    if (dejaVues === undefined) jours.set(vacation.jour, [vacation])
    else dejaVues.push(vacation)
  }

  const journees: JourneeDeTravail[] = []
  for (const [collaborateurId, jours] of parPersonne) {
    for (const [jour, groupe] of jours) {
      journees.push({ collaborateurId, jour, vacations: groupe })
    }
  }

  return journees.sort(
    (a, b) => a.collaborateurId.localeCompare(b.collaborateurId) || a.jour.localeCompare(b.jour),
  )
}
