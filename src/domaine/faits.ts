import { suiviInitial, type Suivi } from './suivi'

/**
 * Faits datés : communication, documents, recrutement, suivi individuel,
 * sécurité (cahier des charges §13 modules 9, 11, 12, et §14 modules 13, 15).
 *
 * RGPD, valable pour TOUT ce fichier : uniquement des FAITS DATÉS. Jamais
 * d'appréciation sur une personne, jamais de motif médical, jamais de
 * commentaire sur la vie privée. Les écrans le rappellent à la saisie.
 */

// ------------------------------------------------ Communication (module 13)

export type ImportanceNote = 'information' | 'importante' | 'urgente'

export const LIBELLES_IMPORTANCE: Readonly<Record<ImportanceNote, string>> = {
  information: 'Information',
  importante: 'Importante',
  urgente: 'Urgente',
}

export type TypeNote = 'consigne' | 'brief' | 'compte-rendu' | 'note'

export const LIBELLES_NOTE: Readonly<Record<TypeNote, string>> = {
  consigne: 'Consigne',
  brief: 'Brief',
  'compte-rendu': 'Compte rendu de réunion',
  note: 'Note',
}

export interface Note {
  readonly id: string
  readonly date: string
  readonly titre: string
  readonly contenu: string
  readonly importance: ImportanceNote
  readonly type: TypeNote
  /** Rayon concerné, ou null pour tout le service. */
  readonly rayonId: string | null
}

// ---------------------------------------------------- Documents (module 15)

export type CategorieDocument = 'modele' | 'procedure' | 'affichage'

export const LIBELLES_DOCUMENT: Readonly<Record<CategorieDocument, string>> = {
  modele: 'Modèle',
  procedure: 'Procédure',
  affichage: 'Affichage obligatoire',
}

export interface DocumentInterne {
  readonly id: string
  readonly titre: string
  readonly categorie: CategorieDocument
  readonly contenu: string
  readonly misAJourLe: string
  /** Affichage rendu obligatoire par la réglementation. */
  readonly obligatoire: boolean
}

// ------------------------------------------- Suivi individuel (module 11)

export type TypeEntretien = 'annuel' | 'professionnel' | 'bilan-6-ans'

export const LIBELLES_ENTRETIEN: Readonly<Record<TypeEntretien, string>> = {
  annuel: 'Entretien annuel',
  professionnel: 'Entretien professionnel',
  'bilan-6-ans': 'Bilan à six ans',
}

/** Périodicité légale, en mois. L'entretien professionnel est obligatoire. */
export const PERIODICITE_ENTRETIEN: Readonly<Record<TypeEntretien, number>> = {
  annuel: 12,
  professionnel: 24,
  'bilan-6-ans': 72,
}

export interface Entretien {
  readonly id: string
  readonly collaborateurId: string
  readonly type: TypeEntretien
  readonly date: string
  readonly realise: boolean
  /**
   * Objectifs de travail convenus. FAITS ET OBJECTIFS uniquement : jamais
   * d'appréciation sur la personne.
   */
  readonly objectifs: string
}

// ----------------------------------------------- Recrutement (module 9)

export interface BesoinRecrutement extends Suivi {
  readonly id: string
  readonly rayonId: string
  readonly poste: string
  readonly contrat: string
  readonly heuresHebdomadaires: number
  /** Pourquoi ce recrutement : remplacement, renfort, saison. */
  readonly motif: string
  readonly dateSouhaitee: string
}

export function besoinRecrutementVide(
  id: string,
  rayonId: string,
  dateSouhaitee: string,
): BesoinRecrutement {
  return {
    id,
    rayonId,
    poste: 'Employé commercial',
    contrat: 'cdd',
    heuresHebdomadaires: 35,
    motif: '',
    dateSouhaitee,
    ...suiviInitial(),
  }
}

export interface EtapeIntegration {
  readonly id: string
  readonly collaborateurId: string
  readonly intitule: string
  readonly faite: boolean
  readonly date: string | null
}

/** Parcours d'intégration proposé par défaut, modifiable. */
export const PARCOURS_INTEGRATION: readonly string[] = [
  'Accueil et visite du magasin',
  'Remise des équipements de protection',
  'Formation hygiène et sécurité',
  'Présentation des rayons et de l’équipe',
  'Prise en main des outils du rayon',
  'Point à une semaine',
  'Point à un mois',
  'Bilan de fin de période d’essai',
]

// ------------------------------------------------- Sécurité (module 12)

export type TypeActionSecurite =
  | 'prevention'
  | 'equipement'
  | 'accident'
  | 'affichage'
  | 'visite-medicale'

export const LIBELLES_SECURITE: Readonly<Record<TypeActionSecurite, string>> = {
  prevention: 'Action de prévention',
  equipement: 'Équipement de protection',
  accident: 'Accident du travail',
  affichage: 'Affichage obligatoire',
  'visite-medicale': 'Visite médicale',
}

export interface ActionSecurite {
  readonly id: string
  readonly type: TypeActionSecurite
  readonly titre: string
  readonly date: string
  /** Personne concernée, ou null si l'action vise tout le service. */
  readonly collaborateurId: string | null
  /** Échéance à tenir, si elle existe. */
  readonly echeance: string | null
  readonly faite: boolean
}

/**
 * Délai de déclaration d'un accident du travail, en jours.
 * L'employeur dispose de 48 heures ouvrables.
 */
export const DELAI_DECLARATION_ACCIDENT_JOURS = 2
