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
  /**
   * Jours encore A DEFINIR remplis provisoirement avec un autre jour : sa
   * CIBLE devient le minimum et la cible. Absent = vendredi et samedi pris
   * sur le jeudi (les jours les plus charges, demande d'Arnaud). Objet vide
   * = aucun remplissage provisoire.
   */
  readonly joursVidesRemplisPar?: Partial<Readonly<Record<JourSemaine, JourSemaine>>>
  /**
   * Remballe de chaque jour : debut, duree et effectif propres. null = A
   * DEFINIR. Absent (donnees anterieures) = a definir aussi.
   */
  readonly remballe?: Partial<Readonly<Record<JourSemaine, RemballeDuJour | null>>>
  /**
   * A l'ouverture et a la fermeture du rayon, au moins un TITULAIRE (pas un
   * renfort seul). Absent = oui.
   */
  readonly titulaireOuvertureFermeture?: boolean
}

/** La remballe d'un rayon un jour donne. */
export interface RemballeDuJour {
  readonly debut: string
  readonly dureeMinutes: number
  readonly minimum: number
  readonly cible: number
}

/** Les trois phases d'une journee de rayon. */
export type PhaseDuJour = 'preparation' | 'vente' | 'remballe'

export const LIBELLES_PHASE: Readonly<Record<PhaseDuJour, string>> = {
  preparation: 'Préparation',
  vente: 'Vente',
  remballe: 'Remballe',
}

/** Debut de la vente : 8 h 30 tous les jours. */
export const DEBUT_DE_LA_VENTE = '08:30'

/** Phase d'un creneau : avant 8 h 30 la preparation, ensuite la vente. */
export function phaseDuCreneau(creneau: { readonly fin: string }): PhaseDuJour {
  const [h, m] = creneau.fin.split(':').map(Number) as [number, number]
  return h * 60 + m <= 8 * 60 + 30 ? 'preparation' : 'vente'
}

/** Vendredi et samedi, tant qu'ils sont vides, prennent la cible du jeudi. */
export const REMPLISSAGE_PROVISOIRE_PAR_DEFAUT: Partial<Readonly<Record<JourSemaine, JourSemaine>>> = {
  5: 4,
  6: 4,
}

/** Jour dont un jour vide emprunte provisoirement les creneaux, ou null. */
export function jourDeRemplacement(grille: GrilleEffectifs, jour: JourSemaine): JourSemaine | null {
  if (grille.jours[jour] !== null) return null
  const source = (grille.joursVidesRemplisPar ?? REMPLISSAGE_PROVISOIRE_PAR_DEFAUT)[jour]
  if (source === undefined || grille.jours[source] == null) return null
  return source
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
  /**
   * Plages propres a certains jours, a la place des plages ordinaires.
   * Absent = le samedi, 8 h 30-10 h et 13 h-15 h (l'affluence du samedi
   * couvre 10 h-13 h et 15 h-19 h).
   */
  readonly fenetresPauseParJour?: Partial<Readonly<Record<JourSemaine, readonly Plage[]>>>
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
  /**
   * Priorite de chaque jour quand il faut choisir ou combler un trou :
   * 1 = normal. Absent = vendredi et samedi a 1,5 (les plus charges).
   */
  readonly prioriteParJour?: Partial<Readonly<Record<JourSemaine, number>>>
  /**
   * Jours de presence maximale : tout le monde y travaille, sauf conge,
   * absence, ecole ou regle legale ; les heures restantes y vont d'abord, et
   * leur grille est un plancher, pas un plafond. Absent = vendredi et samedi.
   */
  readonly joursPrioritaires?: readonly JourSemaine[]
  /** Jours ou placer les repos de preference. Absent = lundi, mardi, mercredi. */
  readonly joursDeReposPreferes?: readonly JourSemaine[]
}

export const JOURS_PRIORITAIRES_PAR_DEFAUT: readonly JourSemaine[] = [5, 6]

export const FENETRES_PAUSE_PAR_JOUR_PAR_DEFAUT: Partial<Readonly<Record<JourSemaine, readonly Plage[]>>> = {
  6: [
    { debut: '08:30', fin: '10:00' },
    { debut: '13:00', fin: '15:00' },
  ],
}

/** Plages de pause d'un jour donne. */
export function fenetresDuJour(regles: ReglesInternes, jour: JourSemaine): readonly Plage[] {
  return (regles.fenetresPauseParJour ?? FENETRES_PAUSE_PAR_JOUR_PAR_DEFAUT)[jour] ?? regles.fenetresPause
}
export const JOURS_DE_REPOS_PREFERES_PAR_DEFAUT: readonly JourSemaine[] = [1, 2, 3]

export const PRIORITE_PAR_JOUR_PAR_DEFAUT: Partial<Readonly<Record<JourSemaine, number>>> = {
  5: 1.5,
  6: 1.5,
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
  prioriteParJour: PRIORITE_PAR_JOUR_PAR_DEFAUT,
  joursPrioritaires: [5, 6],
  joursDeReposPreferes: [1, 2, 3],
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
