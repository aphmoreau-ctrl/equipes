import type { JourSemaine } from './calendrier'
import type { Collaborateur, NiveauCompetence } from './collaborateur'
import type { Vacation } from '../moteurs/regles'

/**
 * Vivier de remplacants exterieurs (cahier des charges §13, module 8) :
 * interimaires, etudiants, anciens salaries ou extras qu'on rappelle quand
 * l'equipe ne suffit pas. Les internes polyvalents, eux, sont deja dans
 * l'equipe et proposes en premier.
 *
 * RGPD : prenom + initiale, competences, jours possibles, cout. Pas de
 * telephone ni d'adresse : le contact se fait par l'agence ou par vos
 * propres moyens, hors application.
 */

export type OrigineRenfort = 'interim' | 'etudiant' | 'ancien' | 'autre'

export const LIBELLES_ORIGINE: Readonly<Record<OrigineRenfort, string>> = {
  interim: 'Intérimaire',
  etudiant: 'Étudiant',
  ancien: 'Ancien salarié',
  autre: 'Autre',
}

export interface Renfort {
  readonly id: string
  readonly prenom: string
  /** Initiale du nom suivie d'un point. Jamais le nom entier. */
  readonly initiale: string
  readonly origine: OrigineRenfort
  /** Agence d'interim, le cas echeant (« Agence du centre »). */
  readonly agence: string
  /** Rayons ou la personne peut intervenir. */
  readonly rayons: readonly string[]
  readonly competences: Readonly<Record<string, NiveauCompetence>>
  /** Jours de la semaine ou la personne est habituellement disponible. */
  readonly joursPossibles: readonly JourSemaine[]
  /** Cout horaire, en euros (facture de l'agence ou cout charge). */
  readonly coutHoraire: number
  /** La personne a accepte d'etre recontactee. */
  readonly contactAutorise: boolean
  readonly actif: boolean
}

export type MotifMission = 'remplacement' | 'renfort' | 'saison'

export const LIBELLES_MOTIF_MISSION: Readonly<Record<MotifMission, string>> = {
  remplacement: 'Remplacement',
  renfort: 'Renfort d’activité',
  saison: 'Saison',
}

/** Historique : une journee de mission d'un renfort exterieur. */
export interface Mission {
  readonly id: string
  readonly renfortId: string
  readonly date: string
  readonly rayonId: string
  readonly debut: string
  readonly fin: string
  readonly pauseMinutes: number
  readonly motif: MotifMission
  /** Vacation d'un absent que cette mission couvre, le cas echeant. */
  readonly vacationCouverte: string | null
}

export function nomRenfort(renfort: Renfort): string {
  return `${renfort.prenom} ${renfort.initiale}`
}

export function renfortVide(id: string, rayonId: string): Renfort {
  return {
    id,
    prenom: '',
    initiale: '',
    origine: 'interim',
    agence: '',
    rayons: [rayonId],
    competences: {},
    joursPossibles: [1, 2, 3, 4, 5, 6],
    coutHoraire: 25,
    contactAutorise: true,
    actif: true,
  }
}

/**
 * Pour le calcul de couverture uniquement : un renfort en mission compte
 * comme une presence, avec ses competences. Il n'entre JAMAIS dans l'equipe
 * ni dans le controle des regles (son employeur est l'agence).
 */
export function presenceDeRenfort(renfort: Renfort): Collaborateur {
  return {
    id: renfort.id,
    prenom: renfort.prenom,
    initiale: renfort.initiale,
    serviceId: '',
    rayonPrincipal: renfort.rayons[0] ?? '',
    rayonsSecondaires: renfort.rayons.slice(1),
    poste: LIBELLES_ORIGINE[renfort.origine],
    statut: 'employe',
    niveauClassification: '',
    contrat: renfort.origine === 'etudiant' ? 'etudiant' : 'interim',
    heuresHebdomadaires: 0,
    tempsPlein: false,
    dateEntree: '',
    finPeriodeEssai: null,
    finContrat: null,
    disponibilites: [],
    competences: renfort.competences,
    habilitations: [],
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    estMineur: false,
    contactAutorise: renfort.contactAutorise,
    actif: true,
  }
}

/** La mission vue comme une vacation, pour la couverture du jour. */
export function vacationDeMission(mission: Mission): Vacation {
  return {
    id: `mission-${mission.id}`,
    collaborateurId: mission.renfortId,
    rayonId: mission.rayonId,
    jour: mission.date,
    debut: mission.debut,
    fin: mission.fin,
    pauseMinutes: mission.pauseMinutes,
  }
}
