import { dureeEnTexte } from '../../../domaine/temps'
import { dureeTravailEffectif } from '../regroupement'
import type { Infraction, Regle } from '../types'

/** Pause obligatoire des que le travail atteint un certain seuil. */
export const pauseObligatoire: Regle = {
  id: 'pause-obligatoire',
  nom: 'Pause obligatoire',
  reference: 'Code du travail, article L3121-16',

  verifier({ vacations, parametres }) {
    const infractions: Infraction[] = []

    for (const vacation of vacations) {
      const travail = dureeTravailEffectif(vacation)
      if (travail < parametres.seuilDeclenchantLaPauseMinutes) continue
      if (vacation.pauseMinutes >= parametres.dureeMinimaleDeLaPauseMinutes) continue

      infractions.push({
        regle: 'pause-obligatoire',
        severite: parametres.severites['pause-obligatoire'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: `Pause manquante sur ${dureeEnTexte(travail)} de travail`,
        explication:
          `La vacation de ${vacation.debut} à ${vacation.fin} atteint ` +
          `${dureeEnTexte(travail)} de travail : une pause d’au moins ` +
          `${dureeEnTexte(parametres.dureeMinimaleDeLaPauseMinutes)} est due dès ` +
          `${dureeEnTexte(parametres.seuilDeclenchantLaPauseMinutes)}. ` +
          `La vacation n’en prévoit que ${vacation.pauseMinutes} min.`,
      })
    }

    return infractions
  },
}
