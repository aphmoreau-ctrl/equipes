import type { ParametresRegles } from './types'

/**
 * Valeurs par defaut des regles (cahier des charges §8).
 *
 * ATTENTION : ce sont des valeurs de DEPART, a verifier et ajuster selon le
 * contrat de travail et les accords du magasin. Elles seront toutes modifiables
 * depuis l'ecran Parametres ; ce fichier ne fait que donner le point de depart.
 *
 * Les durees sont en minutes, jamais en heures decimales : 10 h vaut 600.
 */
export const PARAMETRES_PAR_DEFAUT: ParametresRegles = {
  // Duree maximale de travail effectif par jour : 10 h.
  dureeMaximaleQuotidienneMinutes: 10 * 60,
  // Derogation exceptionnelle (inventaire, etc.) : 12 h.
  dureeMaximaleQuotidienneDerogationMinutes: 12 * 60,
  // Moins de 18 ans : 8 h par jour et 35 h par semaine (L3162-1).
  dureeMaximaleQuotidienneJeuneMinutes: 8 * 60,
  dureeMaximaleHebdomadaireJeuneMinutes: 35 * 60,
  // Duree maximale sur une semaine isolee : 48 h.
  dureeMaximaleHebdomadaireMinutes: 48 * 60,
  // Moyenne maximale sur 12 semaines consecutives : 44 h.
  dureeMoyenneMaximaleSur12SemainesMinutes: 44 * 60,
  // Repos quotidien : 11 h consecutives entre deux journees.
  reposQuotidienMinutes: 11 * 60,
  // Moins de 18 ans : 12 h consecutives.
  reposQuotidienJeuneMinutes: 12 * 60,
  // Repos hebdomadaire : 35 h consecutives (24 h de repos hebdomadaire
  // AUXQUELLES S'AJOUTENT les 11 h de repos quotidien) - L3132-2.
  reposHebdomadaireMinutes: 35 * 60,
  // Moins de 18 ans : deux jours consecutifs, soit 48 h (L3164-2).
  reposHebdomadaireJeuneMinutes: 48 * 60,
  // Six jours de travail au maximum par semaine civile (L3132-1).
  joursMaximumParSemaine: 6,
  // Moins de 18 ans : cinq jours, puisqu'il leur faut deux jours de repos.
  joursMaximumParSemaineJeune: 5,
  // Une pause est due des 6 h de travail...
  seuilDeclenchantLaPauseMinutes: 6 * 60,
  // ... et elle dure au minimum 20 min.
  dureeMinimaleDeLaPauseMinutes: 20,
  // Moins de 18 ans : 30 min des 4 h 30 de travail (L3162-3).
  seuilDeclenchantLaPauseJeuneMinutes: 4 * 60 + 30,
  dureeMinimaleDeLaPauseJeuneMinutes: 30,
  // Delai de prevenance avant un changement de planning, en jours ouvres.
  delaiDePrevenanceJoursOuvres: 7,
  // Contingent annuel d'heures supplementaires (convention 2216).
  contingentHeuresSupplementairesAnnuel: 180,
  // Duree legale hebdomadaire : au-dela, les heures sont supplementaires.
  dureeLegaleHebdomadaireMinutes: 35 * 60,
  // Temps partiel : une seule coupure par jour, de deux heures au plus.
  coupuresMaximumParJour: 1,
  dureeMaximaleCoupureMinutes: 2 * 60,
  // Heures complementaires plafonnees a un dixieme du contrat.
  plafondHeuresComplementairesPourcent: 10,
  // Duree minimale d'un temps partiel : 24 h par semaine.
  dureeMinimaleTempsPartielMinutes: 24 * 60,
  // Nuit au sens de la loi : de 21 h a 6 h (L3122-2).
  nuitDebut: '21:00',
  nuitFin: '06:00',
  // Au-dela de 270 h de nuit par an, on devient travailleur de nuit.
  seuilTravailleurDeNuitHeuresAnnuelles: 270,
  // De 16 a 17 ans : ni apres 22 h, ni avant 6 h (L3163-1).
  jeuneNuitDebut: '22:00',
  jeuneNuitFin: '06:00',
  // Avant 16 ans, la nuit commence deux heures plus tot : 20 h (L3163-1).
  moinsDe16NuitDebut: '20:00',
  moinsDe16NuitFin: '06:00',
  majorations: {
    dimancheHabituelPourcent: 20,
    dimancheExceptionnelPourcent: 100,
    ferieTravaillePourcent: 100,
    nuit21a22Pourcent: 5,
    nuit22a5Pourcent: 20,
  },
  // Par defaut, toute regle legale est BLOQUANTE : le generateur ne la violera
  // jamais. L'utilisateur pourra abaisser certaines regles en avertissement.
  severites: {
    'duree-maximale-quotidienne': 'bloquante',
    'duree-maximale-hebdomadaire': 'bloquante',
    'duree-moyenne-12-semaines': 'bloquante',
    'repos-quotidien': 'bloquante',
    'repos-hebdomadaire': 'bloquante',
    'jours-maximum-par-semaine': 'bloquante',
    'pause-obligatoire': 'bloquante',
    'temps-partiel-coupures': 'bloquante',
    'heures-complementaires': 'bloquante',
    'delai-de-prevenance': 'avertissement',
    'contingent-heures-supplementaires': 'avertissement',
    'travail-de-nuit': 'avertissement',
    'jeune-travailleur': 'bloquante',
    'formation-en-centre': 'bloquante',
  },
}
