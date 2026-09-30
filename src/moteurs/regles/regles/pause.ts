import { dureeEnTexte } from '../../../domaine/temps'
import { dureeTravailEffectif, grouperParJournee } from '../regroupement'
import type { Infraction, Regle } from '../types'

/**
 * Pause obligatoire : « des que le temps de travail QUOTIDIEN atteint six
 * heures, le salarie beneficie d'un temps de pause d'une duree minimale de
 * vingt minutes consecutives » (L3121-16). Les moins de 18 ans ont droit a
 * 30 minutes des 4 h 30 (L3162-3).
 *
 * Le controle porte sur la JOURNEE, pas sur chaque vacation : deux vacations
 * de 3 h 30 font 7 h de travail et ouvrent droit a la pause, meme si aucune
 * d'elles n'atteint six heures a elle seule.
 *
 * Interpretation retenue, la plus protectrice : une coupure entre deux
 * vacations n'est PAS comptee comme une pause. La pause doit etre accordee
 * pendant le temps de travail et figurer comme telle au planning.
 */
export const pauseObligatoire: Regle = {
  id: 'pause-obligatoire',
  nom: 'Pause obligatoire',
  reference: 'Code du travail, article L3121-16',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const journee of grouperParJournee(vacations)) {
      const mineur =
        collaborateurs.find((c) => c.id === journee.collaborateurId)?.estMineur === true
      const seuil = mineur
        ? parametres.seuilDeclenchantLaPauseJeuneMinutes
        : parametres.seuilDeclenchantLaPauseMinutes
      const minimum = mineur
        ? parametres.dureeMinimaleDeLaPauseJeuneMinutes
        : parametres.dureeMinimaleDeLaPauseMinutes

      const travail = journee.vacations.reduce(
        (somme, vacation) => somme + dureeTravailEffectif(vacation),
        0,
      )
      if (travail < seuil) continue

      const pause = journee.vacations.reduce(
        (somme, vacation) => somme + vacation.pauseMinutes,
        0,
      )
      if (pause >= minimum) continue

      infractions.push({
        regle: 'pause-obligatoire',
        severite: parametres.severites['pause-obligatoire'],
        collaborateurId: journee.collaborateurId,
        jour: journee.jour,
        libelle: `Pause manquante sur ${dureeEnTexte(travail)} de travail`,
        explication:
          `Le ${journee.jour}, ${dureeEnTexte(travail)} de travail effectif : une pause ` +
          `d’au moins ${dureeEnTexte(minimum)} est due dès ${dureeEnTexte(seuil)}` +
          (mineur ? ' pour un salarié de moins de 18 ans' : '') +
          `. Le planning n’en prévoit que ${pause} min.`,
      })
    }

    return infractions
  },
}
