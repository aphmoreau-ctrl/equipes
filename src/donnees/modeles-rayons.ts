import type { JourSemaine } from '../domaine/calendrier'
import { exige } from '../moteurs/besoin'
import type { Bloc, ConfigurationRayon, Meteo, NiveauQualite } from '../moteurs/besoin'

/**
 * Modeles des rayons frais - DONNEES FICTIVES.
 *
 * Chaque rayon est un assemblage de blocs different, conforme au §7.4 du
 * cahier des charges. Toutes les valeurs sont des ordres de grandeur
 * plausibles, a recaler avec le mode chrono et l'ecran Parametres.
 */

const LUNDI_AU_SAMEDI: readonly JourSemaine[] = [1, 2, 3, 4, 5, 6]
const TOUS_LES_JOURS: readonly JourSemaine[] = [1, 2, 3, 4, 5, 6, 7]

/** Raccourci : meme valeur en semaine, plus forte le vendredi et le samedi. */
function volumes(
  semaine: number,
  vendredi: number,
  samedi: number,
  dimanche = 0,
): Record<JourSemaine, number> {
  return { 1: semaine, 2: semaine, 3: semaine, 4: semaine, 5: vendredi, 6: samedi, 7: dimanche }
}

const QUALITE_STANDARD: Readonly<Record<NiveauQualite, number>> = {
  A: 1,
  B: 1.2,
  C: 1.5,
  refus: 0.5,
}

const METEO_NEUTRE: Readonly<Record<Meteo, number>> = {
  normal: 1,
  chaud: 1,
  'tres-chaud': 1,
  froid: 1,
  pluie: 1,
}

function saisonPlate(): Record<number, number> {
  return { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 }
}

/** Saison marquee : creux en ete, pic en decembre (fetes). */
function saisonFetes(): Record<number, number> {
  return {
    1: 0.95, 2: 0.95, 3: 1, 4: 1.05, 5: 1, 6: 0.95,
    7: 0.9, 8: 0.9, 9: 1, 10: 1, 11: 1.05, 12: 1.35,
  }
}

// --------------------------------------------------------------- Boucherie

const BLOCS_BOUCHERIE: readonly Bloc[] = [
  {
    id: 'bo-livraison',
    nom: 'Réception et mise en chambre',
    type: 'format-livraison',
    actif: true,
    jours: [1, 3, 5],
    plage: { debut: '05:00', fin: '06:30' },
    competences: [exige('boucherie')],
    coefficients: ['evenement'],
    format: 'Quartiers',
    quantiteParJour: volumes(0, 0, 0),
    minutesParUnite: 1.1,
  },
  {
    id: 'bo-laboratoire',
    nom: 'Laboratoire : hachés, brochettes, barquettes',
    type: 'transformation',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '05:30', fin: '09:30' },
    competences: [exige('boucherie'), exige('hygiène')],
    coefficients: ['saison', 'evenement', 'promotion'],
    produits: [
      { nom: 'Barquettes libre-service', quantite: 70, minutesParUnite: 1.8 },
      { nom: 'Brochettes et préparations', quantite: 25, minutesParUnite: 3 },
      { nom: 'Viande hachée', quantite: 20, minutesParUnite: 2 },
    ],
    minutesMiseEnRoute: 20,
    minutesNettoyage: 45,
    postes: 2,
  },
  {
    id: 'bo-mise-en-place-ls',
    nom: 'Mise en place du libre-service',
    type: 'mise-en-place',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '07:30', fin: '09:30' },
    competences: [],
    coefficients: ['evenement', 'promotion'],
    colisParJour: volumes(22, 30, 38),
    cadenceColisParHeure: 30,
  },
  {
    id: 'bo-comptoir',
    nom: 'Comptoir boucherie',
    type: 'comptoir',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '08:30', fin: '19:30' },
    // Au moins un BOUCHER QUALIFIE derriere le comptoir des qu'il est ouvert :
    // c'est une competence critique, jamais remplacable par quelqu'un d'autre.
    competences: [exige('boucherie', 2, true)],
    coefficients: ['evenement', 'promotion'],
    partClientsPourcent: 14,
    minutesParClient: 2.6,
    presenceMinimum: 1,
  },
  {
    id: 'bo-tracabilite',
    nom: 'Traçabilité et étiquetage',
    type: 'tache-fixe',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '07:00', fin: '08:00' },
    competences: [exige('boucherie')],
    coefficients: [],
    minutes: 25,
  },
  {
    id: 'bo-controle-dates',
    nom: 'Contrôle des dates',
    type: 'controle-dates',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '09:00', fin: '10:00' },
    competences: [],
    coefficients: [],
    minutesParReference: 0.25,
  },
  {
    id: 'bo-nettoyage',
    nom: 'Nettoyage du laboratoire et du comptoir',
    type: 'nettoyage',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '18:30', fin: '19:45' },
    competences: [exige('hygiène')],
    coefficients: [],
    minutesParMeuble: 14,
  },
]

