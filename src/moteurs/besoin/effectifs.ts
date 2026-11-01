import type { JourSemaine } from '../../domaine/calendrier'
import type { GrilleEffectifs } from '../../domaine/organisation'
import { debutDeTranche, enMinutes } from '../../domaine/temps'

/**
 * Effectifs saisis directement, tranche par tranche.
 *
 * Module pur. Une tranche de 15 minutes appartient a un creneau si elle
 * commence dans ce creneau : 11:00-13:00 couvre les tranches de 11:00 a 12:45.
 */

export interface EffectifTranche {
  /** Obligatoire. */
  readonly minimum: number
  /** Souhaite ; jamais inferieur au minimum. */
  readonly cible: number
}

function couvre(debut: string, fin: string, minute: number): boolean {
  return enMinutes(debut) <= minute && minute < enMinutes(fin)
}

/**
 * Minimum et cible d'une tranche.
 *
 * Le minimum est le plus exigeant entre la grille et les planchers : la
 * presence permanente en vente tient meme quand la grille du jour n'est pas
 * encore remplie. Une valeur A DEFINIR (null) ne demande personne : elle est
 * signalee ailleurs, jamais inventee.
 */
export function effectifDeLaTranche(
  grille: GrilleEffectifs,
  jour: JourSemaine,
  indexTranche: number,
): EffectifTranche {
  const minute = debutDeTranche(indexTranche)
  let minimum = 0
  let cible = 0

  for (const creneau of grille.jours[jour] ?? []) {
    if (!couvre(creneau.debut, creneau.fin, minute)) continue
    minimum = Math.max(minimum, creneau.minimum ?? 0)
    cible = Math.max(cible, creneau.cible ?? creneau.minimum ?? 0)
  }
  for (const plancher of grille.planchers) {
    if (!plancher.jours.includes(jour)) continue
    if (!couvre(plancher.debut, plancher.fin, minute)) continue
    minimum = Math.max(minimum, plancher.minimum)
  }

  return { minimum, cible: Math.max(cible, minimum) }
}
