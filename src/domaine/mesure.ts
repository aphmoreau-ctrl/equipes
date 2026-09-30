import type { NiveauQualite } from '../moteurs/besoin'

/**
 * Mode chrono (cahier des charges §7.6) : mesurer le temps reellement passe
 * sur une tache, pour connaitre les cadences du magasin plutot que de s'en
 * remettre a des valeurs par defaut.
 *
 * Module pur.
 */

export type UniteMesure = 'colis' | 'palette' | 'metre' | 'reference' | 'piece' | 'fournee' | 'tache'

export const LIBELLES_UNITE: Readonly<Record<UniteMesure, string>> = {
  colis: 'colis',
  palette: 'palettes',
  metre: 'mètres',
  reference: 'références',
  piece: 'pièces',
  fournee: 'fournées',
  tache: 'fois',
}

export interface Mesure {
  readonly id: string
  readonly rayonId: string
  /** Bloc mesure, pour comparer a son parametre. */
  readonly blocId: string
  /** Debut du chrono, horodatage complet. */
  readonly debut: string
  /** Fin du chrono, ou null si le chrono tourne encore. */
  readonly fin: string | null
  readonly quantite: number
  readonly unite: UniteMesure
  /** Qualite constatee, quand elle influe sur la duree. */
  readonly qualite: NiveauQualite | null
}

/** Duree d'une mesure terminee, en minutes. */
export function dureeDeLaMesure(mesure: Mesure): number | null {
  if (mesure.fin === null) return null
  const debut = Date.parse(mesure.debut)
  const fin = Date.parse(mesure.fin)
  if (Number.isNaN(debut) || Number.isNaN(fin) || fin < debut) return null
  return (fin - debut) / 60_000
}

/** Mesure en cours, s'il y en a une. Une seule a la fois. */
export function mesureEnCours(mesures: readonly Mesure[]): Mesure | undefined {
  return mesures.find((mesure) => mesure.fin === null)
}

/** Mesures terminees d'un bloc, de la plus recente a la plus ancienne. */
export function mesuresDuBloc(mesures: readonly Mesure[], blocId: string): Mesure[] {
  return mesures
    .filter((mesure) => mesure.blocId === blocId && mesure.fin !== null)
    .sort((a, b) => (b.fin ?? '').localeCompare(a.fin ?? ''))
}