// ------------------------------------------------------------------- Marée

const BLOCS_MAREE: readonly Bloc[] = [
  {
    id: 'ma-arrivage',
    nom: 'Arrivage et contrôle',
    type: 'reception',
    actif: true,
    jours: [2, 3, 4, 5, 6],
    plage: { debut: '05:00', fin: '06:00' },
    competences: [exige('marée')],
    coefficients: ['evenement'],
    palettesParJour: { 1: 0, 2: 3, 3: 3, 4: 3, 5: 5, 6: 6, 7: 0 },
    minutesParPalette: 14,
  },
  {
    id: 'ma-mise-en-glace',
    nom: 'Mise en glace et montage de l’étal',
    type: 'tache-fixe',
    actif: true,
    jours: [2, 3, 4, 5, 6, 7],
    plage: { debut: '06:00', fin: '08:30' },
    competences: [exige('marée')],
    coefficients: [],
    minutes: 110,
  },
  {
    id: 'ma-preparation',
    nom: 'Écaillage et filetage',
    type: 'format-livraison',
    actif: true,
    jours: [2, 3, 4, 5, 6],
    plage: { debut: '06:30', fin: '09:00' },
    competences: [exige('marée')],
    coefficients: ['evenement', 'promotion'],
    format: 'Poisson entier à préparer',
    quantiteParJour: { 1: 0, 2: 45, 3: 45, 4: 45, 5: 70, 6: 90, 7: 0 },
    minutesParUnite: 0.9,
  },
  {
    id: 'ma-comptoir',
    nom: 'Étal marée',
    type: 'comptoir',
    actif: true,
    jours: [2, 3, 4, 5, 6, 7],
    plage: { debut: '08:30', fin: '18:30' },
    competences: [exige('marée', 2, true)],
    coefficients: ['evenement', 'promotion'],
    partClientsPourcent: 7,
    minutesParClient: 3,
    presenceMinimum: 1,
  },
  {
    id: 'ma-demontage',
    nom: 'Démontage et nettoyage de l’étal',
    type: 'tache-fixe',
    actif: true,
    jours: [2, 3, 4, 5, 6, 7],
    plage: { debut: '18:30', fin: '19:45' },
    competences: [exige('hygiène')],
    coefficients: [],
    minutes: 75,
  },
]

// -------------------------------------------------- Crèmerie / LS frais

