import type { JourSemaine } from '../domaine/calendrier'
import type { Competence } from '../domaine/competence'
import type { HorairesJour, HorairesSemaine, Magasin, Rayon } from '../domaine/magasin'
import {
  REGLES_INTERNES_PAR_DEFAUT,
  type CreneauEffectif,
  type GrilleEffectifs,
  type OrganisationPlanning,
  type Plage,
  type PlancherCouverture,
  type TachePlanifiee,
} from '../domaine/organisation'
import type { ConfigurationRayon } from '../moteurs/besoin'

/**
 * MODELE DE DEPART DU MAGASIN (regles-planning-equipes.md, v2).
 *
 * Organisation du service, et RIEN SUR LES PERSONNES : ni prenom, ni contrat.
 * Le depot est public ; la liste de l'equipe s'importe dans l'application a
 * partir d'un fichier transmis a part (voir import-equipe.ts).
 *
 * Toutes ces valeurs sont des POINTS DE DEPART, modifiables dans Parametres.
 * `null` = A DEFINIR : l'application le signale et n'invente rien.
 */

const LUNDI_AU_JEUDI: readonly JourSemaine[] = [1, 2, 3, 4]
const LUNDI_AU_SAMEDI: readonly JourSemaine[] = [1, 2, 3, 4, 5, 6]
const TOUS_LES_JOURS: readonly JourSemaine[] = [1, 2, 3, 4, 5, 6, 7]

/* ------------------------------------------------------------------ */
/* Rayons et horaires de presence (§1)                                 */
/* ------------------------------------------------------------------ */

export const RAYON = {
  fruitsLegumes: 'fruits-legumes',
  maree: 'maree',
  charcuterieFromage: 'charcuterie-fromage',
  boucherieTrad: 'boucherie-trad',
  boucherieLs: 'boucherie-ls',
  fraicheDecoupe: 'fraiche-decoupe',
  cuisineMobile: 'cuisine-mobile',
  preparationTraiteur: 'preparation-traiteur',
} as const

/** Competence attendue pour tenir chaque rayon. */
export const COMPETENCE = {
  fruitsLegumes: 'Fruits & Légumes',
  maree: 'Marée',
  charcuterieFromage: 'Charcuterie / Fromage',
  boucherieTrad: 'Boucherie Trad',
  boucherieLs: 'Boucherie LS',
  fraicheDecoupe: 'Fraîche découpe',
  cuisineMobile: 'Cuisine mobile',
  preparationTraiteur: 'Préparation traiteur',
  rotisserie: 'Rôtisserie',
} as const

const FERME: HorairesJour = { ouvert: false, ouverture: '00:00', fermeture: '00:00' }

function h(ouverture: string, fermeture: string): HorairesJour {
  return { ouvert: true, ouverture, fermeture }
}

function semaine(
  jours: [HorairesJour, HorairesJour, HorairesJour, HorairesJour, HorairesJour, HorairesJour, HorairesJour],
): HorairesSemaine {
  return { 1: jours[0], 2: jours[1], 3: jours[2], 4: jours[3], 5: jours[4], 6: jours[5], 7: jours[6] }
}

const DIMANCHE = h('07:00', '12:45')

