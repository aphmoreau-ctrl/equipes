import { TRANCHE_MINUTES, TRANCHES_PAR_JOUR, debutDeTranche } from '../../domaine/temps'
import {
  coefficientDuBloc,
  minutesDuBloc,
  postesNecessaires,
  presenceMinimumDuBloc,
  valeurDuCoefficient,
} from './blocs'
import type {
  BesoinJour,
  ConfigurationRayon,
  ContexteJour,
  NatureCoefficient,
  TrancheBesoin,
} from './types'

const NATURES: readonly NatureCoefficient[] = [
  'saison',
  'meteo',
  'evenement',
  'promotion',
  'qualite',
]

/** Marge minuscule qui protege des imprecisions de calcul sur les nombres a virgule. */
const EPSILON = 1e-9

/**
 * Nombre de personnes necessaires sur une tranche de 30 minutes.
 *
 * Formule du cahier des charges (§7.1) :
 *     besoin = max( presence minimum , arrondi superieur( minutes / 30 - tolerance ) )
 *
 * La tolerance, exprimee en fraction de personne, evite de reclamer quelqu'un
 * de plus pour quelques minutes de travail : avec 0,2, jusqu'a six minutes
 * sont absorbees par les personnes deja presentes.
 */
export function personnesNecessaires(
  minutes: number,
  presenceMinimum: number,
  tolerance: number,
): number {
  const calcule = Math.ceil(minutes / TRANCHE_MINUTES - tolerance - EPSILON)
  return Math.max(presenceMinimum, calcule, 0)
}

/**
 * Calcule le besoin d'un rayon pour une journee, tranche de 30 min par
 * tranche de 30 min, decompose par bloc.
 *
 * Fonction pure et deterministe : a donnees egales, le resultat est identique.
 */
export function calculerBesoin(
  configuration: ConfigurationRayon,
  contexte: ContexteJour,
): BesoinJour {
  const blocsActifs = configuration.blocs.filter((bloc) => bloc.actif)
  const alertes: string[] = []

  // Minutes de chaque bloc, tranche par tranche.
  const contributions = new Map<string, number[]>()
  for (const bloc of blocsActifs) {
    const minutes = minutesDuBloc(bloc, configuration, contexte)
    if (minutes.some((valeur) => valeur > 0)) contributions.set(bloc.id, minutes)

    if (bloc.type === 'transformation') {
      const postes = postesNecessaires(minutes)
      if (postes > bloc.postes + EPSILON) {
        alertes.push(
          `« ${bloc.nom} » demande ${postes.toFixed(1)} postes en pointe, ` +
            `alors que le rayon en compte ${bloc.postes}. Élargissez la plage horaire ` +
            `ou ajoutez un poste.`,
        )
      }
    }
  }

  const tranches: TrancheBesoin[] = []
  let minutesTotal = 0
  let personnesCumulees = 0
  let tranchesSansPersonne = 0

  for (let index = 0; index < TRANCHES_PAR_JOUR; index += 1) {
    const minutesParBloc: Record<string, number> = {}
    const competences = new Set<string>()
    const critiques = new Set<string>()
    let minutesDeLaTranche = 0

    for (const bloc of blocsActifs) {
      const minutes = contributions.get(bloc.id)?.[index] ?? 0
      if (minutes <= 0) continue
      minutesParBloc[bloc.id] = minutes
      minutesDeLaTranche += minutes
      for (const competence of bloc.competences) competences.add(competence)
      for (const competence of bloc.competencesCritiques ?? []) {
        competences.add(competence)
        critiques.add(competence)
      }
    }

    // La presence minimum est la plus exigeante entre celle du rayon (pendant
    // l'ouverture) et celles des blocs qui en reclament une (comptoirs).
    const presenceMinimum = Math.max(
      contexte.tranchesOuvertes.has(index) ? configuration.presenceMinimum : 0,
      ...blocsActifs.map((bloc) => presenceMinimumDuBloc(bloc, contexte, index)),
      0,
    )
    const personnes = personnesNecessaires(
      minutesDeLaTranche,
      presenceMinimum,
      configuration.tolerance,
    )

    if (minutesDeLaTranche > 0 && personnes === 0) tranchesSansPersonne += 1

    minutesTotal += minutesDeLaTranche
    personnesCumulees += personnes

    tranches.push({
      index,
      debutMinutes: debutDeTranche(index),
      minutesParBloc,
      minutesTotal: minutesDeLaTranche,
      personnes,
      competences: [...competences].sort(),
      competencesCritiques: [...critiques].sort(),
    })
  }

  if (tranchesSansPersonne > 0) {
    alertes.push(
      `${tranchesSansPersonne} tranche${tranchesSansPersonne > 1 ? 's' : ''} de 30 minutes ` +
        `comporte${tranchesSansPersonne > 1 ? 'nt' : ''} un peu de travail sans personne ` +
        `prévue : la tolérance l’absorbe, mais il faudra quelqu’un sur place.`,
    )
  }

  const coefficientsAppliques = Object.fromEntries(
    NATURES.map((nature) => [nature, valeurDuCoefficient(nature, configuration, contexte)]),
  ) as Record<NatureCoefficient, number>

  return {
    rayonId: configuration.rayonId,
    date: contexte.date,
    tranches,
    minutesTotal,
    heuresTotal: minutesTotal / 60,
    // Chaque tranche dure une demi-heure : une personne y vaut 0,5 heure.
    heuresPresence: (personnesCumulees * TRANCHE_MINUTES) / 60,
    coefficientsAppliques,
    alertes,
  }
}

/** Total des minutes apportees par chaque bloc sur la journee. */
export function minutesParBlocSurLaJournee(besoin: BesoinJour): Record<string, number> {
  const totaux: Record<string, number> = {}
  for (const tranche of besoin.tranches) {
    for (const [blocId, minutes] of Object.entries(tranche.minutesParBloc)) {
      totaux[blocId] = (totaux[blocId] ?? 0) + minutes
    }
  }
  return totaux
}

/** Besoin maximal en personnes sur la journee. */
export function pointeDeLaJournee(besoin: BesoinJour): number {
  return Math.max(0, ...besoin.tranches.map((tranche) => tranche.personnes))
}

/** Calcule le besoin d'un rayon sur plusieurs jours. */
export function calculerBesoinSurPlusieursJours(
  configuration: ConfigurationRayon,
  contextes: readonly ContexteJour[],
): BesoinJour[] {
  return contextes.map((contexte) => calculerBesoin(configuration, contexte))
}

export { coefficientDuBloc, minutesDuBloc }
