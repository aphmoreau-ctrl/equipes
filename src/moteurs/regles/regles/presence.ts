import { estAbsent, LIBELLES_ABSENCE } from '../../../domaine/absence'
import { disponibiliteDuJour } from '../../../domaine/collaborateur'
import { jourDeLaSemaine, jourEnTexte } from '../../../domaine/calendrier'
import type { Infraction, Regle } from '../types'

/**
 * Trois regles qui disent toutes la meme chose : la personne n'est pas la.
 *
 * Elles sont separees parce qu'elles ne se corrigent pas de la meme facon :
 * une absence se remplace, un repos fixe se deplace, une date de contrat ne
 * se discute pas. Toutes sont bloquantes : un planning qui fait travailler
 * quelqu'un d'absent n'est pas un planning.
 */

/** Une vacation posee un jour declare non disponible (repos fixe). */
export const reposFixe: Regle = {
  id: 'repos-fixe',
  nom: 'Jour de repos fixe',
  reference: 'Contrat de travail et accords individuels',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const vacation of vacations) {
      const collaborateur = collaborateurs.find((c) => c.id === vacation.collaborateurId)
      if (collaborateur === undefined) continue

      const disponibilite = disponibiliteDuJour(collaborateur, jourDeLaSemaine(vacation.jour))
      if (disponibilite.disponible) continue

      infractions.push({
        regle: 'repos-fixe',
        severite: parametres.severites['repos-fixe'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: 'Jour de repos fixe',
        explication:
          `Une vacation est prévue le ${jourEnTexte(vacation.jour)}, alors que ce jour est ` +
          `déclaré non disponible sur sa fiche. Changez le jour, ou corrigez ses ` +
          `disponibilités si elles ont évolué.`,
      })
    }

    return infractions
  },
}

/** Une vacation posee pendant une absence ou un conge accorde. */
export const absenceEnCours: Regle = {
  id: 'absence-en-cours',
  nom: 'Absence ou congé',
  reference: 'Congés payés, arrêts de travail',

  verifier({ vacations, parametres, absences }) {
    const infractions: Infraction[] = []

    for (const vacation of vacations) {
      if (!estAbsent(absences, vacation.collaborateurId, vacation.jour)) continue

      const absence = absences.find(
        (candidate) =>
          candidate.collaborateurId === vacation.collaborateurId &&
          candidate.debut <= vacation.jour &&
          vacation.jour <= candidate.fin,
      )

      infractions.push({
        regle: 'absence-en-cours',
        severite: parametres.severites['absence-en-cours'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: `Absent : ${absence === undefined ? 'absence' : LIBELLES_ABSENCE[absence.type]}`,
        explication:
          `Une vacation est prévue le ${jourEnTexte(vacation.jour)}, alors que la personne est ` +
          `absente` +
          (absence === undefined
            ? '.'
            : ` du ${jourEnTexte(absence.debut)} au ${jourEnTexte(absence.fin)}.`) +
          ` Il faut la remplacer, pas la planifier.`,
      })
    }

    return infractions
  },
}

/** Une vacation posee hors des dates du contrat. */
export const datesDeContrat: Regle = {
  id: 'dates-de-contrat',
  nom: 'Dates du contrat',
  reference: 'Contrat de travail',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const vacation of vacations) {
      const collaborateur = collaborateurs.find((c) => c.id === vacation.collaborateurId)
      if (collaborateur === undefined) continue

      const avantEntree = vacation.jour < collaborateur.dateEntree
      const apresSortie =
        collaborateur.finContrat !== null && vacation.jour > collaborateur.finContrat
      if (!avantEntree && !apresSortie) continue

      infractions.push({
        regle: 'dates-de-contrat',
        severite: parametres.severites['dates-de-contrat'],
        collaborateurId: vacation.collaborateurId,
        jour: vacation.jour,
        libelle: avantEntree ? 'Avant son entrée' : 'Après la fin de son contrat',
        explication: avantEntree
          ? `Une vacation est prévue le ${jourEnTexte(vacation.jour)}, avant son entrée du ` +
            `${jourEnTexte(collaborateur.dateEntree)}.`
          : `Une vacation est prévue le ${jourEnTexte(vacation.jour)}, après la fin de son ` +
            `contrat du ${jourEnTexte(collaborateur.finContrat ?? vacation.jour)}.`,
      })
    }

    return infractions
  },
}