export const HORAIRES_RAYONS: Readonly<Record<string, HorairesSemaine>> = {
  [RAYON.fruitsLegumes]: semaine([
    h('06:00', '20:00'), h('05:00', '20:00'), h('05:00', '20:00'), h('05:00', '20:00'),
    h('05:00', '20:00'), h('05:00', '20:00'), DIMANCHE,
  ]),
  [RAYON.maree]: semaine([
    h('07:00', '20:00'), h('06:30', '20:00'), h('06:45', '20:00'), h('06:30', '20:00'),
    h('06:30', '20:00'), h('06:30', '20:00'), DIMANCHE,
  ]),
  [RAYON.charcuterieFromage]: semaine([
    h('07:00', '20:00'), h('06:30', '20:00'), h('07:00', '20:00'), h('06:30', '20:00'),
    h('07:00', '20:00'), h('06:30', '20:00'), DIMANCHE,
  ]),
  [RAYON.boucherieTrad]: semaine([
    h('06:00', '20:00'), h('06:00', '20:00'), h('06:00', '20:00'), h('06:00', '20:00'),
    h('06:00', '20:00'), h('06:00', '20:00'), DIMANCHE,
  ]),
  [RAYON.fraicheDecoupe]: semaine([
    h('06:30', '13:00'), h('06:30', '12:00'), h('06:30', '12:00'), h('06:30', '13:00'),
    h('06:30', '13:00'), h('06:30', '13:00'), FERME,
  ]),
  [RAYON.cuisineMobile]: semaine([
    FERME, FERME, FERME, FERME, h('10:00', '19:00'), h('10:00', '18:00'), FERME,
  ]),
  // Fin a 12 h du lundi au vendredi, 13 h 30 le samedi (Arnaud, 1er novembre 2026).
  [RAYON.preparationTraiteur]: semaine([
    h('06:00', '12:00'), h('06:00', '12:00'), h('06:00', '12:00'), h('06:00', '12:00'),
    h('06:00', '12:00'), h('06:00', '13:30'), FERME,
  ]),
}
// Boucherie Trad et Boucherie LS partagent les memes horaires.
const HORAIRES_BOUCHERIE = HORAIRES_RAYONS[RAYON.boucherieTrad] as HorairesSemaine

function rayon(
  id: string,
  nom: string,
  ordre: number,
  horaires: HorairesSemaine,
  options: Partial<Pick<Rayon, 'vente' | 'horairesAConfirmer'>> = {},
): Rayon {
  return { id, serviceId: 'frais', nom, ordre, actif: true, horairesPropres: horaires, ...options }
}

export const RAYONS_LA_VAUGINE: readonly Rayon[] = [
  rayon(RAYON.fruitsLegumes, 'Fruits & Légumes', 1, HORAIRES_RAYONS[RAYON.fruitsLegumes] as HorairesSemaine),
  rayon(RAYON.maree, 'Marée', 2, HORAIRES_RAYONS[RAYON.maree] as HorairesSemaine),
  rayon(RAYON.charcuterieFromage, 'Charcuterie / Fromage', 3, HORAIRES_RAYONS[RAYON.charcuterieFromage] as HorairesSemaine),
  rayon(RAYON.boucherieTrad, 'Boucherie Trad', 4, HORAIRES_BOUCHERIE),
  rayon(RAYON.boucherieLs, 'Boucherie LS', 5, HORAIRES_BOUCHERIE),
  rayon(RAYON.fraicheDecoupe, 'Fraîche découpe', 6, HORAIRES_RAYONS[RAYON.fraicheDecoupe] as HorairesSemaine),
  rayon(RAYON.cuisineMobile, 'Cuisine mobile', 7, HORAIRES_RAYONS[RAYON.cuisineMobile] as HorairesSemaine),
  rayon(
    RAYON.preparationTraiteur,
    'Préparation traiteur & charcuterie',
    8,
    HORAIRES_RAYONS[RAYON.preparationTraiteur] as HorairesSemaine,
    { vente: false },
  ),
]

/* ------------------------------------------------------------------ */
/* Magasin                                                             */
/* ------------------------------------------------------------------ */

/**
 * Profil de frequentation neutre (pointes 11-13 h et 17-19 h), simplement
 * pour que les ecrans qui l'affichent aient quelque chose a montrer : le
 * besoin de ces rayons vient de la grille d'effectifs, pas des clients.
 */
function profilNeutre(): number[] {
  const profil = new Array<number>(48).fill(0)
  for (let index = 17; index < 40; index += 1) profil[index] = 3
  for (const index of [22, 23, 24, 25, 34, 35, 36, 37]) profil[index] = 6
  const total = profil.reduce((somme, part) => somme + part, 0)
  return profil.map((part) => (part * 100) / total)
}

