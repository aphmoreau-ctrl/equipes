import type { Minutes } from '../../domaine/temps'

/**
 * Regles legales et conventionnelles.
 *
 * Module pur : aucune dependance a l'interface. Toutes les valeurs sont des
 * PARAMETRES modifiables (voir parametres.ts) ; aucune n'est ecrite en dur.
 */

/** Une regle est soit bloquante (jamais violee), soit un simple avertissement. */
export type Severite = 'bloquante' | 'avertissement'

/**
 * Identifiants de toutes les regles prevues au cahier des charges (§8).
 * Les regles non encore implementees figurent ici : leurs parametres et leur
 * severite sont deja reglables, ce qui evite une refonte a leur arrivee.
 */
export type IdentifiantRegle =
  | 'duree-maximale-quotidienne'
  | 'duree-maximale-hebdomadaire'
  | 'duree-moyenne-12-semaines'
  | 'repos-quotidien'
  | 'repos-hebdomadaire'
  | 'pause-obligatoire'
  | 'temps-partiel-coupures'
  | 'heures-complementaires'
  | 'delai-de-prevenance'
  | 'contingent-heures-supplementaires'
  | 'travail-de-nuit'
  | 'jeune-travailleur'

/** Une periode de travail d'une personne, un jour donne. */
export interface Vacation {
  readonly id: string
  readonly collaborateurId: string
  /** Jour de DEBUT de la vacation, au format « AAAA-MM-JJ ». */
  readonly jour: string
  /** Heure de debut, « HH:MM ». */
  readonly debut: string
  /** Heure de fin, « HH:MM ». Si elle precede le debut, la vacation passe minuit. */
  readonly fin: string
  /** Pause non travaillee, deduite de l'amplitude. */
  readonly pauseMinutes: Minutes
  /** Jour couvert par une derogation exceptionnelle (inventaire, etc.). */
  readonly derogation?: boolean
}

/** Un manquement constate par une regle. */
export interface Infraction {
  readonly regle: IdentifiantRegle
  readonly severite: Severite
  readonly collaborateurId: string
  readonly jour: string
  /** Phrase courte, affichable telle quelle a l'ecran. */
  readonly libelle: string
  /** Phrase complete expliquant le constat et le plafond applique. */
  readonly explication: string
}

/** Majorations conventionnelles, en pourcentage du taux horaire. */
export interface ParametresMajorations {
  readonly dimancheHabituelPourcent: number
  readonly dimancheExceptionnelPourcent: number
  readonly ferieTravaillePourcent: number
  readonly nuit21a22Pourcent: number
  readonly nuit22a5Pourcent: number
}

/**
 * Jeu complet des parametres. Chaque valeur a une valeur par defaut (§8)
 * que l'utilisateur pourra modifier depuis l'ecran Parametres.
 */
export interface ParametresRegles {
  readonly dureeMaximaleQuotidienneMinutes: Minutes
  readonly dureeMaximaleQuotidienneDerogationMinutes: Minutes
  readonly dureeMaximaleHebdomadaireMinutes: Minutes
  readonly dureeMoyenneMaximaleSur12SemainesMinutes: Minutes
  readonly reposQuotidienMinutes: Minutes
  readonly reposHebdomadaireMinutes: Minutes
  readonly seuilDeclenchantLaPauseMinutes: Minutes
  readonly dureeMinimaleDeLaPauseMinutes: Minutes
  readonly delaiDePrevenanceJoursOuvres: number
  readonly contingentHeuresSupplementairesAnnuel: number
  readonly majorations: ParametresMajorations
  /** Severite choisie pour chaque regle : bloquante ou avertissement. */
  readonly severites: Readonly<Record<IdentifiantRegle, Severite>>
}

/** Une regle verifiable. */
export interface Regle {
  readonly id: IdentifiantRegle
  readonly nom: string
  /** Texte de reference, affiche a l'utilisateur pour justifier le controle. */
  readonly reference: string
  readonly verifier: (
    vacations: readonly Vacation[],
    parametres: ParametresRegles,
  ) => Infraction[]
}