const BLOCS_CREMERIE: readonly Bloc[] = [
  {
    id: 'cr-reception',
    nom: 'Réception',
    type: 'reception',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '05:00', fin: '06:00' },
    competences: [exige('réception')],
    coefficients: ['evenement'],
    palettesParJour: volumes(5, 7, 8),
    minutesParPalette: 10,
  },
  {
    id: 'cr-mise-en-place',
    nom: 'Mise en rayon avant l’affluence',
    type: 'mise-en-place',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '05:30', fin: '09:00' },
    competences: [],
    coefficients: ['evenement', 'promotion'],
    colisParJour: volumes(150, 200, 240),
    cadenceColisParHeure: 45,
  },
  {
    id: 'cr-remplissage-midi',
    nom: 'Remplissage de mi-journée',
    type: 'mise-en-place',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '13:30', fin: '15:30' },
    competences: [],
    coefficients: ['evenement', 'promotion'],
    colisParJour: volumes(30, 45, 55, 20),
    cadenceColisParHeure: 45,
  },
  {
    id: 'cr-controle-dates',
    nom: 'Contrôle des dates',
    type: 'controle-dates',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '09:00', fin: '11:00' },
    competences: [],
    coefficients: [],
    minutesParReference: 0.12,
  },
  {
    id: 'cr-casse',
    nom: 'Casse et retraits',
    type: 'tache-fixe',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '16:00', fin: '17:00' },
    competences: [],
    coefficients: [],
    minutes: 35,
  },
  {
    id: 'cr-facing',
    nom: 'Facing du rayon',
    type: 'facing',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '11:00', fin: '13:00' },
    competences: [],
    coefficients: [],
    minutesParMetre: 0.5,
  },
  {
    id: 'cr-nettoyage',
    nom: 'Nettoyage des meubles',
    type: 'nettoyage',
    actif: true,
    jours: [1, 4],
    plage: { debut: '18:30', fin: '19:30' },
    competences: [],
    coefficients: [],
    minutesParMeuble: 12,
  },
]

// ---------------------------------------- Charcuterie-traiteur et fromage

function blocsComptoirTraiteur(
  prefixe: string,
  partClients: number,
  plats: boolean,
  partageAvecRayon?: string,
): Bloc[] {
  const blocs: Bloc[] = [
    {
      id: `${prefixe}-comptoir`,
      nom: 'Comptoir',
      type: 'comptoir',
      actif: true,
      jours: TOUS_LES_JOURS,
      plage: { debut: '08:30', fin: '19:30' },
      // La tenue du comptoir exige la competence du rayon : sans elle, le
      // poste ne peut pas etre tenu, meme par quelqu'un de disponible.
      competences: [exige(prefixe === 'ch' ? 'charcuterie' : 'fromage', 2, true)],
      coefficients: ['evenement', 'promotion'],
      partClientsPourcent: partClients,
      minutesParClient: 2.4,
      presenceMinimum: 1,
      ...(partageAvecRayon === undefined ? {} : { partageAvecRayon }),
    },
    {
      id: `${prefixe}-tranchage`,
      nom: 'Tranchage et mise en vitrine',
      type: 'tache-fixe',
      actif: true,
      jours: TOUS_LES_JOURS,
      plage: { debut: '06:30', fin: '08:30' },
      competences: [exige(prefixe === 'ch' ? 'charcuterie' : 'fromage')],
      coefficients: ['saison', 'evenement'],
      minutes: 95,
    },
    {
      id: `${prefixe}-mise-en-place-ls`,
      nom: 'Mise en place libre-service',
      type: 'mise-en-place',
      actif: true,
      jours: LUNDI_AU_SAMEDI,
      plage: { debut: '07:00', fin: '09:00' },
      competences: [],
      coefficients: ['evenement', 'promotion'],
      colisParJour: volumes(28, 38, 48),
      cadenceColisParHeure: 35,
    },
    {
      id: `${prefixe}-controle-dates`,
      nom: 'Contrôle des dates',
      type: 'controle-dates',
      actif: true,
      jours: TOUS_LES_JOURS,
      plage: { debut: '09:30', fin: '10:30' },
      competences: [],
      coefficients: [],
      minutesParReference: 0.2,
    },
    {
      id: `${prefixe}-nettoyage`,
      nom: 'Nettoyage de la vitrine',
      type: 'nettoyage',
      actif: true,
      jours: TOUS_LES_JOURS,
      plage: { debut: '18:45', fin: '19:45' },
      competences: [exige('hygiène')],
      coefficients: [],
      minutesParMeuble: 11,
    },
  ]

  if (plats) {
    blocs.push({
      id: `${prefixe}-plats`,
      nom: 'Plats préparés par lots',
      type: 'transformation',
      actif: true,
      jours: LUNDI_AU_SAMEDI,
      plage: { debut: '06:00', fin: '10:00' },
      competences: [exige('traiteur'), exige('hygiène')],
      coefficients: ['saison', 'evenement', 'promotion'],
      produits: [
        { nom: 'Salades traiteur', quantite: 20, minutesParUnite: 3 },
        { nom: 'Plats chauds', quantite: 12, minutesParUnite: 6 },
      ],
      minutesMiseEnRoute: 20,
      minutesNettoyage: 35,
      postes: 2,
    })
  }

  return blocs
}