export const MAGASIN_LA_VAUGINE: Magasin = {
  nom: 'Intermarché La Vaugine',
  services: [{ id: 'frais', nom: 'Frais', ordre: 1, actif: true }],
  rayons: RAYONS_LA_VAUGINE,
  // Heures de VENTE du magasin ; la presence en rayon est propre a chaque rayon.
  horaires: semaine([
    h('08:30', '20:00'), h('08:30', '20:00'), h('08:30', '20:00'), h('08:30', '20:00'),
    h('08:30', '20:00'), h('08:30', '20:00'), h('08:30', '12:30'),
  ]),
  frequentation: {
    clientsParJour: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    profilHoraire: profilNeutre(),
  },
  horairesTypes: [
    { id: 'ouverture', nom: 'Ouverture', debut: '05:00', fin: '12:00', pauseMinutes: 20, pauseDebut: '09:00' },
    { id: 'matin', nom: 'Matin', debut: '06:00', fin: '13:00', pauseMinutes: 20, pauseDebut: '09:30' },
    { id: 'journee', nom: 'Journée', debut: '08:30', fin: '15:30', pauseMinutes: 20, pauseDebut: '10:30' },
    { id: 'apres-midi', nom: 'Après-midi', debut: '13:00', fin: '20:00', pauseMinutes: 20, pauseDebut: '15:30' },
  ],
  evenements: [],
  budgetHeuresParRayon: {},
}

/* ------------------------------------------------------------------ */
/* Competences                                                         */
/* ------------------------------------------------------------------ */

function competence(nom: string, rayons: readonly string[]): Competence {
  return { id: nom, nom, rayons, actif: true }
}

export const COMPETENCES_LA_VAUGINE: readonly Competence[] = [
  competence(COMPETENCE.fruitsLegumes, [RAYON.fruitsLegumes]),
  competence(COMPETENCE.maree, [RAYON.maree]),
  competence(COMPETENCE.charcuterieFromage, [RAYON.charcuterieFromage]),
  competence(COMPETENCE.boucherieTrad, [RAYON.boucherieTrad]),
  competence(COMPETENCE.boucherieLs, [RAYON.boucherieLs]),
  competence(COMPETENCE.fraicheDecoupe, [RAYON.fraicheDecoupe]),
  competence(COMPETENCE.cuisineMobile, [RAYON.cuisineMobile]),
  competence(COMPETENCE.preparationTraiteur, [RAYON.preparationTraiteur]),
  competence(COMPETENCE.rotisserie, [RAYON.boucherieTrad, RAYON.boucherieLs]),
]

/* ------------------------------------------------------------------ */
/* Effectifs (§2)                                                      */
/* ------------------------------------------------------------------ */

type Paire = readonly [number, number]

/**
 * Grille lundi-jeudi : six tranches, de l'ouverture du rayon a 20 h.
 * Valeurs PROVISOIRES, a affiner (§2).
 */
function grilleSemaine(ouverture: string, valeurs: readonly [Paire, Paire, Paire, Paire, Paire, Paire]): CreneauEffectif[] {
  const bornes: readonly Plage[] = [
    { debut: ouverture, fin: '08:30' },
    { debut: '08:30', fin: '11:00' },
    { debut: '11:00', fin: '13:00' },
    { debut: '13:00', fin: '17:00' },
    { debut: '17:00', fin: '19:00' },
    { debut: '19:00', fin: '20:00' },
  ]
  return bornes.map((plage, index) => {
    const [minimum, cible] = valeurs[index] as Paire
    return { ...plage, minimum, cible, provisoire: true }
  })
}

function ouvertureDu(rayonId: string, jour: JourSemaine): string {
  return (HORAIRES_RAYONS[rayonId] ?? HORAIRES_BOUCHERIE)[jour].ouverture
}

/** Lundi a jeudi remplis, vendredi a dimanche A DEFINIR. */
function grilleLundiJeudi(
  horairesDe: string,
  valeurs: readonly [Paire, Paire, Paire, Paire, Paire, Paire],
): GrilleEffectifs['jours'] {
  const jour = (j: JourSemaine) => grilleSemaine(ouvertureDu(horairesDe, j), valeurs)
  return { 1: jour(1), 2: jour(2), 3: jour(3), 4: jour(4), 5: null, 6: null, 7: null }
}

