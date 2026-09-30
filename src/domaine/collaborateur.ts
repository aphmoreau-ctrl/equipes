import type { JourSemaine } from './calendrier'
import type { Minutes } from './temps'

/**
 * Fiche d'un collaborateur (cahier des charges §6).
 *
 * RGPD : prenom et INITIALE du nom uniquement. Aucun motif medical, aucune
 * situation familiale, aucune appreciation personnelle. Uniquement des faits
 * datés, utiles a l'organisation du travail.
 */

export type StatutCollaborateur = 'employe' | 'agent-maitrise' | 'cadre'

export type TypeContrat = 'cdi' | 'cdd' | 'interim' | 'apprenti' | 'etudiant'

/** Grille de polyvalence : 0 ne sait pas faire, 3 sait former les autres. */
export type NiveauCompetence = 0 | 1 | 2 | 3

export const LIBELLES_STATUT: Readonly<Record<StatutCollaborateur, string>> = {
  employe: 'Employé',
  'agent-maitrise': 'Agent de maîtrise',
  cadre: 'Cadre',
}

export const LIBELLES_CONTRAT: Readonly<Record<TypeContrat, string>> = {
  cdi: 'CDI',
  cdd: 'CDD',
  interim: 'Intérim',
  apprenti: 'Apprenti',
  etudiant: 'Étudiant',
}

export const LIBELLES_NIVEAU: Readonly<Record<NiveauCompetence, string>> = {
  0: 'Ne fait pas',
  1: 'Avec aide',
  2: 'Autonome',
  3: 'Sait former',
}

/** Disponibilite declaree pour un jour de la semaine. */
export interface Disponibilite {
  readonly jour: JourSemaine
  readonly disponible: boolean
  /** Plage restreinte (« matins uniquement »), ou null si toute la journee. */
  readonly plage: { readonly debut: string; readonly fin: string } | null
}

/** Habilitation obligatoire : hygiene, transpalette, decoupe... */
export interface Habilitation {
  readonly id: string
  readonly nom: string
  readonly obtenue: string
  /** Date d'expiration, ou null si l'habilitation ne se perime pas. */
  readonly expire: string | null
}

/** Compteurs d'equite, pour repartir les sujetions entre tous. */
export interface CompteursEquite {
  readonly samedisTravailles: number
  readonly dimanchesTravailles: number
  readonly fermetures: number
  readonly feriesTravailles: number
}

export interface Collaborateur {
  readonly id: string
  readonly prenom: string
  /** Initiale du nom de famille, suivie d'un point. Jamais le nom entier. */
  readonly initiale: string

  readonly serviceId: string
  readonly rayonPrincipal: string
  readonly rayonsSecondaires: readonly string[]

  readonly poste: string
  readonly statut: StatutCollaborateur
  /** Niveau de classification de la convention 2216. */
  readonly niveauClassification: string

  readonly contrat: TypeContrat
  readonly heuresHebdomadaires: number
  readonly tempsPlein: boolean

  readonly dateEntree: string
  readonly finPeriodeEssai: string | null
  readonly finContrat: string | null

  readonly disponibilites: readonly Disponibilite[]
  readonly competences: Readonly<Record<string, NiveauCompetence>>
  readonly habilitations: readonly Habilitation[]
  readonly compteursEquite: CompteursEquite

  /**
   * Moins de 18 ans : declenche les regles protectrices des jeunes
   * travailleurs (repos de 12 h, pas de travail de nuit, 8 h par jour).
   *
   * On enregistre un simple oui/non, jamais la date de naissance : c'est la
   * donnee minimale suffisante pour appliquer la loi (RGPD, §3).
   */
  readonly estMineur: boolean

  /** Contact pour les remplacements, seulement si la personne l'a accepte. */
  readonly contactAutorise: boolean
  readonly actif: boolean
}

/** « Camille D. » — la seule forme d'identite affichee dans l'application. */
export function nomAffiche(collaborateur: Collaborateur): string {
  return `${collaborateur.prenom} ${collaborateur.initiale}`
}

/** Minutes de travail prevues au contrat, par semaine. */
export function minutesHebdomadaires(collaborateur: Collaborateur): Minutes {
  return Math.round(collaborateur.heuresHebdomadaires * 60)
}

/** Disponibilite declaree pour un jour donne. Par defaut : disponible. */
export function disponibiliteDuJour(
  collaborateur: Collaborateur,
  jour: JourSemaine,
): Disponibilite {
  return (
    collaborateur.disponibilites.find((disponibilite) => disponibilite.jour === jour) ?? {
      jour,
      disponible: true,
      plage: null,
    }
  )
}

/** Vrai si la personne a declare pouvoir travailler ce jour-la. */
export function estDisponible(collaborateur: Collaborateur, jour: JourSemaine): boolean {
  return disponibiliteDuJour(collaborateur, jour).disponible
}

/** Niveau atteint pour une competence. Absente = niveau 0. */
export function niveauDeCompetence(
  collaborateur: Collaborateur,
  competence: string,
): NiveauCompetence {
  return collaborateur.competences[competence] ?? 0
}

/** Vrai si la personne sait tenir ce poste seule (niveau 2 ou 3). */
export function estAutonome(collaborateur: Collaborateur, competence: string): boolean {
  return niveauDeCompetence(collaborateur, competence) >= 2
}

/** Rayons ou la personne peut intervenir : le principal et les secondaires. */
export function rayonsPossibles(collaborateur: Collaborateur): string[] {
  return [collaborateur.rayonPrincipal, ...collaborateur.rayonsSecondaires]
}

/** Vrai si la personne peut travailler dans ce rayon. */
export function peutTravaillerDans(collaborateur: Collaborateur, rayonId: string): boolean {
  return rayonsPossibles(collaborateur).includes(rayonId)
}

/** Collaborateurs actifs d'un rayon, tries par prenom. */
export function collaborateursDuRayon(
  collaborateurs: readonly Collaborateur[],
  rayonId: string,
): Collaborateur[] {
  return collaborateurs
    .filter((collaborateur) => collaborateur.actif && peutTravaillerDans(collaborateur, rayonId))
    .sort((a, b) => nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))
}

/** Somme des heures hebdomadaires contractuelles d'un rayon. */
export function capaciteHebdomadaire(
  collaborateurs: readonly Collaborateur[],
  rayonId: string,
): number {
  return collaborateurs
    .filter(
      (collaborateur) => collaborateur.actif && collaborateur.rayonPrincipal === rayonId,
    )
    .reduce((somme, collaborateur) => somme + collaborateur.heuresHebdomadaires, 0)
}
