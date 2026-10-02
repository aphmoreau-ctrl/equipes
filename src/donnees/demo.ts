import type { JourSemaine } from '../domaine/calendrier'
import type { HorairesSemaine, Magasin } from '../domaine/magasin'
import { exige } from '../moteurs/besoin'
import type { Bloc, ConfigurationRayon } from '../moteurs/besoin'
import { MODELES_AUTRES_RAYONS } from './modeles-rayons'

/**
 * DONNEES DE DEMONSTRATION - ENTIEREMENT FICTIVES.
 *
 * Regle absolue du projet : aucune donnee reelle dans le depot, qui est public.
 * Aucun nom de personne, aucun chiffre reel de magasin.
 *
 * Ces valeurs sont un POINT DE DEPART plausible, destine a etre remplace par
 * les vraies valeurs du magasin depuis l'ecran Parametres.
 */

const LUNDI_AU_SAMEDI: readonly JourSemaine[] = [1, 2, 3, 4, 5, 6]
const TOUS_LES_JOURS: readonly JourSemaine[] = [1, 2, 3, 4, 5, 6, 7]

function memeHoraireTousLesJours(
  ouverture: string,
  fermeture: string,
  dimanche: { ouverture: string; fermeture: string },
): HorairesSemaine {
  const jour = { ouvert: true, ouverture, fermeture }
  return {
    1: jour,
    2: jour,
    3: jour,
    4: jour,
    5: jour,
    6: jour,
    7: { ouvert: true, ...dimanche },
  }
}

/**
 * Repartition des clients sur la journee, en pourcentage.
 * 48 valeurs, une par tranche de 30 minutes, de 00:00 a 23:30.
 * Deux pointes : la fin de matinee et la fin d'apres-midi.
 */
const PROFIL_HORAIRE: readonly number[] = [
  // 00:00 a 08:00 - magasin ferme
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  // 08:30, 09:00, 09:30
  2, 3, 4,
  // 10:00, 10:30, 11:00, 11:30
  5, 6, 7, 7.5,
  // 12:00, 12:30, 13:00, 13:30
  6, 4, 3, 2.5,
  // 14:00, 14:30, 15:00, 15:30
  3, 3.5, 4, 4.5,
  // 16:00, 16:30, 17:00, 17:30
  5.5, 6.5, 7, 7,
  // 18:00, 18:30, 19:00
  5, 2.5, 1.5,
  // 19:30 a 23:30 - magasin ferme
  0, 0, 0, 0, 0, 0, 0, 0, 0,
]

