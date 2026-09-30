import { dureeDeLaMesure, type Mesure } from '../../domaine/mesure'
import type { Bloc, ConfigurationRayon, NiveauQualite } from './types'

/**
 * Cadences reelles (cahier des charges §7.6 et §7.7).
 *
 * On compare ce que le modele suppose a ce que le chrono a mesure, puis on
 * propose un recalage progressif. Rien n'est applique sans validation :
 * une mesure isolee ne doit pas bouleverser un parametre.
 *
 * Module pur.
 */

export interface CadenceMesuree {
  readonly blocId: string
  readonly nombreDeMesures: number
  /** Minutes par unite, moyennees sur les mesures. */
  readonly minutesParUnite: number
  /** Unites par heure : c'est la « cadence » au sens courant. */
  readonly unitesParHeure: number
  /** Quantite totale mesuree, pour juger de la solidite de la moyenne. */
  readonly quantiteTotale: number
}

/**
 * Moyenne ponderee par les quantites : une mesure sur dix palettes pese plus
 * qu'une mesure sur une seule.
 *
 * Les mesures portant une qualite degradee sont ramenees a une qualite A grace
 * aux coefficients du rayon : sinon, mesurer un jour de mauvaise marchandise
 * fausserait durablement la cadence de reference.
 */
export function mesurerLaCadence(
  mesures: readonly Mesure[],
  blocId: string,
  coefficientsQualite: Readonly<Record<NiveauQualite, number>>,
): CadenceMesuree | null {
  const retenues = mesures.filter((mesure) => mesure.blocId === blocId && mesure.fin !== null)
  if (retenues.length === 0) return null

  let minutes = 0
  let quantite = 0

  for (const mesure of retenues) {
    const duree = dureeDeLaMesure(mesure)
    if (duree === null || duree <= 0 || mesure.quantite <= 0) continue
    const coefficient = mesure.qualite === null ? 1 : coefficientsQualite[mesure.qualite]
    // Ramene a une qualite normale : on divise par le surcout de qualite.
    minutes += duree / (coefficient === 0 ? 1 : coefficient)
    quantite += mesure.quantite
  }

  if (quantite <= 0 || minutes <= 0) return null

  const minutesParUnite = minutes / quantite
  return {
    blocId,
    nombreDeMesures: retenues.length,
    minutesParUnite,
    unitesParHeure: 60 / minutesParUnite,
    quantiteTotale: quantite,
  }
}

export interface PropositionDeRecalage {
  readonly blocId: string
  readonly nomDuBloc: string
  readonly libelleParametre: string
  readonly valeurActuelle: number
  readonly valeurMesuree: number
  /** Valeur recalee progressivement, a appliquer si l'utilisateur l'accepte. */
  readonly valeurProposee: number
  readonly nombreDeMesures: number
  /** Ecart entre le reglage et la mesure, en pourcentage. */
  readonly ecartPourcent: number
}

/** Part de la mesure retenue dans le recalage : 20 % par defaut (§7.7). */
export const POIDS_DE_LA_MESURE = 0.2

/** Nombre de mesures en dessous duquel on ne propose rien. */
export const MESURES_MINIMUM = 3

/** Ecart en dessous duquel le recalage n'en vaut pas la peine. */
export const ECART_MINIMUM_POURCENT = 5

/**
 * Propose de recaler le parametre d'un bloc sur la cadence mesuree.
 * Renvoie null si les mesures sont trop rares ou l'ecart negligeable.
 */
export function proposerUnRecalage(
  bloc: Bloc,
  mesures: readonly Mesure[],
  configuration: ConfigurationRayon,
  poids: number = POIDS_DE_LA_MESURE,
): PropositionDeRecalage | null {
  const cadence = mesurerLaCadence(mesures, bloc.id, configuration.coefficientsQualite)
  if (cadence === null || cadence.nombreDeMesures < MESURES_MINIMUM) return null

  const parametre = parametreMesurable(bloc, cadence)
  if (parametre === null) return null

  const ecart = ((parametre.mesuree - parametre.actuelle) / parametre.actuelle) * 100
  if (Math.abs(ecart) < ECART_MINIMUM_POURCENT) return null

  return {
    blocId: bloc.id,
    nomDuBloc: bloc.nom,
    libelleParametre: parametre.libelle,
    valeurActuelle: parametre.actuelle,
    valeurMesuree: parametre.mesuree,
    // Recalage progressif : 80 % de l'ancien, 20 % de l'observe.
    valeurProposee: arrondir(parametre.actuelle * (1 - poids) + parametre.mesuree * poids),
    nombreDeMesures: cadence.nombreDeMesures,
    ecartPourcent: ecart,
  }
}

