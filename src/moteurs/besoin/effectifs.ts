import type { JourSemaine } from '../../domaine/calendrier'
import { jourDeRemplacement, type GrilleEffectifs } from '../../domaine/organisation'
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
  /** Jour emprunte, quand le jour est encore a definir (vendredi <- jeudi). */
  readonly provisoireDepuis?: JourSemaine
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

  // Jour encore a definir : il emprunte provisoirement la CIBLE d'un autre
  // jour, comme minimum et comme cible (vendredi et samedi <- jeudi).
  const source = jourDeRemplacement(grille, jour)
  for (const creneau of grille.jours[source ?? jour] ?? []) {
    if (!couvre(creneau.debut, creneau.fin, minute)) continue
    if (source === null) {
      minimum = Math.max(minimum, creneau.minimum ?? 0)
      cible = Math.max(cible, creneau.cible ?? creneau.minimum ?? 0)
    } else {
      const visee = creneau.cible ?? creneau.minimum ?? 0
      minimum = Math.max(minimum, visee)
      cible = Math.max(cible, visee)
    }
  }
  // Remballe : son effectif propre, sur sa plage, s'il est plus exigeant.
  const remballe = grille.remballe?.[jour]
  if (remballe != null) {
    const debut = enMinutes(remballe.debut)
    if (minute >= debut && minute < debut + remballe.dureeMinutes) {
      minimum = Math.max(minimum, remballe.minimum)
      cible = Math.max(cible, remballe.cible)
    }
  }

  for (const plancher of grille.planchers) {
    if (!plancher.jours.includes(jour)) continue
    if (!couvre(plancher.debut, plancher.fin, minute)) continue
    minimum = Math.max(minimum, plancher.minimum)
  }

  return {
    minimum,
    cible: Math.max(cible, minimum),
    ...(source === null ? {} : { provisoireDepuis: source }),
  }
}
