import { estFerie, jourDeLaSemaine, moisDe } from '../../domaine/calendrier'
import { nomAffiche, type Collaborateur } from '../../domaine/collaborateur'
import type { Minutes } from '../../domaine/temps'
import {
  dureeTravailEffectif,
  grouperParSemaine,
  minutesDeNuit,
  vacationsDe,
  type ParametresRegles,
  type Vacation,
} from '../regles'
import { nombreEnTexte } from '../../domaine/nombres'

/**
 * Heures et elements variables de paie (cahier des charges §11).
 *
 * Module pur. Il ne calcule PAS un bulletin : il prepare les elements
 * variables a transmettre, avec le detail qui permet de les verifier.
 * Le bulletin de paie fait foi.
 */

/** Heures reellement effectuees, saisies a la main ou importees plus tard. */
export interface SaisieHeures {
  readonly id: string
  readonly collaborateurId: string
  readonly jour: string
  /** Minutes de travail effectif reellement realisees. */
  readonly minutesRealisees: Minutes
}

export interface ParametresHeures {
  /** Majoration des huit premieres heures supplementaires, en pourcentage. */
  readonly majorationHeuresSup25: number
  /** Majoration au-dela, en pourcentage. */
  readonly majorationHeuresSup50: number
  /** Seuil, en heures, au-dela duquel on passe a la majoration superieure. */
  readonly seuilMajorationSuperieure: number
  /** Majoration des heures complementaires des temps partiels. */
  readonly majorationHeuresComplementaires: number
}

export const PARAMETRES_HEURES_PAR_DEFAUT: ParametresHeures = {
  majorationHeuresSup25: 25,
  majorationHeuresSup50: 50,
  // De 35 h a 43 h : +25 %. Au-dela de 43 h : +50 %.
  seuilMajorationSuperieure: 43,
  majorationHeuresComplementaires: 10,
}

export interface ElementsVariables {
  readonly collaborateurId: string
  readonly nom: string
  /** Mois concerne, « AAAA-MM ». */
  readonly mois: string
  readonly heuresPrevues: number
  readonly heuresRealisees: number
  /** Ecart entre le realise et le prevu. */
  readonly ecart: number
  readonly heuresSupplementaires25: number
  readonly heuresSupplementaires50: number
  readonly heuresComplementaires: number
  readonly heuresDeNuit: number
  readonly dimanchesTravailles: number
  readonly joursFeriesTravailles: number
  readonly heuresFeriesTravaillees: number
}

/** Heures realisees d'une journee : la saisie l'emporte sur le prevu. */
export function minutesRealisees(
  vacations: readonly Vacation[],
  saisies: readonly SaisieHeures[],
  collaborateurId: string,
  jour: string,
): Minutes {
  const saisie = saisies.find(
    (candidate) => candidate.collaborateurId === collaborateurId && candidate.jour === jour,
  )
  if (saisie !== undefined) return saisie.minutesRealisees

  return vacations
    .filter((vacation) => vacation.collaborateurId === collaborateurId && vacation.jour === jour)
    .reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0)
}

/**
 * Elements variables d'un mois, personne par personne.
 *
 * Les heures supplementaires se comptent SEMAINE par semaine : c'est la regle,
 * et c'est ce qui evite de les diluer sur le mois.
 */