/** Presence permanente en vente : 8 h 30-20 h, et 8 h 30-12 h 30 le dimanche. */
function presencePermanente(): PlancherCouverture[] {
  return [
    {
      id: 'presence-permanente',
      libelle: 'Présence permanente en vente',
      jours: LUNDI_AU_SAMEDI,
      debut: '08:30',
      fin: '20:00',
      minimum: 1,
    },
    {
      id: 'presence-permanente-dimanche',
      libelle: 'Présence permanente en vente (dimanche)',
      jours: [7],
      debut: '08:30',
      fin: '12:30',
      minimum: 1,
    },
  ]
}

/** Toute la plage d'ouverture du rayon, chaque jour ouvert, avec le meme effectif. */
function grilleOuverture(rayonId: string, minimum: number, cible: number): GrilleEffectifs['jours'] {
  const horaires = HORAIRES_RAYONS[rayonId] as HorairesSemaine
  const jour = (j: JourSemaine): CreneauEffectif[] =>
    horaires[j].ouvert
      ? [{ debut: horaires[j].ouverture, fin: horaires[j].fermeture, minimum, cible }]
      : []
  return { 1: jour(1), 2: jour(2), 3: jour(3), 4: jour(4), 5: jour(5), 6: jour(6), 7: jour(7) }
}

/** Creneaux d'une journee : bornes [debut, fin] et paires [minimum, cible]. */
function journee(
  ouverture: string,
  bornes: readonly (readonly [string, string])[],
  valeurs: readonly Paire[],
): CreneauEffectif[] {
  return bornes.map(([debut, fin], index) => {
    const [minimum, cible] = valeurs[index] as Paire
    return { debut: debut === 'ouverture' ? ouverture : debut, fin, minimum, cible, provisoire: true }
  })
}

const TRANCHES_VENDREDI = [
  ['ouverture', '08:30'], ['08:30', '11:00'], ['11:00', '13:00'],
  ['13:00', '17:00'], ['17:00', '19:00'], ['19:00', '20:00'],
] as const
const TRANCHES_SAMEDI = [
  ['ouverture', '08:30'], ['08:30', '10:00'], ['10:00', '13:00'],
  ['13:00', '15:00'], ['15:00', '19:00'], ['19:00', '20:00'],
] as const
const TRANCHES_DIMANCHE = [['ouverture', '08:30'], ['08:30', '12:45']] as const

type SixPaires = readonly [Paire, Paire, Paire, Paire, Paire, Paire]
type JoursDuWeekEnd = Readonly<Record<5 | 6 | 7, readonly CreneauEffectif[]>>

function weekEnd(
  horairesDe: string,
  vendredi: SixPaires,
  samedi: SixPaires,
  dimanche: readonly [Paire, Paire],
): JoursDuWeekEnd {
  return {
    5: journee(ouvertureDu(horairesDe, 5), TRANCHES_VENDREDI, vendredi),
    6: journee(ouvertureDu(horairesDe, 6), TRANCHES_SAMEDI, samedi),
    7: journee(ouvertureDu(horairesDe, 7), TRANCHES_DIMANCHE, dimanche),
  }
}

/**
 * Effectifs du week-end, donnes par Arnaud le 1er novembre 2026 (valeurs de
 * depart provisoires). Le bouton « Appliquer les grilles du week-end
 * proposees » ne les recopie que sur les jours encore a definir.
 */
