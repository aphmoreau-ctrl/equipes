import { dureeEnTexte } from '../../../domaine/temps'
import { minutesInterditesAuxJeunes } from '../reperes'
import type { Infraction, Regle } from '../types'
import { jourEnTexte } from '../../../domaine/calendrier'

/**
 * Jeunes travailleurs : interdiction de travailler la nuit.
 * Les autres protections (repos de 12 h, 8 h par jour) sont appliquees
 * directement par les regles de repos et de duree quotidienne.
 */
export const jeuneTravailleur: Regle = {
  id: 'jeune-travailleur',
  nom: 'Travail des moins de 18 ans',
  reference: 'Code du travail, articles L3163-1 et suivants',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const vacation of vacations) {
      const collaborateur = collaborateurs.find((c) => c.id === vacation.collaborateurId)
      if (collaborateur?.estMineur !== true) continue

      const minutes = minutesInterditesAuxJeunes(vacation, parametres)
      if (minutes <= 0) continue

      infractions.push({
        regle: 'jeune-travailleur',
        severite: parametres.severites['jeune-travailleur'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: `Travail de nuit interdit : ${dureeEnTexte(minutes)}`,
        explication:
          `La vacation de ${vacation.debut} à ${vacation.fin} le ${jourEnTexte(vacation.jour)} comporte ` +
          `${dureeEnTexte(minutes)} entre ${parametres.jeuneNuitDebut} et ` +
          `${parametres.jeuneNuitFin}, interdites aux salariés de moins de 18 ans.`,
      })
    }

    return infractions
  },
}
