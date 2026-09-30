import { dureeEnTexte } from '../../../domaine/temps'
import { dureeTravailEffectif, grouperParJournee } from '../regroupement'
import type { Infraction, Regle } from '../types'

/**
 * Duree maximale de travail effectif sur une meme journee.
 *
 * Toutes les vacations d'une meme personne le meme jour sont additionnees,
 * pauses deduites. Un jour marque en derogation beneficie du plafond eleve
 * (inventaire et autres cas exceptionnels).
 */
export const dureeMaximaleQuotidienne: Regle = {
  id: 'duree-maximale-quotidienne',
  nom: 'Durée maximale de travail par jour',
  reference: 'Code du travail, article L3121-18',

  verifier(vacations, parametres) {
    const infractions: Infraction[] = []

    for (const journee of grouperParJournee(vacations)) {
      const total = journee.vacations.reduce(
        (somme, vacation) => somme + dureeTravailEffectif(vacation),
        0,
      )
      const enDerogation = journee.vacations.some((vacation) => vacation.derogation === true)
      const plafond = enDerogation
        ? parametres.dureeMaximaleQuotidienneDerogationMinutes
        : parametres.dureeMaximaleQuotidienneMinutes

      if (total > plafond) {
        const depassement = total - plafond
        infractions.push({
          regle: 'duree-maximale-quotidienne',
          severite: parametres.severites['duree-maximale-quotidienne'],
          collaborateurId: journee.collaborateurId,
          jour: journee.jour,
          libelle: `Journée trop longue : ${dureeEnTexte(total)} travaillées`,
          explication:
            `${dureeEnTexte(total)} de travail effectif le ${journee.jour}, ` +
            `soit ${dureeEnTexte(depassement)} de plus que le plafond de ${dureeEnTexte(plafond)}` +
            (enDerogation ? ' (dérogation exceptionnelle appliquée).' : '.'),
        })
      }
    }

    return infractions
  },
}