export function calculerLesElementsVariables(
  mois: string,
  vacations: readonly Vacation[],
  saisies: readonly SaisieHeures[],
  collaborateurs: readonly Collaborateur[],
  parametresRegles: ParametresRegles,
  parametres: ParametresHeures = PARAMETRES_HEURES_PAR_DEFAUT,
): ElementsVariables[] {
  const duMois = vacations.filter((vacation) => vacation.jour.slice(0, 7) === mois)
  const numeroDuMois = Number(mois.slice(5, 7))

  return collaborateurs
    .filter((collaborateur) => collaborateur.actif)
    .map((collaborateur) => {
      const siennes = vacationsDe(duMois, collaborateur.id)

      let prevues = 0
      let realisees = 0
      let nuit = 0
      let dimanches = 0
      let feries = 0
      let heuresFeries = 0

      const joursVus = new Set<string>()
      for (const vacation of siennes) {
        prevues += dureeTravailEffectif(vacation)
        nuit += minutesDeNuit(vacation, parametresRegles.nuitDebut, parametresRegles.nuitFin)

        if (!joursVus.has(vacation.jour)) {
          joursVus.add(vacation.jour)
          realisees += minutesRealisees(duMois, saisies, collaborateur.id, vacation.jour)
          if (jourDeLaSemaine(vacation.jour) === 7) dimanches += 1
          if (estFerie(vacation.jour)) feries += 1
        }
        if (estFerie(vacation.jour)) heuresFeries += dureeTravailEffectif(vacation)
      }

      // Heures supplementaires et complementaires, semaine par semaine.
      let sup25 = 0
      let sup50 = 0
      let complementaires = 0
      const legale = parametresRegles.dureeLegaleHebdomadaireMinutes
      const seuilHaut = parametres.seuilMajorationSuperieure * 60

      for (const [, semaine] of grouperParSemaine(siennes)) {
        // On ne retient que les semaines dont le mois correspond.
        const total = semaine.reduce((somme, v) => somme + dureeTravailEffectif(v), 0)
        if (semaine.some((v) => moisDe(v.jour) !== numeroDuMois)) {
          // Semaine a cheval : on ne compte que ce qui tombe dans le mois.
          const dansLeMois = semaine.filter((v) => moisDe(v.jour) === numeroDuMois)
          if (dansLeMois.length === 0) continue
        }

        if (collaborateur.tempsPlein) {
          const au25 = Math.max(0, Math.min(total, seuilHaut) - legale)
          const au50 = Math.max(0, total - seuilHaut)
          sup25 += au25
          sup50 += au50
        } else {
          complementaires += Math.max(0, total - collaborateur.heuresHebdomadaires * 60)
        }
      }

      return {
        collaborateurId: collaborateur.id,
        nom: nomAffiche(collaborateur),
        mois,
        heuresPrevues: prevues / 60,
        heuresRealisees: realisees / 60,
        ecart: (realisees - prevues) / 60,
        heuresSupplementaires25: sup25 / 60,
        heuresSupplementaires50: sup50 / 60,
        heuresComplementaires: complementaires / 60,
        heuresDeNuit: nuit / 60,
        dimanchesTravailles: dimanches,
        joursFeriesTravailles: feries,
        heuresFeriesTravaillees: heuresFeries / 60,
      }
    })
    .filter((elements) => elements.heuresPrevues > 0 || elements.heuresRealisees > 0)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

/** Arrondi a deux decimales, pour un export lisible. */
function arrondir(valeur: number): string {
  return nombreEnTexte(valeur, 2)
}

/**
 * Export des elements variables au format CSV, lisible par un tableur.
 *
 * Separateur point-virgule et virgule decimale : c'est ce qu'attend un tableur
 * francais. Aucune donnee interdite : prenom, initiale, heures et compteurs.
 */
export function exporterEnCsv(elements: readonly ElementsVariables[]): string {
  const entetes = [
    'Collaborateur',
    'Mois',
    'Heures prévues',
    'Heures réalisées',
    'Écart',
    'Heures sup. 25 %',
    'Heures sup. 50 %',
    'Heures complémentaires',
    'Heures de nuit',
    'Dimanches travaillés',
    'Jours fériés travaillés',
    'Heures fériées',
  ]

  const lignes = elements.map((element) =>
    [
      element.nom,
      element.mois,
      arrondir(element.heuresPrevues),
      arrondir(element.heuresRealisees),
      arrondir(element.ecart),
      arrondir(element.heuresSupplementaires25),
      arrondir(element.heuresSupplementaires50),
      arrondir(element.heuresComplementaires),
      arrondir(element.heuresDeNuit),
      String(element.dimanchesTravailles),
      String(element.joursFeriesTravailles),
      arrondir(element.heuresFeriesTravaillees),
    ].join(';'),
  )

  return [entetes.join(';'), ...lignes].join('\r\n')
}

/** Totaux du mois, pour le tableau de bord. */
export function totaliser(elements: readonly ElementsVariables[]): {
  readonly heuresPrevues: number
  readonly heuresRealisees: number
  readonly heuresSupplementaires: number
  readonly heuresComplementaires: number
  readonly heuresDeNuit: number
} {
  return {
    heuresPrevues: elements.reduce((s, e) => s + e.heuresPrevues, 0),
    heuresRealisees: elements.reduce((s, e) => s + e.heuresRealisees, 0),
    heuresSupplementaires: elements.reduce(
      (s, e) => s + e.heuresSupplementaires25 + e.heuresSupplementaires50,
      0,
    ),
    heuresComplementaires: elements.reduce((s, e) => s + e.heuresComplementaires, 0),
    heuresDeNuit: elements.reduce((s, e) => s + e.heuresDeNuit, 0),
  }
}