// ---------------------------------------------------------- Boulangerie

const BLOCS_BOULANGERIE: readonly Bloc[] = [
  {
    id: 'bl-cuisson-matin',
    nom: 'Plan de cuisson du matin',
    type: 'plan-cuisson',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '05:00', fin: '09:00' },
    competences: [exige('boulangerie')],
    coefficients: ['evenement', 'promotion'],
    fourneesParJour: { 1: 7, 2: 7, 3: 8, 4: 7, 5: 10, 6: 12, 7: 9 },
    minutesParFournee: 18,
  },
  {
    id: 'bl-cuisson-apres-midi',
    nom: 'Plan de cuisson de l’après-midi',
    type: 'plan-cuisson',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '15:00', fin: '18:00' },
    competences: [exige('boulangerie')],
    coefficients: ['evenement'],
    fourneesParJour: volumes(3, 4, 5),
    minutesParFournee: 18,
  },
  {
    id: 'bl-comptoir',
    nom: 'Vente au comptoir',
    type: 'comptoir',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '08:30', fin: '19:30' },
    competences: [],
    coefficients: ['evenement'],
    partClientsPourcent: 18,
    minutesParClient: 1.1,
    presenceMinimum: 1,
  },
  {
    id: 'bl-mise-en-place',
    nom: 'Mise en place des présentoirs',
    type: 'tache-fixe',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '07:30', fin: '08:30' },
    competences: [],
    coefficients: [],
    minutes: 40,
  },
  {
    id: 'bl-nettoyage',
    nom: 'Nettoyage du fournil',
    type: 'nettoyage',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '18:30', fin: '19:45' },
    competences: [exige('hygiène')],
    coefficients: [],
    minutesParMeuble: 13,
  },
]

// ------------------------------------------------------------- Cave / vins

/*
 * La cave travaille autrement que le frais : pas de chaine du froid, pas de
 * dates courtes, mais un conseil client qui prend du temps et une foire aux
 * vins qui multiplie la charge pendant trois semaines. La foire passe par le
 * coefficient « evenement », a declarer dans Parametres.
 */
const BLOCS_CAVE: readonly Bloc[] = [
  {
    id: 'ca-reception',
    nom: 'Réception et mise en réserve',
    type: 'reception',
    actif: true,
    jours: [2, 4],
    plage: { debut: '06:00', fin: '08:00' },
    competences: [exige('réception', 1)],
    coefficients: ['evenement'],
    palettesParJour: { 1: 0, 2: 2, 3: 0, 4: 2, 5: 0, 6: 0, 7: 0 },
    minutesParPalette: 35,
  },
  {
    id: 'ca-mise-en-rayon',
    nom: 'Mise en rayon',
    type: 'mise-en-place',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '06:30', fin: '10:00' },
    competences: [exige('mise en rayon', 1)],
    coefficients: ['evenement', 'promotion'],
    colisParJour: volumes(14, 22, 26),
    cadenceColisParHeure: 28,
  },
  {
    id: 'ca-etiquetage',
    nom: 'Étiquetage et balisage des prix',
    type: 'tache-fixe',
    actif: true,
    jours: [1, 4],
    plage: { debut: '10:00', fin: '12:00' },
    competences: [exige('étiquetage', 1)],
    coefficients: ['promotion'],
    minutes: 50,
  },
  {
    id: 'ca-conseil',
    nom: 'Conseil client',
    type: 'comptoir',
    actif: true,
    jours: TOUS_LES_JOURS,
    /*
     * Le conseil se tient l'apres-midi et en fin de journee, quand les
     * acheteurs de vin passent. Le reste du temps, le rayon vit sans
     * presence dediee : ce n'est pas un comptoir de decoupe.
     */
    plage: { debut: '15:00', fin: '19:30' },
    // Le conseil en vins demande une vraie connaissance : sans elle, le
    // client repart sans reponse. Critique des que le rayon est tenu.
    competences: [exige('conseil vins', 2, true)],
    coefficients: ['evenement', 'promotion'],
    partClientsPourcent: 5,
    minutesParClient: 3.5,
    presenceMinimum: 1,
  },
  {
    id: 'ca-facing',
    nom: 'Facing et rangement du linéaire',
    type: 'facing',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '17:00', fin: '19:30' },
    competences: [],
    coefficients: [],
    minutesParMetre: 1.2,
  },
  {
    id: 'ca-nettoyage',
    nom: 'Nettoyage du rayon',
    type: 'nettoyage',
    actif: true,
    jours: [3, 6],
    plage: { debut: '19:00', fin: '20:00' },
    competences: [],
    coefficients: [],
    minutesParMeuble: 10,
  },
]