export const MAGASIN_DEMO: Magasin = {
  nom: 'Magasin de démonstration',

  services: [{ id: 'frais', nom: 'Frais', ordre: 1, actif: true }],

  rayons: [
    { id: 'fruits-legumes', serviceId: 'frais', nom: 'Fruits et légumes', ordre: 1, actif: true, horairesPropres: null },
    { id: 'boucherie', serviceId: 'frais', nom: 'Boucherie', ordre: 2, actif: true, horairesPropres: null },
    { id: 'maree', serviceId: 'frais', nom: 'Marée', ordre: 3, actif: true, horairesPropres: null },
    { id: 'cremerie', serviceId: 'frais', nom: 'Crèmerie / libre-service frais', ordre: 4, actif: true, horairesPropres: null },
    { id: 'charcuterie-traiteur', serviceId: 'frais', nom: 'Charcuterie-traiteur', ordre: 5, actif: true, horairesPropres: null },
    { id: 'fromage', serviceId: 'frais', nom: 'Fromage', ordre: 6, actif: true, horairesPropres: null },
    { id: 'boulangerie', serviceId: 'frais', nom: 'Boulangerie', ordre: 7, actif: true, horairesPropres: null },
    // La cave ouvre plus tard que le frais : personne n'achete de vin a 8 h 30.
    {
      id: 'cave-vins',
      serviceId: 'frais',
      nom: 'Cave / vins',
      ordre: 8,
      actif: true,
      horairesPropres: memeHoraireTousLesJours('09:30', '19:30', {
        ouverture: '09:30',
        fermeture: '12:30',
      }),
    },
    // Le drive ouvre avant le magasin et ferme avec lui : les creneaux de
    // retrait commencent a 9 h, la preparation bien avant.
    {
      id: 'drive',
      serviceId: 'frais',
      nom: 'Drive',
      ordre: 9,
      actif: true,
      horairesPropres: memeHoraireTousLesJours('09:00', '19:30', {
        ouverture: '09:00',
        fermeture: '12:30',
      }),
    },
  ],

  horaires: memeHoraireTousLesJours('08:30', '19:30', { ouverture: '09:00', fermeture: '12:30' }),

  frequentation: {
    clientsParJour: { 1: 900, 2: 850, 3: 950, 4: 900, 5: 1400, 6: 1800, 7: 700 },
    profilHoraire: PROFIL_HORAIRE,
  },

  horairesTypes: [
    { id: 'matin', nom: 'Matin', debut: '05:30', fin: '12:30', pauseMinutes: 20, pauseDebut: '09:00' },
    { id: 'journee', nom: 'Journée', debut: '07:00', fin: '14:00', pauseMinutes: 20, pauseDebut: '10:30' },
    { id: 'apres-midi', nom: 'Après-midi', debut: '13:30', fin: '20:30', pauseMinutes: 20, pauseDebut: '17:00' },
  ],

  evenements: [
    {
      id: 'promo-automne',
      nom: 'Catalogue promotionnel automne',
      debut: '2026-11-04',
      fin: '2026-11-10',
      rayonsConcernes: [],
      coefficient: 1.2,
    },
    {
      id: 'vacances-toussaint',
      nom: 'Vacances scolaires de la Toussaint',
      debut: '2026-10-17',
      fin: '2026-11-02',
      rayonsConcernes: [],
      coefficient: 1.1,
    },
  ],

  // Budgets cales sur le besoin calcule par les modeles, avec environ dix pour
  // cent de marge. A remplacer par les budgets reels du magasin.
  budgetHeuresParRayon: {
    'fruits-legumes': 180,
    boucherie: 150,
    maree: 100,
    cremerie: 85,
    'charcuterie-traiteur': 135,
    fromage: 115,
    boulangerie: 120,
    'cave-vins': 60,
    drive: 190,
  },
}

/** Rayons de demonstration, pour les ecrans qui n'ont besoin que de la liste. */
export const RAYONS_DEMO = MAGASIN_DEMO.rayons
export const SERVICE_DEMO = 'Frais'
export const HORAIRES_TYPES_DEMO = MAGASIN_DEMO.horairesTypes

// ------------------------------------------------------------------------
// Modele du rayon fruits et legumes - le plus detaille (cahier des charges §7.4)
// ------------------------------------------------------------------------

