import { enFormation } from '../../../domaine/collaborateur'
import { jourEnTexte } from '../../../domaine/calendrier'
import type { Infraction, Regle } from '../types'

/**
 * Apprentissage : le temps passe en centre de formation est du TEMPS DE
 * TRAVAIL (Code du travail, L6222-24).
 *
 * Consequence directe : on ne peut pas placer de vacation en magasin un jour
 * ou l'apprenti est en cours. Ce n'est pas une preference d'organisation,
 * c'est une impossibilite : il n'est pas la, et ces heures sont deja comptees.
 */
export const formationEnCentre: Regle = {
  id: 'formation-en-centre',
  nom: 'Formation en centre (apprentissage)',
  reference: 'Code du travail, article L6222-24',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const vacation of vacations) {
      const collaborateur = collaborateurs.find((c) => c.id === vacation.collaborateurId)
      if (collaborateur === undefined) continue

      const periode = enFormation(collaborateur, vacation.jour)
      if (periode === undefined) continue

      infractions.push({
        regle: 'formation-en-centre',
        severite: parametres.severites['formation-en-centre'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: `En formation : ${periode.intitule}`,
        explication:
          `Une vacation est prévue le ${jourEnTexte(vacation.jour)}, alors que la formation ` +
          `« ${periode.intitule} » court du ${jourEnTexte(periode.debut)} au ` +
          `${jourEnTexte(periode.fin)}. Le temps de formation est du temps de travail : ` +
          `il est déjà rémunéré et compté, et la personne n’est pas en magasin.`,
      })
    }

    return infractions
  },
}
