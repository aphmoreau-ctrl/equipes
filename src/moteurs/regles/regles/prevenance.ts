import { dateEnTexte } from '../../../domaine/calendrier'
import { joursOuvresEntre } from '../reperes'
import type { Infraction, Regle } from '../types'

/**
 * Delai de prevenance : un changement de planning doit etre annonce
 * suffisamment tot. Le controle ne se declenche que sur un planning publie.
 */
export const delaiDePrevenance: Regle = {
  id: 'delai-de-prevenance',
  nom: 'Délai de prévenance',
  reference: 'Code du travail, article L3123-12 ; convention 2216',

  verifier({ vacations, parametres, datePublication }) {
    if (datePublication === null) return []

    const infractions: Infraction[] = []
    const dejaSignales = new Set<string>()

    for (const vacation of vacations) {
      const delai = joursOuvresEntre(datePublication, vacation.jour)
      if (delai >= parametres.delaiDePrevenanceJoursOuvres) continue

      const cle = `${vacation.collaborateurId}|${vacation.jour}`
      if (dejaSignales.has(cle)) continue
      dejaSignales.add(cle)

      infractions.push({
        regle: 'delai-de-prevenance',
        severite: parametres.severites['delai-de-prevenance'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: `Prévenu trop tard : ${delai} jour${delai > 1 ? 's' : ''} ouvré${delai > 1 ? 's' : ''}`,
        explication:
          `Le planning a été publié le ${dateEnTexte(datePublication)}, soit ${delai} ` +
          `jour${delai > 1 ? 's' : ''} ouvré${delai > 1 ? 's' : ''} avant le ` +
          `${dateEnTexte(vacation.jour)}. Le délai retenu est de ` +
          `${parametres.delaiDePrevenanceJoursOuvres} jours ouvrés.`,
      })
    }

    return infractions
  },
}