function arrondir(valeur: number): number {
  return Math.round(valeur * 100) / 100
}

/** Le parametre d'un bloc que le chrono sait mesurer, et sa valeur du moment. */
function parametreMesurable(
  bloc: Bloc,
  cadence: CadenceMesuree,
): { libelle: string; actuelle: number; mesuree: number } | null {
  switch (bloc.type) {
    case 'mise-en-place':
      return {
        libelle: 'Cadence, en colis par heure',
        actuelle: bloc.cadenceColisParHeure,
        mesuree: arrondir(cadence.unitesParHeure),
      }
    case 'reception':
      return {
        libelle: 'Contrôle, en minutes par palette',
        actuelle: bloc.minutesParPalette,
        mesuree: arrondir(cadence.minutesParUnite),
      }
    case 'tri':
    case 'facing':
      return {
        libelle: 'Minutes par mètre linéaire',
        actuelle: bloc.minutesParMetre,
        mesuree: arrondir(cadence.minutesParUnite),
      }
    case 'controle-dates':
      return {
        libelle: 'Minutes par référence',
        actuelle: bloc.minutesParReference,
        mesuree: arrondir(cadence.minutesParUnite),
      }
    case 'nettoyage':
      return {
        libelle: 'Minutes par meuble ou étal',
        actuelle: bloc.minutesParMeuble,
        mesuree: arrondir(cadence.minutesParUnite),
      }
    case 'plan-cuisson':
      return {
        libelle: 'Minutes par fournée',
        actuelle: bloc.minutesParFournee,
        mesuree: arrondir(cadence.minutesParUnite),
      }
    case 'format-livraison':
      return {
        libelle: 'Minutes par unité reçue',
        actuelle: bloc.minutesParUnite,
        mesuree: arrondir(cadence.minutesParUnite),
      }
    case 'tache-fixe':
      return {
        libelle: 'Durée de la tâche, en minutes',
        actuelle: bloc.minutes,
        mesuree: arrondir(cadence.minutesParUnite),
      }
    // Ces blocs ne se mesurent pas a l'unite : leur duree depend des clients
    // presents ou d'une liste de produits.
    case 'reassort':
    case 'comptoir':
    case 'balances':
    case 'transformation':
      return null
  }
}

/** Applique un recalage accepte au bloc concerne. */
export function appliquerLeRecalage(bloc: Bloc, valeur: number): Bloc {
  switch (bloc.type) {
    case 'mise-en-place':
      return { ...bloc, cadenceColisParHeure: valeur }
    case 'reception':
      return { ...bloc, minutesParPalette: valeur }
    case 'tri':
    case 'facing':
      return { ...bloc, minutesParMetre: valeur }
    case 'controle-dates':
      return { ...bloc, minutesParReference: valeur }
    case 'nettoyage':
      return { ...bloc, minutesParMeuble: valeur }
    case 'plan-cuisson':
      return { ...bloc, minutesParFournee: valeur }
    case 'format-livraison':
      return { ...bloc, minutesParUnite: valeur }
    case 'tache-fixe':
      return { ...bloc, minutes: valeur }
    default:
      return bloc
  }
}

/** Unite naturelle du chrono pour un bloc donne. */
export function uniteDuBloc(bloc: Bloc): import('../../domaine/mesure').UniteMesure {
  switch (bloc.type) {
    case 'mise-en-place':
      return 'colis'
    case 'reception':
      return 'palette'
    case 'tri':
    case 'facing':
      return 'metre'
    case 'controle-dates':
      return 'reference'
    case 'nettoyage':
      return 'piece'
    case 'plan-cuisson':
      return 'fournee'
    case 'format-livraison':
      return 'piece'
    default:
      return 'tache'
  }
}