export const GRILLES_WEEK_END: Readonly<Record<string, JoursDuWeekEnd>> = {
  [RAYON.fruitsLegumes]: weekEnd(
    RAYON.fruitsLegumes,
    [[3, 3], [1, 2], [2, 3], [1, 2], [2, 3], [1, 1]],
    [[3, 3], [1, 2], [2, 3], [1, 2], [2, 3], [1, 1]],
    [[1, 2], [1, 2]],
  ),
  [RAYON.maree]: weekEnd(
    RAYON.maree,
    [[1, 2], [1, 2], [2, 2], [1, 1], [2, 2], [1, 1]],
    [[1, 2], [1, 2], [2, 3], [1, 2], [2, 2], [1, 1]],
    [[1, 1], [1, 1]],
  ),
  [RAYON.charcuterieFromage]: weekEnd(
    RAYON.charcuterieFromage,
    [[2, 2], [2, 2], [2, 3], [2, 2], [2, 3], [2, 2]],
    [[2, 2], [2, 2], [2, 3], [2, 2], [2, 3], [2, 2]],
    [[1, 1], [1, 2]],
  ),
  [RAYON.boucherieTrad]: weekEnd(
    RAYON.boucherieTrad,
    [[2, 2], [1, 2], [2, 3], [1, 2], [2, 3], [1, 1]],
    [[2, 2], [1, 2], [2, 3], [1, 2], [2, 3], [1, 1]],
    [[1, 1], [1, 2]],
  ),
  [RAYON.boucherieLs]: weekEnd(
    RAYON.boucherieTrad,
    [[2, 2], [1, 2], [1, 1], [1, 1], [1, 1], [0, 1]],
    [[2, 2], [1, 2], [1, 1], [1, 1], [1, 1], [0, 1]],
    [[1, 1], [0, 1]],
  ),
}

/** Affluence du samedi, provisoire : 10 h - 13 h et 15 h - 19 h. */
export const AFFLUENCE_SAMEDI: readonly Plage[] = [
  { debut: '10:00', fin: '13:00' },
  { debut: '15:00', fin: '19:00' },
]

/** Grille lundi-jeudi completee du week-end. */
function avecWeekEnd(rayonId: string, jours: GrilleEffectifs['jours']): GrilleEffectifs['jours'] {
  const weekend = GRILLES_WEEK_END[rayonId]
  return weekend === undefined ? jours : { ...jours, 5: weekend[5], 6: weekend[6], 7: weekend[7] }
}

const GRILLES: Readonly<Record<string, GrilleEffectifs>> = {
  [RAYON.fruitsLegumes]: {
    competence: COMPETENCE.fruitsLegumes,
    jours: avecWeekEnd(RAYON.fruitsLegumes, grilleLundiJeudi(RAYON.fruitsLegumes, [
      [2, 3], [1, 2], [1, 2], [1, 1], [1, 2], [1, 1],
    ])),
    planchers: presencePermanente(),
  },
  [RAYON.maree]: {
    competence: COMPETENCE.maree,
    jours: avecWeekEnd(RAYON.maree, grilleLundiJeudi(RAYON.maree, [
      [1, 1], [1, 1], [1, 2], [1, 1], [1, 2], [1, 1],
    ])),
    planchers: presencePermanente(),
  },
  [RAYON.charcuterieFromage]: {
    competence: COMPETENCE.charcuterieFromage,
    jours: avecWeekEnd(RAYON.charcuterieFromage, grilleLundiJeudi(RAYON.charcuterieFromage, [
      [1, 2], [1, 1], [1, 2], [1, 1], [1, 2], [1, 1],
    ])),
    planchers: [
      ...presencePermanente(),
      {
        id: 'deux-personnes-vendredi-samedi',
        libelle: 'Deux personnes en rayon le vendredi et le samedi',
        jours: [5, 6],
        debut: '08:30',
        fin: '20:00',
        minimum: 2,
      },
    ],
  },
  [RAYON.boucherieTrad]: {
    competence: COMPETENCE.boucherieTrad,
    jours: avecWeekEnd(RAYON.boucherieTrad, grilleLundiJeudi(RAYON.boucherieTrad, [
      [1, 2], [1, 1], [1, 2], [1, 1], [1, 2], [1, 1],
    ])),
    planchers: presencePermanente(),
  },
  [RAYON.boucherieLs]: {
    competence: COMPETENCE.boucherieLs,
    jours: avecWeekEnd(RAYON.boucherieLs, grilleLundiJeudi(RAYON.boucherieTrad, [
      [2, 2], [1, 2], [1, 1], [1, 1], [1, 1], [0, 1],
    ])),
    planchers: [],
  },
  [RAYON.fraicheDecoupe]: {
    competence: COMPETENCE.fraicheDecoupe,
    jours: grilleOuverture(RAYON.fraicheDecoupe, 1, 1),
    planchers: [],
  },
  [RAYON.cuisineMobile]: {
    competence: COMPETENCE.cuisineMobile,
    jours: grilleOuverture(RAYON.cuisineMobile, 1, 1),
    planchers: [],
  },
  [RAYON.preparationTraiteur]: {
    competence: COMPETENCE.preparationTraiteur,
    // Effectif de semaine A DEFINIR ; le samedi, une personne (rotation).
    jours: {
      1: [{ debut: '06:00', fin: '12:00', minimum: null, cible: null }],
      2: [{ debut: '06:00', fin: '12:00', minimum: null, cible: null }],
      3: [{ debut: '06:00', fin: '12:00', minimum: null, cible: null }],
      4: [{ debut: '06:00', fin: '12:00', minimum: null, cible: null }],
      5: [{ debut: '06:00', fin: '12:00', minimum: null, cible: null }],
      6: [{ debut: '06:00', fin: '13:30', minimum: 1, cible: 1 }],
      7: [],
    },
    planchers: [],
  },
}