// ------------------------------------------------------------------- Drive

/*
 * Le drive se compte en COMMANDES, pas en clients ni en colis : chaque
 * commande se prepare, se controle, puis se remet sur un creneau. Les volumes
 * ci-dessous sont des commandes par jour, a remplacer par les vrais chiffres.
 */
const BLOCS_DRIVE: readonly Bloc[] = [
  {
    id: 'dr-preparation',
    nom: 'Préparation des commandes',
    type: 'format-livraison',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '06:00', fin: '18:00' },
    competences: [exige('préparation drive', 1)],
    coefficients: ['evenement', 'promotion'],
    format: 'Commandes',
    quantiteParJour: volumes(55, 85, 95, 40),
    minutesParUnite: 7,
  },
  {
    id: 'dr-controle',
    nom: 'Contrôle des commandes et bacs froids',
    type: 'format-livraison',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '07:00', fin: '18:30' },
    // La chaine du froid engage la responsabilite du magasin : le controle
    // ne se delegue pas a quelqu'un qui ne la maitrise pas.
    competences: [exige('contrôle drive', 2, true), exige('contrôle températures', 2)],
    coefficients: [],
    format: 'Commandes',
    quantiteParJour: volumes(55, 85, 95, 40),
    minutesParUnite: 1.8,
  },
  {
    id: 'dr-manquants',
    nom: 'Manquants et substitutions',
    type: 'format-livraison',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '07:30', fin: '18:00' },
    competences: [exige('préparation drive', 2)],
    coefficients: ['promotion'],
    format: 'Commandes',
    quantiteParJour: volumes(55, 85, 95, 40),
    minutesParUnite: 1.2,
  },
  {
    id: 'dr-remise',
    nom: 'Remise des commandes au client',
    type: 'comptoir',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '09:00', fin: '19:30' },
    competences: [exige('remise drive', 1)],
    coefficients: ['evenement'],
    // Part des clients du magasin qui viennent retirer une commande.
    partClientsPourcent: 9,
    minutesParClient: 4,
    // Une borne de retrait sans personne, c'est un client qui attend.
    presenceMinimum: 1,
  },
  {
    id: 'dr-nettoyage',
    nom: 'Nettoyage des bacs et de la zone de retrait',
    type: 'nettoyage',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '19:00', fin: '20:00' },
    competences: [exige('nettoyage', 1)],
    coefficients: [],
    minutesParMeuble: 12,
  },
]

// ------------------------------------------------------------ Assemblage

function modele(
  rayonId: string,
  taille: ConfigurationRayon['taille'],
  blocs: readonly Bloc[],
  modifications: Partial<ConfigurationRayon> = {},
): ConfigurationRayon {
  return {
    rayonId,
    taille,
    blocs,
    presenceMinimum: 0,
    tolerance: 0.2,
    coefficientsQualite: QUALITE_STANDARD,
    coefficientsMeteo: METEO_NEUTRE,
    coefficientsSaison: saisonPlate(),
    coefficientPromotion: 1.2,
    ...modifications,
  }
}

