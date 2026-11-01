import type { JourSemaine } from './calendrier'
import type { Minutes } from './temps'

/**
 * Organisation du planning (regles-planning-equipes.md, v2).
 *
 * Tout ce qui decrit COMMENT le service doit etre tenu, en dehors des
 * personnes elles-memes : effectifs minimum et cible, heures d'affluence,
 * taches nommees, plan de cuisson de la rotisserie, rotations et regles
 * internes. Module pur : aucune dependance a l'interface.
 *
 * Convention unique pour ce qui n'est pas encore connu : la valeur `null`
 * veut dire « A DEFINIR ». L'application le signale (voir pointsADefinir)
 * et ne l'invente jamais. Une valeur connue mais encore approximative porte
 * la mention `provisoire`.
 */

/** Une plage horaire, « HH:MM » a « HH:MM ». */
export interface Plage {
  readonly debut: string
  readonly fin: string
}

/* ------------------------------------------------------------------ */
/* Effectifs par rayon, par jour et par tranche horaire                */
/* ------------------------------------------------------------------ */

/**
 * Effectif voulu sur un creneau : un MINIMUM obligatoire (alerte s'il n'est
 * pas tenu) et une CIBLE souhaitee (atteignable avec des renforts).
 */
export interface CreneauEffectif {
  readonly debut: string
  readonly fin: string
  /** null = a definir. */
  readonly minimum: number | null
  /** null = a definir. */
  readonly cible: number | null
  /** Valeur donnee a titre provisoire, a affiner. */
  readonly provisoire?: boolean
}

/**
 * Un plancher de couverture : « au moins N personnes de telle heure a telle
 * heure, tels jours ». Il s'ajoute a la grille et prime sur elle quand il est
 * plus exigeant : c'est ce qui tient la presence permanente en vente meme les
 * jours dont la grille n'est pas encore remplie.
 */
export interface PlancherCouverture {
  readonly id: string
  readonly libelle: string
  readonly jours: readonly JourSemaine[]
  readonly debut: string
  readonly fin: string
  readonly minimum: number
}

/**
 * Effectifs d'un rayon. Quand un rayon en possede, ils REMPLACENT le calcul
 * de la charge par le volume de travail (decision D-123).
 */
export interface GrilleEffectifs {
  /** Competence qu'il faut avoir pour compter dans l'effectif du rayon. */
  readonly competence: string
  /**
   * Creneaux de chaque jour. Liste vide = personne n'est attendu (rayon
   * ferme). null = journee entiere A DEFINIR.
   */
  readonly jours: Readonly<Record<JourSemaine, readonly CreneauEffectif[] | null>>
  readonly planchers: readonly PlancherCouverture[]
}

/* ------------------------------------------------------------------ */
/* Taches nommees : emballages, reunions, reserves, remballe           */
/* ------------------------------------------------------------------ */

/** Fonction tenue dans l'equipe, en plus du metier. */
export type Fonction = 'manager' | 'responsable'

export const LIBELLES_FONCTION: Readonly<Record<Fonction, string>> = {
  manager: 'Manager',
  responsable: 'Responsable (réunion trad)',
}

export type NatureTache = 'tache' | 'reunion' | 'reserve' | 'remballe'

export const LIBELLES_NATURE_TACHE: Readonly<Record<NatureTache, string>> = {
  tache: 'Tâche',
  reunion: 'Réunion',
  reserve: 'Réserve de temps',
  remballe: 'Remballe',
}

/**
 * Moment de la journee ou la tache se fait :
 * - « heure » : a heure fixe (reunion de 8 h) ;
 * - « libre » : le planning choisit le moment, dans les jours prevus ;
 * - « a-definir » : pas encore decide, signale.
 */
export type MomentTache =
  | { readonly type: 'heure'; readonly heure: string }
  | { readonly type: 'libre' }
  | { readonly type: 'a-definir' }

export interface TachePlanifiee {
  readonly id: string
  readonly nom: string
  readonly nature: NatureTache
  readonly actif: boolean
  /** Rayon ou la tache se fait, ou null si elle n'en depend pas (reunion). */
  readonly rayonId: string | null
  /** Competence exigee, ou null si la tache est confiee nommement. */
  readonly competence: string | null
  /** Pour une reunion : la fonction de ceux qui doivent y etre. */
  readonly fonction: Fonction | null
  /**
   * Rayons qui doivent etre representes a une reunion : il faut, pour chacun,
   * au moins une personne de cette fonction. Vide = sans exigence.
   */
  readonly rayonsRepresentes: readonly string[]
  /**
   * Personnes a qui la tache est confiee nommement (identifiants).
   * Liste vide = toute personne qui a la competence. null = A DEFINIR.
   */
  readonly personnesDesignees: readonly string[] | null
  /** Jours ou la tache peut se faire. null = A DEFINIR. */
  readonly jours: readonly JourSemaine[] | null
  readonly moment: MomentTache
  /** Duree d'une occurrence. null = A DEFINIR. */
  readonly dureeMinutes: Minutes | null
  /**
   * Nombre d'occurrences par semaine, reparties sur les jours prevus.
   * null = une par jour prevu.
   */
  readonly occurrencesParSemaine: number | null
}

