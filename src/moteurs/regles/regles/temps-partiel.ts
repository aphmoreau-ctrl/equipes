import { dureeEnTexte } from '../../../domaine/temps'
import { minutesHebdomadaires } from '../../../domaine/collaborateur'
import { dureeTravailEffectif, grouperParJournee } from '../regroupement'
import { collaborateursConcernes, debutDe, finDe, grouperParSemaine, vacationsDe } from '../reperes'
import type { Infraction, Regle, Vacation } from '../types'
import { jourEnTexte } from '../../../domaine/calendrier'

/**
 * Temps partiel : nombre et duree des coupures dans une journee.
 * Une coupure est l'intervalle entre deux vacations du meme jour.
 */
export const coupuresTempsPartiel: Regle = {
  id: 'temps-partiel-coupures',
  nom: 'Coupures des temps partiels',
  reference: 'Code du travail, article L3123-23',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const journee of grouperParJournee(vacations)) {
      const collaborateur = collaborateurs.find((c) => c.id === journee.collaborateurId)
      if (collaborateur === undefined || collaborateur.tempsPlein) continue

      const ordonnees = [...journee.vacations].sort((a, b) => debutDe(a) - debutDe(b))
      const coupures: number[] = []
      for (let index = 1; index < ordonnees.length; index += 1) {
        coupures.push(debutDe(ordonnees[index] as Vacation) - finDe(ordonnees[index - 1] as Vacation))
      }

      if (coupures.length > parametres.coupuresMaximumParJour) {
        infractions.push({
          regle: 'temps-partiel-coupures',
          severite: parametres.severites['temps-partiel-coupures'],
          collaborateurId: journee.collaborateurId,
          jour: journee.jour,
          libelle: `${coupures.length} coupures dans la journée`,
          explication:
            `La journée du ${jourEnTexte(journee.jour)} comporte ${coupures.length} coupures, ` +
            `alors que le maximum retenu est de ${parametres.coupuresMaximumParJour}.`,
        })
      }

      for (const coupure of coupures) {
        if (coupure > parametres.dureeMaximaleCoupureMinutes) {
          infractions.push({
            regle: 'temps-partiel-coupures',
            severite: parametres.severites['temps-partiel-coupures'],
            collaborateurId: journee.collaborateurId,
            jour: journee.jour,
            libelle: `Coupure trop longue : ${dureeEnTexte(coupure)}`,
            explication:
              `Une coupure de ${dureeEnTexte(coupure)} le ${jourEnTexte(journee.jour)}, au-delà du ` +
              `maximum de ${dureeEnTexte(parametres.dureeMaximaleCoupureMinutes)}.`,
          })
          break
        }
      }
    }

    return infractions
  },
}

/** Heures complementaires : depassement du contrat d'un temps partiel. */
export const heuresComplementaires: Regle = {
  id: 'heures-complementaires',
  nom: 'Heures complémentaires des temps partiels',
  reference: 'Code du travail, article L3123-8',

  verifier({ vacations, parametres, collaborateurs }) {
    const infractions: Infraction[] = []

    for (const collaborateurId of collaborateursConcernes(vacations)) {
      const collaborateur = collaborateurs.find((c) => c.id === collaborateurId)
      if (collaborateur === undefined || collaborateur.tempsPlein) continue

      const contrat = minutesHebdomadaires(collaborateur)
      const plafond = Math.round(
        contrat * (1 + parametres.plafondHeuresComplementairesPourcent / 100),
      )

      for (const [lundi, semaine] of grouperParSemaine(vacationsDe(vacations, collaborateurId))) {
        const total = semaine.reduce((somme, v) => somme + dureeTravailEffectif(v), 0)

        if (total > plafond) {
          infractions.push({
            regle: 'heures-complementaires',
            severite: parametres.severites['heures-complementaires'],
            collaborateurId,
            jour: lundi,
            libelle: `Heures complémentaires dépassées : ${dureeEnTexte(total)}`,
            explication:
              `${dureeEnTexte(total)} prévues la semaine du ${lundi}, pour un contrat de ` +
              `${dureeEnTexte(contrat)}. Le plafond est de ${dureeEnTexte(plafond)} ` +
              `(${parametres.plafondHeuresComplementairesPourcent} % au-dessus du contrat).`,
          })
        }

        /*
         * Les heures complementaires ne peuvent JAMAIS porter la duree de
         * travail au niveau de la duree legale (L3123-9) : au-dela, le contrat
         * devrait etre requalifie en temps plein.
         */
        if (total >= parametres.dureeLegaleHebdomadaireMinutes) {
          infractions.push({
            regle: 'heures-complementaires',
            severite: parametres.severites['heures-complementaires'],
            collaborateurId,
            jour: lundi,
            libelle: `Temps partiel porté à la durée légale : ${dureeEnTexte(total)}`,
            explication:
              `${dureeEnTexte(total)} prévues la semaine du ${lundi} pour un contrat à temps ` +
              `partiel. Les heures complémentaires ne peuvent jamais atteindre la durée ` +
              `légale de ${dureeEnTexte(parametres.dureeLegaleHebdomadaireMinutes)} : ` +
              `le contrat devrait alors être requalifié en temps plein.`,
          })
        }
      }
    }

    return infractions
  },
}

/**
 * Duree minimale d'un contrat a temps partiel.
 * Controle du CONTRAT, pas du planning : il se declenche meme sans vacation.
 */
export function verifierDureeMinimaleTempsPartiel(
  collaborateurs: readonly import('../../../domaine/collaborateur').Collaborateur[],
  parametres: import('../types').ParametresRegles,
): Infraction[] {
  const infractions: Infraction[] = []

  for (const collaborateur of collaborateurs) {
    if (!collaborateur.actif || collaborateur.tempsPlein) continue

    const contrat = minutesHebdomadaires(collaborateur)
    if (contrat >= parametres.dureeMinimaleTempsPartielMinutes) continue

    /*
     * Aucune dispense silencieuse : meme pour un etudiant ou un apprenti, le
     * constat est affiche. La derogation existe, mais elle doit etre ECRITE :
     * la signaler vaut mieux que la supposer.
     */
    const derogationCourante =
      collaborateur.contrat === 'etudiant' || collaborateur.contrat === 'apprenti'

    infractions.push({
      regle: 'temps-partiel-coupures',
      severite: 'avertissement',
      collaborateurId: collaborateur.id,
      jour: collaborateur.dateEntree,
      libelle: `Contrat sous la durée minimale : ${dureeEnTexte(contrat)}`,
      explication:
        `Le contrat prévoit ${dureeEnTexte(contrat)} par semaine, sous la durée minimale ` +
        `de ${dureeEnTexte(parametres.dureeMinimaleTempsPartielMinutes)}. ` +
        (derogationCourante
          ? `Une dérogation existe pour ce type de contrat, mais elle doit figurer par écrit.`
          : `Une dérogation écrite est nécessaire (demande du salarié, cumul d’emplois, études).`),
    })
  }

  return infractions
}
