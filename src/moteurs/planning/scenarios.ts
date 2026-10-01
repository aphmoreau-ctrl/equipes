import type { Collaborateur } from '../../domaine/collaborateur'
import type { BesoinJour } from '../besoin'
import { calculerCouverture, ecartsAuContrat } from '../indicateurs'
import {
  contexteDeVerification,
  dureeTravailEffectif,
  verifier,
  type ParametresRegles,
  type Vacation,
} from '../regles'
import { penaliser, POIDS_PAR_DEFAUT, type PoidsPenalites } from './score'

/**
 * Scenarios : comparer plusieurs plannings d'une meme semaine (§9.4).
 *
 * On garde cote a cote plusieurs versions d'une meme semaine — par exemple
 * « proposition automatique », « avec un interimaire le samedi », « sans
 * ouverture du dimanche » — et on les compare sur les memes indicateurs.
 *
 * Module pur. Il ne choisit pas : il met les chiffres en face les uns des
 * autres. C'est Arnaud qui tranche.
 */

export interface Scenario {
  readonly id: string
  readonly nom: string
  readonly semaine: string
  readonly vacations: readonly Vacation[]
  readonly creeLe: string
}

export interface ComparaisonScenario {
  readonly scenarioId: string
  readonly nom: string
  /** Part du besoin couverte, de 0 a 1. */
  readonly couverture: number
  readonly heuresPrevues: number
  readonly heuresManquantes: number
  readonly heuresSureffectif: number
  readonly reglesEnfreintes: number
  readonly avertissements: number
  /** Ecart moyen aux heures des contrats, en heures. */
  readonly ecartMoyenAuContrat: number
  /** Nombre de vacations hors du rayon principal. */
  readonly renforts: number
  /** Penalite globale : plus elle est basse, meilleur est le scenario. */
  readonly penalite: number
}

export interface EntreesComparaison {
  readonly scenarios: readonly Scenario[]
  readonly besoins: readonly BesoinJour[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly parametres: ParametresRegles
  readonly poids?: PoidsPenalites
  readonly vacationsAnterieures?: readonly Vacation[]
}

/**
 * Compare les scenarios sur les memes indicateurs.
 * Le resultat est trie du meilleur au moins bon, au sens de la penalite
 * globale — ce qui ne dispense pas de regarder le detail.
 */
export function comparerLesScenarios(entrees: EntreesComparaison): ComparaisonScenario[] {
  const poids = entrees.poids ?? POIDS_PAR_DEFAUT
  const actifs = entrees.collaborateurs.filter((collaborateur) => collaborateur.actif)

  return entrees.scenarios
    .map((scenario): ComparaisonScenario => {
      let besoinTotal = 0
      let manqueTotal = 0
      let sureffectifTotal = 0

      for (const besoin of entrees.besoins) {
        const couverture = calculerCouverture(besoin, scenario.vacations, entrees.collaborateurs)
        besoinTotal += couverture.heuresBesoin
        manqueTotal += couverture.heuresManquantes
        sureffectifTotal += couverture.heuresSureffectif
      }

      const infractions = verifier(
        contexteDeVerification(scenario.vacations, entrees.parametres, {
          collaborateurs: entrees.collaborateurs,
          vacationsAnterieures: entrees.vacationsAnterieures ?? [],
        }),
      )

      const ecarts = ecartsAuContrat(scenario.vacations, actifs)
      const ecartMoyen =
        ecarts.length === 0
          ? 0
          : ecarts.reduce((somme, ecart) => somme + Math.abs(ecart.ecart), 0) / ecarts.length

      return {
        scenarioId: scenario.id,
        nom: scenario.nom,
        couverture: besoinTotal === 0 ? 1 : 1 - manqueTotal / besoinTotal,
        heuresPrevues:
          scenario.vacations.reduce((somme, v) => somme + dureeTravailEffectif(v), 0) / 60,
        heuresManquantes: manqueTotal,
        heuresSureffectif: sureffectifTotal,
        reglesEnfreintes: infractions.filter((i) => i.severite === 'bloquante').length,
        avertissements: infractions.filter((i) => i.severite === 'avertissement').length,
        ecartMoyenAuContrat: ecartMoyen,
        renforts: scenario.vacations.filter((vacation) => {
          const collaborateur = actifs.find((c) => c.id === vacation.collaborateurId)
          return collaborateur !== undefined && collaborateur.rayonPrincipal !== vacation.rayonId
        }).length,
        penalite: penaliser(scenario.vacations, entrees.besoins, actifs, poids).total,
      }
    })
    .sort(
      (a, b) =>
        a.reglesEnfreintes - b.reglesEnfreintes ||
        a.penalite - b.penalite ||
        a.scenarioId.localeCompare(b.scenarioId),
    )
}

/**
 * Scenario le mieux place, ou null s'il n'y a rien a comparer.
 * Un scenario qui enfreint une regle ne peut jamais etre « le meilleur » :
 * le tri le relegue d'office derriere ceux qui n'en enfreignent aucune.
 */
export function meilleurScenario(comparaisons: readonly ComparaisonScenario[]): string | null {
  return comparaisons[0]?.scenarioId ?? null
}

/** Ce qui distingue deux scenarios, en francais. */
export function expliquerLaDifference(
  reference: ComparaisonScenario,
  autre: ComparaisonScenario,
): string[] {
  const differences: string[] = []

  const couverture = Math.round((autre.couverture - reference.couverture) * 100)
  if (couverture !== 0) {
    differences.push(
      `${couverture > 0 ? '+' : ''}${couverture} points de couverture du besoin`,
    )
  }

  const heures = autre.heuresPrevues - reference.heuresPrevues
  if (Math.abs(heures) >= 0.5) {
    differences.push(`${heures > 0 ? '+' : ''}${heures.toFixed(1)} h de travail prévu`)
  }

  const regles = autre.reglesEnfreintes - reference.reglesEnfreintes
  if (regles !== 0) {
    differences.push(
      `${regles > 0 ? '+' : ''}${regles} règle${Math.abs(regles) > 1 ? 's' : ''} enfreinte${Math.abs(regles) > 1 ? 's' : ''}`,
    )
  }

  const renforts = autre.renforts - reference.renforts
  if (renforts !== 0) {
    differences.push(
      `${renforts > 0 ? '+' : ''}${renforts} vacation${Math.abs(renforts) > 1 ? 's' : ''} en renfort hors rayon`,
    )
  }

  const ecart = autre.ecartMoyenAuContrat - reference.ecartMoyenAuContrat
  if (Math.abs(ecart) >= 0.5) {
    differences.push(
      `${ecart > 0 ? '+' : ''}${ecart.toFixed(1)} h d’écart moyen aux contrats`,
    )
  }

  return differences
}