/* ------------------------------------------------------------------ */
/* Rotisserie                                                          */
/* ------------------------------------------------------------------ */

export interface JourRotisserie {
  /** Heures de vente du poulet roti, ou null si pas de vente ce jour-la. */
  readonly vente: Plage | null
  /** Heure de SORTIE DU FOUR de chaque cuisson, dans l'ordre. */
  readonly cuissons: readonly string[]
}

export interface PlanRotisserie {
  readonly actif: boolean
  readonly rayonId: string
  readonly competence: string
  /** Regle legale : pas plus de 5 h au chaud entre cuisson et vente. */
  readonly maintienAuChaudMaximumMinutes: Minutes
  /** Duree d'une cuisson, de l'enfournement a la sortie. null = A DEFINIR. */
  readonly dureeCuissonMinutes: Minutes | null
  readonly jours: Readonly<Record<JourSemaine, JourRotisserie>>
}

/* ------------------------------------------------------------------ */
/* Rotations                                                           */
/* ------------------------------------------------------------------ */

/**
 * Plusieurs personnes se partagent a tour de role un meme poste certains
 * jours (le samedi en preparation traiteur). Elles se remplacent aussi
 * pendant les vacances.
 */
export interface Rotation {
  readonly id: string
  readonly nom: string
  readonly rayonId: string
  readonly jours: readonly JourSemaine[]
  /** Personnes qui tournent (identifiants). Deux au moins pour tourner. */
  readonly personnes: readonly string[]
  readonly personnesParJour: number
}

/* ------------------------------------------------------------------ */
/* Regles internes (alertes, jamais bloquantes)                        */
/* ------------------------------------------------------------------ */

export interface ReglesInternes {
  /** Pause : 3 minutes par heure travaillee. */
  readonly pauseMinutesParHeure: number
  /**
   * Les pauses sont payees et comprises dans le contrat : 36 h 75 de
   * presence = 35 h de travail effectif + 1 h 45 de pause (D-125).
   */
  readonly pausesPayeesIncluses: boolean
  /** Plages ou la pause peut etre prise. */
  readonly fenetresPause: readonly Plage[]
  /** Jamais de pause pendant les heures d'affluence. */
  readonly pauseInterditeEnAffluence: boolean
  /** Presence minimale un jour travaille. */
  readonly presenceMinimaleParJourMinutes: Minutes
  /** Jours de travail consecutifs, d'une semaine a l'autre. */
  readonly joursConsecutifsMaximum: number
  /** Un poste « du matin » se termine au plus tard a cette heure. */
  readonly finDuMatin: string
  /** Duree maximale d'un depannage dans un rayon. null = A DEFINIR. */
  readonly dureeMaximaleDepannageMinutes: Minutes | null
  /**
   * Le planning propose ne depasse pas le contrat de plus de ce temps par
   * semaine. Absent (reglage anterieur) = 1 h.
   */
  readonly depassementContratMaximumMinutes?: Minutes
  /**
   * Jours ouvrables par semaine (decompte legal des conges payes : 6, du
   * lundi au samedi). Un jour de conge, d'absence ou d'ecole vaut contrat /
   * ce nombre. Absent = 6.
   */
  readonly joursHabituelsParSemaine?: number
}

/** Une verification a faire hors de l'application (RH, convention). */
export interface PointAVerifier {
  readonly id: string
  readonly libelle: string
  readonly verifie: boolean
}

export interface OrganisationPlanning {
  readonly plagesAffluence: Readonly<Record<JourSemaine, readonly Plage[] | null>>
  readonly taches: readonly TachePlanifiee[]
  readonly rotisserie: PlanRotisserie | null
  readonly rotations: readonly Rotation[]
  readonly reglesInternes: ReglesInternes
  readonly pointsAVerifier: readonly PointAVerifier[]
}

export const REGLES_INTERNES_PAR_DEFAUT: ReglesInternes = {
  pauseMinutesParHeure: 3,
  pausesPayeesIncluses: true,
  fenetresPause: [
    { debut: '08:30', fin: '11:00' },
    { debut: '15:00', fin: '17:30' },
  ],
  pauseInterditeEnAffluence: true,
  presenceMinimaleParJourMinutes: 3 * 60,
  joursConsecutifsMaximum: 6,
  finDuMatin: '14:00',
  dureeMaximaleDepannageMinutes: 2 * 60,
  depassementContratMaximumMinutes: 60,
  joursHabituelsParSemaine: 6,
}

/** Organisation vide : aucune tache, aucune rotation. Celle de la demonstration. */
export const ORGANISATION_VIDE: OrganisationPlanning = {
  plagesAffluence: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] },
  taches: [],
  rotisserie: null,
  rotations: [],
  reglesInternes: REGLES_INTERNES_PAR_DEFAUT,
  pointsAVerifier: [],
}