/**
 * Remballe a definir chaque jour d'ouverture d'un rayon de vente. Debut et
 * duree propres a chaque rayon et a chaque jour : Arnaud les renseignera.
 */
function remballeADefinir(rayonId: string): Partial<Record<JourSemaine, null>> {
  const horaires = HORAIRES_RAYONS[rayonId] ?? HORAIRES_BOUCHERIE
  const remballe: Partial<Record<JourSemaine, null>> = {}
  for (const jour of [1, 2, 3, 4, 5, 6, 7] as const) {
    if (horaires[jour].ouvert) remballe[jour] = null
  }
  return remballe
}

/** Configuration d'un rayon pilote par sa grille : aucun bloc de charge. */
function configuration(rayonId: string): ConfigurationRayon {
  return {
    rayonId,
    taille: { metresLineaires: 0, etals: 0, meublesFroids: 0, nombreReferences: 0 },
    blocs: [],
    presenceMinimum: 0,
    tolerance: 0.2,
    coefficientsQualite: { A: 1, B: 1, C: 1, refus: 1 },
    coefficientsMeteo: { normal: 1, chaud: 1, 'tres-chaud': 1, froid: 1, pluie: 1 },
    coefficientsSaison: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 },
    coefficientPromotion: 1,
    grilleEffectifs:
      rayonId === RAYON.preparationTraiteur
        ? (GRILLES[rayonId] as GrilleEffectifs)
        : { ...(GRILLES[rayonId] as GrilleEffectifs), remballe: remballeADefinir(rayonId) },
  }
}

export const CONFIGURATIONS_LA_VAUGINE: readonly ConfigurationRayon[] = RAYONS_LA_VAUGINE.map(
  (r) => configuration(r.id),
)

/* ------------------------------------------------------------------ */
/* Taches (§3) et organisation                                         */
/* ------------------------------------------------------------------ */

function tache(champs: Partial<TachePlanifiee> & Pick<TachePlanifiee, 'id' | 'nom'>): TachePlanifiee {
  return {
    nature: 'tache',
    actif: true,
    rayonId: null,
    competence: null,
    fonction: null,
    rayonsRepresentes: [],
    personnesDesignees: [],
    jours: null,
    moment: { type: 'a-definir' },
    dureeMinutes: null,
    occurrencesParSemaine: null,
    ...champs,
  }
}

/** Identifiants des taches confiees nommement : l'import y range les personnes. */
export const TACHE = {
  emballageCharcuterie: 'emballage-charcuterie',
  emballageBoucherie: 'emballage-boucherie',
  emballageFromage: 'emballage-fromage',
  skinMaree: 'skin-maree',
  reunionManagers: 'reunion-managers',
  reunionTrad: 'reunion-trad',
} as const

export const ROTATION_SAMEDI_PREPARATION = 'samedi-preparation-traiteur'


