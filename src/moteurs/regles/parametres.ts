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
  // Duree maximale sur une semaine isolee : 48 h.
  dureeMaximaleHebdomadaireMinutes: 48 * 60,
  // Moyenne maximale sur 12 semaines consecutives : 44 h.
  dureeMoyenneMaximaleSur12SemainesMinutes: 44 * 60,
  // Repos quotidien : 11 h consecutives entre deux journees.
  reposQuotidienMinutes: 11 * 60,
  // Repos hebdomadaire : 35 h consecutives (24 h + 11 h).
  reposHebdomadaireMinutes: 35 * 60,
  // Une pause est due des 6 h de travail...
  seuilDeclenchantLaPauseMinutes: 6 * 60,
  // ... et elle dure au minimum 20 min.
  dureeMinimaleDeLaPauseMinutes: 20,
  // Delai de prevenance avant un changement de planning, en jours ouvres.
  delaiDePrevenanceJoursOuvres: 7,
  // Contingent annuel d'heures supplementaires (convention 2216).
  contingentHeuresSupplementairesAnnuel: 180,
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
    'pause-obligatoire': 'bloquante',
    'temps-partiel-coupures': 'bloquante',
    'heures-complementaires': 'bloquante',
    'delai-de-prevenance': 'avertissement',
    'contingent-heures-supplementaires': 'avertissement',
    'travail-de-nuit': 'avertissement',
    'jeune-travailleur': 'bloquante',
  },
}
