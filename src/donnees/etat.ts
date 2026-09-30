import type { Collaborateur } from '../domaine/collaborateur'
import type { Magasin } from '../domaine/magasin'
import type { Planning } from '../domaine/planning'
import { planningVide } from '../domaine/planning'
import type { ReglagesAlertes } from '../moteurs/alertes'
import type { ParametresRegles } from '../moteurs/regles'
import { PARAMETRES_PAR_DEFAUT } from '../moteurs/regles'
import { REGLAGES_ALERTES_PAR_DEFAUT } from '../moteurs/alertes'
import type { ConfigurationRayon, Meteo, SaisieQualite } from '../moteurs/besoin'
import { COLLABORATEURS_DEMO } from './collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from './demo'

/**
 * Etat complet de l'application, conserve sur l'appareil.
 *
 * Jusqu'au lot 4, tout vit dans le stockage du navigateur : aucune
 * synchronisation entre appareils. Firebase prendra le relais, et cette
 * structure servira alors de format d'echange.
 */

export const VERSION_ETAT = 1

export interface EtatApplication {
  readonly version: number
  readonly magasin: Magasin
  readonly configurations: readonly ConfigurationRayon[]
  readonly collaborateurs: readonly Collaborateur[]
  /** Plannings, reperes par le lundi de leur semaine. */
  readonly plannings: Readonly<Record<string, Planning>>
  /** Heures supplementaires deja consommees cette annee, par collaborateur. */
  readonly heuresSupplementairesAnnuelles: Readonly<Record<string, number>>
  readonly reglagesAlertes: ReglagesAlertes
  /** Regles legales et conventionnelles, toutes modifiables. */
  readonly reglesParametres: ParametresRegles
  readonly saisiesQualite: readonly SaisieQualite[]
  /** Meteo constatee, par date. Absente = « normal ». */
  readonly meteoParDate: Readonly<Record<string, Meteo>>
  /** Rayons en promotion, par date. */
  readonly promotionsParDate: Readonly<Record<string, readonly string[]>>
  /** Les donnees affichees sont-elles celles de la demonstration ? */
  readonly demonstration: boolean
}

export function etatInitial(): EtatApplication {
  return {
    version: VERSION_ETAT,
    magasin: MAGASIN_DEMO,
    configurations: CONFIGURATIONS_DEMO,
    collaborateurs: COLLABORATEURS_DEMO,
    plannings: {},
    heuresSupplementairesAnnuelles: {},
    reglagesAlertes: REGLAGES_ALERTES_PAR_DEFAUT,
    reglesParametres: PARAMETRES_PAR_DEFAUT,
    saisiesQualite: [],
    meteoParDate: {},
    promotionsParDate: {},
    demonstration: true,
  }
}

const CLE = 'equipes.donnees.v1'

/**
 * Relit l'etat enregistre. En cas de doute (donnee absente, illisible, d'une
 * version inconnue), on repart des donnees de demonstration plutot que de
 * planter : l'application doit toujours s'ouvrir.
 */
export function lireEtat(): EtatApplication {
  try {
    const brut = window.localStorage.getItem(CLE)
    if (brut === null) return etatInitial()
    const valeur: unknown = JSON.parse(brut)
    if (
      typeof valeur !== 'object' ||
      valeur === null ||
      (valeur as EtatApplication).version !== VERSION_ETAT
    ) {
      return etatInitial()
    }
    return { ...etatInitial(), ...(valeur as EtatApplication) }
  } catch {
    return etatInitial()
  }
}

export function enregistrerEtat(etat: EtatApplication): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(etat))
  } catch {
    // Stockage indisponible : les modifications ne survivront pas a la fermeture.
  }
}

export function effacerEtat(): void {
  try {
    window.localStorage.removeItem(CLE)
  } catch {
    // Rien a faire.
  }
}

/** Meteo retenue pour une date. */
export function meteoDuJour(etat: EtatApplication, date: string): Meteo {
  return etat.meteoParDate[date] ?? 'normal'
}

/** Vrai si ce rayon est en promotion ce jour-la. */
export function enPromotion(etat: EtatApplication, date: string, rayonId: string): boolean {
  return (etat.promotionsParDate[date] ?? []).includes(rayonId)
}

export function configurationDeRayon(
  etat: EtatApplication,
  rayonId: string,
): ConfigurationRayon | undefined {
  return etat.configurations.find((configuration) => configuration.rayonId === rayonId)
}

/** Saisies de qualite d'un rayon pour une date. */
export function saisiesDuJour(
  etat: EtatApplication,
  date: string,
  rayonId: string,
): SaisieQualite[] {
  return etat.saisiesQualite.filter(
    (saisie) => saisie.date === date && saisie.rayonId === rayonId,
  )
}

/** Planning d'une semaine, cree vide s'il n'existe pas encore. */
export function planningDeLaSemaine(etat: EtatApplication, semaine: string): Planning {
  return etat.plannings[semaine] ?? planningVide(semaine)
}

/** Vacations des semaines precedentes, pour les regles qui regardent l'historique. */
export function vacationsAnterieures(etat: EtatApplication, semaine: string) {
  return Object.values(etat.plannings)
    .filter((planning) => planning.semaine < semaine)
    .flatMap((planning) => planning.vacations)
}