export const TACHES_LA_VAUGINE: readonly TachePlanifiee[] = [
  tache({
    id: TACHE.emballageCharcuterie,
    nom: 'Emballage charcuterie',
    rayonId: RAYON.charcuterieFromage,
    jours: LUNDI_AU_JEUDI,
    moment: { type: 'libre' },
    dureeMinutes: 120,
    occurrencesParSemaine: 4,
  }),
  tache({
    id: TACHE.emballageBoucherie,
    nom: 'Emballage boucherie',
    rayonId: RAYON.boucherieLs,
  }),
  tache({
    id: TACHE.emballageFromage,
    nom: 'Emballage fromage',
    rayonId: RAYON.charcuterieFromage,
    personnesDesignees: null,
  }),
  tache({
    id: TACHE.skinMaree,
    nom: 'Skin marée (réserve selon arrivages)',
    nature: 'reserve',
    rayonId: RAYON.maree,
    competence: COMPETENCE.maree,
    jours: TOUS_LES_JOURS,
    moment: { type: 'libre' },
  }),
  tache({
    id: TACHE.reunionManagers,
    nom: 'Réunion managers',
    nature: 'reunion',
    fonction: 'manager',
    jours: [1],
    moment: { type: 'heure', heure: '13:00' },
    dureeMinutes: 30,
  }),
  tache({
    id: TACHE.reunionTrad,
    nom: 'Réunion secteur trad',
    nature: 'reunion',
    fonction: 'responsable',
    rayonsRepresentes: [
      RAYON.maree,
      RAYON.charcuterieFromage,
      RAYON.boucherieTrad,
      RAYON.preparationTraiteur,
    ],
    jours: TOUS_LES_JOURS,
    moment: { type: 'heure', heure: '08:00' },
    dureeMinutes: 5,
  }),
]

const CUISSONS_SEMAINE = { vente: { debut: '08:30', fin: '20:00' }, cuissons: ['08:30', '13:30', '18:30'] }

export const ORGANISATION_LA_VAUGINE: OrganisationPlanning = {
  // Samedi : affluence plus forte, plages A DEFINIR.
  plagesAffluence: {
    1: [{ debut: '11:00', fin: '13:00' }, { debut: '17:00', fin: '19:00' }],
    2: [{ debut: '11:00', fin: '13:00' }, { debut: '17:00', fin: '19:00' }],
    3: [{ debut: '11:00', fin: '13:00' }, { debut: '17:00', fin: '19:00' }],
    4: [{ debut: '11:00', fin: '13:00' }, { debut: '17:00', fin: '19:00' }],
    5: [{ debut: '11:00', fin: '13:00' }, { debut: '17:00', fin: '19:00' }],
    6: AFFLUENCE_SAMEDI,
    7: [],
  },
  taches: TACHES_LA_VAUGINE,
  rotisserie: {
    actif: true,
    rayonId: RAYON.boucherieTrad,
    competence: COMPETENCE.rotisserie,
    maintienAuChaudMaximumMinutes: 5 * 60,
    dureeCuissonMinutes: null,
    jours: {
      1: CUISSONS_SEMAINE,
      2: CUISSONS_SEMAINE,
      3: CUISSONS_SEMAINE,
      4: CUISSONS_SEMAINE,
      5: CUISSONS_SEMAINE,
      6: CUISSONS_SEMAINE,
      7: { vente: { debut: '08:30', fin: '12:30' }, cuissons: ['08:30'] },
    },
  },
  rotations: [
    {
      id: ROTATION_SAMEDI_PREPARATION,
      nom: 'Samedi en préparation traiteur',
      rayonId: RAYON.preparationTraiteur,
      jours: [6],
      personnes: [],
      personnesParJour: 1,
    },
  ],
  reglesInternes: REGLES_INTERNES_PAR_DEFAUT,
  pointsAVerifier: [
    {
      id: 'mineurs-contrat',
      libelle:
        'Mineurs : un contrat de 36 h 75 dépasse-t-il le plafond de 35 h ? ' +
        '(Si les 1 h 45 de pause payée sont comprises, le travail effectif est de 35 h.)',
      verifie: false,
    },
    {
      id: 'mineurs-dimanche-feries',
      libelle: 'Mineurs : travail du dimanche et des jours fériés (convention collective, RH).',
      verifie: false,
    },
  ],
}