export const MODELE_BOUCHERIE = modele(
  'boucherie',
  { metresLineaires: 14, etals: 2, meublesFroids: 4, nombreReferences: 120 },
  BLOCS_BOUCHERIE,
  { coefficientsSaison: saisonFetes() },
)

export const MODELE_MAREE = modele(
  'maree',
  { metresLineaires: 7, etals: 1, meublesFroids: 1, nombreReferences: 45 },
  BLOCS_MAREE,
  {
    coefficientsSaison: saisonFetes(),
    // Le poisson se vend moins par forte chaleur, davantage en periode fraiche.
    coefficientsMeteo: { normal: 1, chaud: 0.95, 'tres-chaud': 0.9, froid: 1.05, pluie: 1 },
  },
)

export const MODELE_CREMERIE = modele(
  'cremerie',
  { metresLineaires: 38, etals: 0, meublesFroids: 9, nombreReferences: 620 },
  BLOCS_CREMERIE,
)

export const MODELE_CHARCUTERIE = modele(
  'charcuterie-traiteur',
  { metresLineaires: 10, etals: 1, meublesFroids: 3, nombreReferences: 190 },
  blocsComptoirTraiteur('ch', 12, true),
  { coefficientsSaison: saisonFetes() },
)

/*
 * Le comptoir du fromage est tenu avec celui de la charcuterie, par la meme
 * personne : il apporte sa charge de travail, mais n'exige personne de plus.
 * Desactivez « partageAvecRayon » si les deux comptoirs sont tenus separement.
 */
export const MODELE_FROMAGE = modele(
  'fromage',
  { metresLineaires: 8, etals: 1, meublesFroids: 2, nombreReferences: 210 },
  blocsComptoirTraiteur('fr', 9, false, 'charcuterie-traiteur'),
  { coefficientsSaison: saisonFetes() },
)

export const MODELE_BOULANGERIE = modele(
  'boulangerie',
  { metresLineaires: 9, etals: 2, meublesFroids: 1, nombreReferences: 80 },
  BLOCS_BOULANGERIE,
)

export const MODELE_CAVE = modele(
  'cave-vins',
  { metresLineaires: 24, etals: 0, meublesFroids: 2, nombreReferences: 480 },
  BLOCS_CAVE,
  {
    // La foire aux vins en septembre, les fetes en decembre.
    coefficientsSaison: {
      1: 0.85, 2: 0.85, 3: 0.95, 4: 1, 5: 1.05, 6: 1.05,
      7: 1.1, 8: 1, 9: 1.4, 10: 1.1, 11: 1.1, 12: 1.45,
    },
    // Le vin se vend davantage par beau temps : terrasses et barbecues.
    coefficientsMeteo: { normal: 1, chaud: 1.1, 'tres-chaud': 1.15, froid: 0.95, pluie: 0.95 },
  },
)

export const MODELE_DRIVE = modele(
  'drive',
  { metresLineaires: 0, etals: 0, meublesFroids: 6, nombreReferences: 0 },
  BLOCS_DRIVE,
  {
    // Une borne de retrait ouverte exige quelqu'un, toute la journee.
    presenceMinimum: 1,
    // La pluie fait basculer les clients du magasin vers le drive.
    coefficientsMeteo: { normal: 1, chaud: 1, 'tres-chaud': 1.1, froid: 1.05, pluie: 1.2 },
    coefficientsSaison: {
      1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1,
      7: 0.9, 8: 0.9, 9: 1.05, 10: 1, 11: 1.05, 12: 1.25,
    },
  },
)

export const MODELES_AUTRES_RAYONS: readonly ConfigurationRayon[] = [
  MODELE_BOUCHERIE,
  MODELE_MAREE,
  MODELE_CREMERIE,
  MODELE_CHARCUTERIE,
  MODELE_FROMAGE,
  MODELE_BOULANGERIE,
  MODELE_CAVE,
  MODELE_DRIVE,
]