const BLOCS_FRUITS_LEGUMES: readonly Bloc[] = [
  {
    id: 'fl-reception',
    nom: 'Réception et contrôle',
    type: 'reception',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '05:00', fin: '06:30' },
    competences: [exige('réception')],
    coefficients: ['evenement'],
    palettesParJour: { 1: 6, 2: 4, 3: 5, 4: 4, 5: 7, 6: 8, 7: 0 },
    minutesParPalette: 12,
  },
  {
    id: 'fl-mise-en-place-vrac',
    nom: 'Mise en place des étals (vrac)',
    type: 'mise-en-place',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '05:30', fin: '08:30' },
    competences: [exige('mise en place')],
    coefficients: ['qualite', 'saison', 'evenement', 'promotion'],
    colisParJour: { 1: 110, 2: 80, 3: 95, 4: 80, 5: 130, 6: 160, 7: 0 },
    cadenceColisParHeure: 22,
  },
  {
    id: 'fl-mise-en-place-ls',
    nom: 'Mise en place libre-service',
    type: 'mise-en-place',
    actif: true,
    jours: LUNDI_AU_SAMEDI,
    plage: { debut: '06:00', fin: '09:00' },
    competences: [exige('mise en place')],
    coefficients: ['qualite', 'evenement', 'promotion'],
    colisParJour: { 1: 45, 2: 35, 3: 40, 4: 35, 5: 55, 6: 70, 7: 0 },
    cadenceColisParHeure: 38,
  },
  {
    id: 'fl-transformation',
    nom: 'Fruits découpés, salades et jus',
    type: 'transformation',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '06:30', fin: '09:30' },
    competences: [exige('hygiène'), exige('découpe')],
    coefficients: ['saison', 'meteo'],
    produits: [
      { nom: 'Salades de fruits', quantite: 18, minutesParUnite: 3.5 },
      { nom: 'Barquettes de fruits découpés', quantite: 24, minutesParUnite: 2.5 },
      { nom: 'Jus pressés', quantite: 15, minutesParUnite: 2 },
    ],
    minutesMiseEnRoute: 15,
    minutesNettoyage: 30,
    postes: 2,
  },
  {
    id: 'fl-balances',
    nom: 'Balances du rayon',
    type: 'balances',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '07:30', fin: '08:30' },
    competences: [],
    coefficients: [],
    minutesParJour: 20,
  },
  {
    id: 'fl-facing',
    nom: 'Facing des étals',
    type: 'facing',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '09:00', fin: '12:00' },
    competences: [],
    coefficients: ['saison'],
    minutesParMetre: 0.8,
  },
  {
    id: 'fl-reassort',
    nom: 'Réassort en journée',
    type: 'reassort',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '09:00', fin: '19:30' },
    competences: [],
    coefficients: ['meteo', 'evenement', 'promotion'],
    minutesPour100Clients: 14,
  },
  {
    id: 'fl-tri',
    nom: 'Tri et retrait des produits abîmés',
    type: 'tri',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '11:00', fin: '18:00' },
    competences: [],
    coefficients: ['qualite', 'saison', 'meteo'],
    minutesParMetre: 1.6,
  },
  {
    id: 'fl-controle-dates',
    nom: 'Contrôle des dates (produits préparés)',
    type: 'controle-dates',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '09:30', fin: '10:30' },
    competences: [],
    coefficients: [],
    minutesParReference: 0.1,
  },
  {
    id: 'fl-nettoyage',
    nom: 'Démontage et nettoyage du soir',
    type: 'nettoyage',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '18:30', fin: '19:30' },
    competences: [],
    coefficients: [],
    minutesParMeuble: 9,
  },
  {
    id: 'fl-temperatures',
    nom: 'Relevé des températures',
    type: 'tache-fixe',
    actif: true,
    jours: TOUS_LES_JOURS,
    plage: { debut: '06:00', fin: '06:30' },
    competences: [],
    coefficients: [],
    minutes: 10,
  },
  {
    id: 'fl-commandes',
    nom: 'Commandes fournisseurs',
    type: 'tache-fixe',
    actif: true,
    jours: [1, 2, 3, 4, 5, 6],
    plage: { debut: '10:00', fin: '11:00' },
    competences: [exige('commandes')],
    coefficients: [],
    minutes: 40,
  },
]

export const CONFIGURATION_FRUITS_LEGUMES: ConfigurationRayon = {
  rayonId: 'fruits-legumes',
  taille: { metresLineaires: 42, etals: 14, meublesFroids: 3, nombreReferences: 280 },
  blocs: BLOCS_FRUITS_LEGUMES,
  presenceMinimum: 1,
  tolerance: 0.2,
  // Qualite a la reception (§7.3) : A sans tri, B tri leger, C tri important.
  coefficientsQualite: { A: 1, B: 1.3, C: 1.8, refus: 0.5 },
  // Les fruits et legumes sont tres sensibles a la meteo.
  coefficientsMeteo: { normal: 1, chaud: 1.15, 'tres-chaud': 1.3, froid: 0.95, pluie: 0.85 },
  // Forte saisonnalite : pic en ete, creux en hiver.
  coefficientsSaison: {
    1: 0.85, 2: 0.85, 3: 0.95, 4: 1, 5: 1.1, 6: 1.2,
    7: 1.3, 8: 1.3, 9: 1.15, 10: 1, 11: 0.95, 12: 1.1,
  },
  coefficientPromotion: 1.25,
}

/** Les sept rayons frais sont modelises. */
export const CONFIGURATIONS_DEMO: readonly ConfigurationRayon[] = [
  CONFIGURATION_FRUITS_LEGUMES,
  ...MODELES_AUTRES_RAYONS,
]

export function configurationDuRayon(rayonId: string): ConfigurationRayon | undefined {
  return CONFIGURATIONS_DEMO.find((configuration) => configuration.rayonId === rayonId)
}
