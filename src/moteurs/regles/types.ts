import type { Collaborateur } from '../../domaine/collaborateur'
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
  /** Rayon ou la personne travaille pendant cette vacation. */
  readonly rayonId: string
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
  /** Jour concerne, ou premier jour de la periode concernee. */
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
  /** Plafond quotidien applicable aux moins de 18 ans. */
  readonly dureeMaximaleQuotidienneJeuneMinutes: Minutes
  readonly dureeMaximaleHebdomadaireMinutes: Minutes
  readonly dureeMoyenneMaximaleSur12SemainesMinutes: Minutes
  readonly reposQuotidienMinutes: Minutes
  /** Repos quotidien renforce pour les moins de 18 ans. */
  readonly reposQuotidienJeuneMinutes: Minutes
  readonly reposHebdomadaireMinutes: Minutes
  readonly seuilDeclenchantLaPauseMinutes: Minutes
  readonly dureeMinimaleDeLaPauseMinutes: Minutes
  readonly delaiDePrevenanceJoursOuvres: number
  readonly contingentHeuresSupplementairesAnnuel: number
  /** Duree hebdomadaire au-dela de laquelle les heures sont supplementaires. */
  readonly dureeLegaleHebdomadaireMinutes: Minutes
  /** Temps partiel : nombre maximal de coupures dans une journee. */
  readonly coupuresMaximumParJour: number
  /** Temps partiel : duree maximale d'une coupure. */
  readonly dureeMaximaleCoupureMinutes: Minutes
  /** Temps partiel : plafond d'heures complementaires, en pourcentage. */
  readonly plafondHeuresComplementairesPourcent: number
  /** Temps partiel : duree hebdomadaire minimale au contrat. */
  readonly dureeMinimaleTempsPartielMinutes: Minutes
  /** Heure a laquelle commence la majoration de nuit. */
  readonly nuitDebut: string
  /** Heure a laquelle se termine la nuit. */
  readonly nuitFin: string
  /** Heures de nuit par an au-dela desquelles on devient travailleur de nuit. */
  readonly seuilTravailleurDeNuitHeuresAnnuelles: number
  /** Heure a partir de laquelle un mineur ne peut plus travailler. */
  readonly jeuneNuitDebut: string
  /** Heure avant laquelle un mineur ne peut pas travailler. */
  readonly jeuneNuitFin: string
  readonly majorations: ParametresMajorations
  /** Severite choisie pour chaque regle : bloquante ou avertissement. */
  readonly severites: Readonly<Record<IdentifiantRegle, Severite>>
}

/**
 * Tout ce dont les regles ont besoin pour se prononcer.
 *
 * Certaines regles ne regardent que les vacations (duree quotidienne) ;
 * d'autres ont besoin du contrat (temps partiel, jeunes travailleurs), de
 * l'historique (moyenne sur douze semaines) ou de la date de publication
 * (delai de prevenance). Un contexte unique evite de multiplier les
 * signatures et permet d'ajouter une regle sans rien casser.
 */
export interface ContexteVerification {
  readonly vacations: readonly Vacation[]
  readonly parametres: ParametresRegles
  readonly collaborateurs: readonly Collaborateur[]
  /** Vacations des semaines precedentes, pour la moyenne sur 12 semaines. */
  readonly vacationsAnterieures: readonly Vacation[]
  /** Date a laquelle le planning a ete publie, ou null s'il ne l'est pas. */
  readonly datePublication: string | null
  /** Heures supplementaires deja consommees cette annee, par collaborateur. */
  readonly heuresSupplementairesAnnuelles: Readonly<Record<string, number>>
}

/** Une regle verifiable. */
export interface Regle {
  readonly id: IdentifiantRegle
  readonly nom: string
  /** Texte de reference, affiche a l'utilisateur pour justifier le controle. */
  readonly reference: string
  readonly verifier: (contexte: ContexteVerification) => Infraction[]
}
