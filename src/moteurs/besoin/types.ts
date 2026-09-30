import type { JourSemaine } from '../../domaine/calendrier'
import type { Minutes } from '../../domaine/temps'

/**
 * Calcul du besoin : pour chaque rayon, chaque jour et chaque tranche de
 * 30 minutes, combien de personnes sont necessaires et avec quelles
 * competences.
 *
 * Module pur : aucune dependance a l'interface.
 *
 * Un rayon est un ASSEMBLAGE DE BLOCS. Chaque bloc a ses propres formules,
 * parametres, plages horaires et competences. Deux rayons n'ont ni les memes
 * blocs ni les memes reglages : on peut ajouter un bloc sur mesure a un rayon
 * sans toucher aux autres.
 */

export type TypeBloc =
  | 'reception'
  | 'mise-en-place'
  | 'reassort'
  | 'tri'
  | 'facing'
  | 'controle-dates'
  | 'nettoyage'
  | 'balances'
  | 'transformation'
  | 'tache-fixe'
  | 'comptoir'
  | 'plan-cuisson'
  | 'format-livraison'

/** Coefficients qu'un bloc accepte de subir. */
export type NatureCoefficient = 'saison' | 'meteo' | 'evenement' | 'promotion' | 'qualite'

export type Meteo = 'normal' | 'chaud' | 'tres-chaud' | 'froid' | 'pluie'

export type NiveauQualite = 'A' | 'B' | 'C' | 'refus'

export interface PlageBloc {
  readonly debut: string
  readonly fin: string
}

/** Ce que tout bloc possede, quel que soit son type. */
export interface BlocCommun {
  readonly id: string
  readonly nom: string
  readonly actif: boolean
  /** Jours ou le bloc s'applique. */
  readonly jours: readonly JourSemaine[]
  /** Creneau pendant lequel le travail est reparti. */
  readonly plage: PlageBloc
  /** Competences necessaires pour ce travail. */
  readonly competences: readonly string[]
  /** Coefficients qui font varier ce bloc. */
  readonly coefficients: readonly NatureCoefficient[]
  /**
   * Personnes presentes au minimum pendant la plage de ce bloc, quel que soit
   * le volume calcule. Un comptoir ouvert exige quelqu'un derriere, meme sans
   * client. Absent = aucune exigence propre au bloc.
   */
  readonly presenceMinimum?: number
}

export interface BlocReception extends BlocCommun {
  readonly type: 'reception'
  readonly palettesParJour: Readonly<Record<JourSemaine, number>>
  readonly minutesParPalette: Minutes
}

export interface BlocMiseEnPlace extends BlocCommun {
  readonly type: 'mise-en-place'
  readonly colisParJour: Readonly<Record<JourSemaine, number>>
  /** Cadence de mise en rayon, en colis par heure. */
  readonly cadenceColisParHeure: number
}

export interface BlocReassort extends BlocCommun {
  readonly type: 'reassort'
  /** Minutes de travail pour 100 clients presents dans la tranche. */
  readonly minutesPour100Clients: Minutes
}

export interface BlocTri extends BlocCommun {
  readonly type: 'tri'
  readonly minutesParMetre: Minutes
}

export interface BlocFacing extends BlocCommun {
  readonly type: 'facing'
  readonly minutesParMetre: Minutes
}

export interface BlocControleDates extends BlocCommun {
  readonly type: 'controle-dates'
  readonly minutesParReference: Minutes
}

export interface BlocNettoyage extends BlocCommun {
  readonly type: 'nettoyage'
  readonly minutesParMeuble: Minutes
}

export interface BlocBalances extends BlocCommun {
  readonly type: 'balances'
  readonly minutesParJour: Minutes
}

export interface ProduitTransforme {
  readonly nom: string
  /** Quantite prevue, en kilos ou en unites selon le produit. */
  readonly quantite: number
  readonly minutesParUnite: Minutes
}

export interface BlocTransformation extends BlocCommun {
  readonly type: 'transformation'
  readonly produits: readonly ProduitTransforme[]
  readonly minutesMiseEnRoute: Minutes
  readonly minutesNettoyage: Minutes
  /** Nombre de postes de travail disponibles en meme temps. */
  readonly postes: number
}

