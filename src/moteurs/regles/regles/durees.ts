import { dureeEnTexte } from '../../../domaine/temps'
import { dureeTravailEffectif, grouperParJournee } from '../regroupement'
import { grouperParSemaine, vacationsDe, collaborateursConcernes } from '../reperes'
import type { Infraction, Regle } from '../types'

/** Duree maximale de travail effectif sur une meme journee. */
export const dureeMaximaleQuotidienne: Regle = {
  id: 'duree-maximale-quotidienne',
  nom: 'Durée maximale de travail par jour',
  reference: 'Code du travail, article L3121-18',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const journee of grouperParJournee(vacations)) {
      const total = journee.vacations.reduce(
        (somme, vacation) => somme + dureeTravailEffectif(vacation),
        0,
      )
      const enDerogation = journee.vacations.some((vacation) => vacation.derogation === true)
      const mineur =
        collaborateurs.find((c) => c.id === journee.collaborateurId)?.estMineur === true

      const plafond = mineur
        ? parametres.dureeMaximaleQuotidienneJeuneMinutes
        : enDerogation
          ? parametres.dureeMaximaleQuotidienneDerogationMinutes
          : parametres.dureeMaximaleQuotidienneMinutes

      if (total > plafond) {
        infractions.push({
          regle: 'duree-maximale-quotidienne',
          severite: parametres.severites['duree-maximale-quotidienne'],
          collaborateurId: journee.collaborateurId,
          jour: journee.jour,
          libelle: `Journée trop longue : ${dureeEnTexte(total)} travaillées`,
          explication:
            `${dureeEnTexte(total)} de travail effectif le ${journee.jour}, ` +
            `soit ${dureeEnTexte(total - plafond)} de plus que le plafond de ` +
            `${dureeEnTexte(plafond)}` +
            (mineur ? ' (moins de 18 ans).' : enDerogation ? ' (dérogation exceptionnelle).' : '.'),
        })
      }
    }

    return infractions
  },
}

/** Duree maximale sur une semaine isolee. */
export const dureeMaximaleHebdomadaire: Regle = {
  id: 'duree-maximale-hebdomadaire',
  nom: 'Durée maximale de travail par semaine',
  reference: 'Code du travail, article L3121-20',

  verifier({ vacations, parametres }) {
    const infractions: Infraction[] = []

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      for (const [lundi, semaine] of grouperParSemaine(vacationsDe(vacations, collaborateurId))) {
        const total = semaine.reduce((somme, v) => somme + dureeTravailEffectif(v), 0)
        if (total > parametres.dureeMaximaleHebdomadaireMinutes) {
          infractions.push({
            regle: 'duree-maximale-hebdomadaire',
            severite: parametres.severites['duree-maximale-hebdomadaire'],
            collaborateurId,
            jour: lundi,
            libelle: `Semaine trop longue : ${dureeEnTexte(total)}`,
            explication:
              `${dureeEnTexte(total)} de travail effectif sur la semaine du ${lundi}, ` +
              `soit ${dureeEnTexte(total - parametres.dureeMaximaleHebdomadaireMinutes)} ` +
              `de plus que le plafond de ` +
              `${dureeEnTexte(parametres.dureeMaximaleHebdomadaireMinutes)}.`,
          })
        }
      }
    }

    return infractions
  },
}

/**
 * Moyenne sur douze semaines consecutives.
 * L'historique fourni complete les vacations en cours d'examen.
 */
export const dureeMoyenneSur12Semaines: Regle = {
  id: 'duree-moyenne-12-semaines',
  nom: 'Durée moyenne sur douze semaines',
  reference: 'Code du travail, article L3121-22',

  verifier({ vacations, vacationsAnterieures, parametres }) {
    const infractions: Infraction[] = []
    const toutes = [...vacationsAnterieures, ...vacations]

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      const semaines = [...grouperParSemaine(vacationsDe(toutes, collaborateurId))].sort(
        ([a], [b]) => a.localeCompare(b),
      )

      // On ne se prononce qu'avec douze semaines completes d'historique.
      for (let fin = 12; fin <= semaines.length; fin += 1) {
        const fenetre = semaines.slice(fin - 12, fin)
        const total = fenetre.reduce(
          (somme, [, semaine]) =>
            somme + semaine.reduce((sousTotal, v) => sousTotal + dureeTravailEffectif(v), 0),
          0,
        )
        const moyenne = total / 12

        if (moyenne > parametres.dureeMoyenneMaximaleSur12SemainesMinutes) {
          const premiere = fenetre[0]?.[0] ?? ''
          infractions.push({
            regle: 'duree-moyenne-12-semaines',
            severite: parametres.severites['duree-moyenne-12-semaines'],
            collaborateurId,
            jour: fenetre[11]?.[0] ?? premiere,
            libelle: `Moyenne sur 12 semaines trop élevée : ${dureeEnTexte(Math.round(moyenne))}`,
            explication:
              `Moyenne de ${dureeEnTexte(Math.round(moyenne))} par semaine sur les douze ` +
              `semaines à partir du ${premiere}, au-delà du plafond de ` +
              `${dureeEnTexte(parametres.dureeMoyenneMaximaleSur12SemainesMinutes)}.`,
          })
        }
      }
    }

    return infractions
  },
}
