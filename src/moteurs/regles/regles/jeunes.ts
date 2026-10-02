import { dureeEnTexte } from '../../../domaine/temps'
import { minutesInterditesAuxJeunes } from '../reperes'
import type { Infraction, Regle } from '../types'
import { estMineur } from '../../../domaine/collaborateur'
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
      if (collaborateur === undefined || !estMineur(collaborateur)) continue

      /*
       * La loi distingue deux tranches : avant 16 ans, le travail s'arrete a
       * 20 h ; de 16 a 17 ans, a 22 h. Reprise a 6 h dans les deux cas.
       */
      const avant16 = collaborateur.trancheAge === 'moins-de-16'
      const debut = avant16 ? parametres.moinsDe16NuitDebut : parametres.jeuneNuitDebut
      const fin = avant16 ? parametres.moinsDe16NuitFin : parametres.jeuneNuitFin

      const minutes = minutesInterditesAuxJeunes(vacation, parametres, collaborateur.trancheAge)
      if (minutes <= 0) continue

      infractions.push({
        regle: 'jeune-travailleur',
        severite: parametres.severites['jeune-travailleur'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: `Travail de nuit interdit : ${dureeEnTexte(minutes)}`,
        explication:
          `La vacation de ${vacation.debut} à ${vacation.fin} le ${jourEnTexte(vacation.jour)} comporte ` +
          `${dureeEnTexte(minutes)} entre ${debut} et ${fin}, interdites aux salariés de ` +
          (avant16 ? 'moins de 16 ans.' : '16 ou 17 ans.'),
      })
    }

    return infractions
  },
}