export interface BlocTacheFixe extends BlocCommun {
  readonly type: 'tache-fixe'
  readonly minutes: Minutes
}

export interface BlocComptoir extends BlocCommun {
  readonly type: 'comptoir'
  /** Part des clients du magasin qui passent a ce comptoir, en pourcentage. */
  readonly partClientsPourcent: number
  readonly minutesParClient: Minutes
}

export interface BlocPlanCuisson extends BlocCommun {
  readonly type: 'plan-cuisson'
  readonly fourneesParJour: Readonly<Record<JourSemaine, number>>
  readonly minutesParFournee: Minutes
}

export interface BlocFormatLivraison extends BlocCommun {
  readonly type: 'format-livraison'
  /** Carcasse, quartiers, pret a decouper, poisson entier, filets... */
  readonly format: string
  /** Quantite receptionnee chaque jour, en kilos ou en pieces. */
  readonly quantiteParJour: Readonly<Record<JourSemaine, number>>
  readonly minutesParUnite: Minutes
}

export type Bloc =
  | BlocReception
  | BlocMiseEnPlace
  | BlocReassort
  | BlocTri
  | BlocFacing
  | BlocControleDates
  | BlocNettoyage
  | BlocBalances
  | BlocTransformation
  | BlocTacheFixe
  | BlocComptoir
  | BlocPlanCuisson
  | BlocFormatLivraison

/** Dimensions physiques du rayon, utilisees par plusieurs blocs. */
export interface TailleRayon {
  readonly metresLineaires: number
  readonly etals: number
  readonly meublesFroids: number
  readonly nombreReferences: number
}

/** Reglages complets d'un rayon pour le calcul du besoin. */
export interface ConfigurationRayon {
  readonly rayonId: string
  readonly taille: TailleRayon
  readonly blocs: readonly Bloc[]
  /** Personnes presentes au minimum pendant les heures d'ouverture. */
  readonly presenceMinimum: number
  /**
   * Tolerance, exprimee en fraction de personne (0,2 = un cinquieme).
   * Elle evite de reclamer une personne de plus pour quelques minutes :
   * besoin = arrondi superieur de (minutes / 30 - tolerance).
   */
  readonly tolerance: number
  readonly coefficientsQualite: Readonly<Record<NiveauQualite, number>>
  readonly coefficientsMeteo: Readonly<Record<Meteo, number>>
  /** Coefficient par mois, de 1 a 12. */
  readonly coefficientsSaison: Readonly<Record<number, number>>
  /** Coefficient applique quand le rayon est en promotion. */
  readonly coefficientPromotion: number
}

/** Une reception constatee, saisie d'un geste au moment de la livraison. */
export interface SaisieQualite {
  readonly id: string
  readonly date: string
  readonly rayonId: string
  readonly produit: string
  /** Quantite receptionnee, en palettes ou en colis. */
  readonly quantite: number
  readonly niveau: NiveauQualite
}

/** Tout ce qui fait varier le besoin un jour donne. */
export interface ContexteJour {
  readonly date: string
  /** Clients attendus, tranche par tranche (48 valeurs). */
  readonly clientsParTranche: readonly number[]
  /** Tranches pendant lesquelles le rayon est ouvert au public. */
  readonly tranchesOuvertes: ReadonlySet<number>
  readonly meteo: Meteo
  readonly coefficientEvenements: number
  readonly enPromotion: boolean
  readonly saisiesQualite: readonly SaisieQualite[]
}

export interface TrancheBesoin {
  readonly index: number
  readonly debutMinutes: Minutes
  /** Minutes de travail apportees par chaque bloc. */
  readonly minutesParBloc: Readonly<Record<string, Minutes>>
  readonly minutesTotal: Minutes
  readonly personnes: number
  readonly competences: readonly string[]
}

export interface BesoinJour {
  readonly rayonId: string
  readonly date: string
  readonly tranches: readonly TrancheBesoin[]
  readonly minutesTotal: Minutes
  readonly heuresTotal: number
  /** Total des personnes par tranche, converti en heures de presence. */
  readonly heuresPresence: number
  readonly coefficientsAppliques: Readonly<Record<NatureCoefficient, number>>
  /** Points d'attention releves pendant le calcul. */
  readonly alertes: readonly string[]
}
