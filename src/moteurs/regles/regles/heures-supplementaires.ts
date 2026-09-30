import { dureeEnTexte } from '../../../domaine/temps'
import { dureeTravailEffectif } from '../regroupement'
import { collaborateursConcernes, grouperParSemaine, vacationsDe } from '../reperes'
import type { Infraction, Regle } from '../types'

/**
 * Contingent annuel d'heures supplementaires.
 * On additionne les heures au-dela de la duree legale, semaine par semaine,
 * et on ajoute ce qui a deja ete consomme depuis le debut de l'annee.
 */
export const contingentHeuresSupplementaires: Regle = {
  id: 'contingent-heures-supplementaires',
  nom: 'Contingent d’heures supplémentaires',
  reference: 'Convention collective 2216',

  verifier({ vacations, parametres, collaborateurs, heuresSupplementairesAnnuelles }) {
    const infractions: Infraction[] = []

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      const collaborateur = collaborateurs.find((c) => c.id === collaborateurId)
      if (collaborateur !== undefined && !collaborateur.tempsPlein) continue

      let supplementaires = 0
      let derniereSemaine = ''
      for (const [lundi, semaine] of grouperParSemaine(vacationsDe(vacations, collaborateurId))) {
        const total = semaine.reduce((somme, v) => somme + dureeTravailEffectif(v), 0)
        supplementaires += Math.max(0, total - parametres.dureeLegaleHebdomadaireMinutes)
        if (lundi > derniereSemaine) derniereSemaine = lundi
      }

      const dejaConsommees = (heuresSupplementairesAnnuelles[collaborateurId] ?? 0) * 60
      const cumul = dejaConsommees + supplementaires
      const contingent = parametres.contingentHeuresSupplementairesAnnuel * 60

      if (cumul > contingent) {
        infractions.push({
          regle: 'contingent-heures-supplementaires',
          severite: parametres.severites['contingent-heures-supplementaires'],
          collaborateurId,
          jour: derniereSemaine,
          libelle: `Contingent dépassé : ${Math.round(cumul / 60)} h sur ${parametres.contingentHeuresSupplementairesAnnuel} h`,
          explication:
            `${dureeEnTexte(Math.round(dejaConsommees))} déjà effectuées cette année, plus ` +
            `${dureeEnTexte(Math.round(supplementaires))} prévues : le contingent annuel de ` +
            `${parametres.contingentHeuresSupplementairesAnnuel} h serait dépassé. ` +
            `Au-delà, une contrepartie obligatoire en repos est due.`,
        })
      }
    }

    return infractions
  },
}
