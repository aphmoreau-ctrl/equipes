import { dureeEnTexte } from '../../../domaine/temps'
import { collaborateursConcernes, minutesDeNuit, vacationsDe } from '../reperes'
import type { Infraction, ParametresRegles, Regle, Vacation } from '../types'

/** Minutes de nuit d'un ensemble de vacations. */
export function totalMinutesDeNuit(
  vacations: readonly Vacation[],
  parametres: ParametresRegles,
): number {
  return vacations.reduce(
    (somme, vacation) =>
      somme + minutesDeNuit(vacation, parametres.nuitDebut, parametres.nuitFin),
    0,
  )
}

/**
 * Travail de nuit : on signale le franchissement du seuil qui fait basculer
 * dans le statut de travailleur de nuit, lequel ouvre des droits (repos
 * compensateur, suivi medical renforce).
 */
export const travailDeNuit: Regle = {
  id: 'travail-de-nuit',
  nom: 'Travail de nuit',
  reference: 'Convention collective 2216',

  verifier({ vacations, vacationsAnterieures, parametres }) {
    const infractions: Infraction[] = []
    const toutes = [...vacationsAnterieures, ...vacations]
    const seuil = parametres.seuilTravailleurDeNuitHeuresAnnuelles * 60

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      const minutes = totalMinutesDeNuit(vacationsDe(toutes, collaborateurId), parametres)
      if (minutes <= seuil) continue

      const derniere = vacationsDe(vacations, collaborateurId).at(-1)
      infractions.push({
        regle: 'travail-de-nuit',
        severite: parametres.severites['travail-de-nuit'],
        collaborateurId,
        jour: derniere?.jour ?? '',
        libelle: `Statut de travailleur de nuit atteint : ${Math.round(minutes / 60)} h`,
        explication:
          `${dureeEnTexte(Math.round(minutes))} de travail entre ${parametres.nuitDebut} et ` +
          `${parametres.nuitFin} sur l’année, au-delà du seuil de ` +
          `${parametres.seuilTravailleurDeNuitHeuresAnnuelles} h. ` +
          `Le statut de travailleur de nuit s’applique : repos compensateur et suivi médical renforcé.`,
      })
    }

    return infractions
  },
}
