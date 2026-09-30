import type { TypeAbsence } from './absence'
import { ajouterJours, estDansIntervalle, jourDeLaSemaine, moisDe } from './calendrier'
import { suiviInitial, type Suivi } from './suivi'

/**
 * Conges et absences (cahier des charges §12).
 *
 * Une demande suit le meme circuit que les plannings : Brouillon, Soumis,
 * Valide, A corriger, Publie. La validation reste celle du patron, HORS
 * application.
 *
 * RGPD : type et dates uniquement. Aucun motif, aucune situation personnelle.
 */

export interface DemandeConge extends Suivi {
  readonly id: string
  readonly collaborateurId: string
  readonly debut: string
  readonly fin: string
  readonly type: TypeAbsence
  /** Date a laquelle la demande a ete formulee : sert a l'ordre des departs. */
  readonly demandeeLe: string
}

export function demandeVide(
  id: string,
  collaborateurId: string,
  debut: string,
  fin: string,
  demandeeLe: string,
  type: TypeAbsence = 'conge-paye',
): DemandeConge {
  return { id, collaborateurId, debut, fin, type, demandeeLe, ...suiviInitial() }
}

/** Une demande est acquise des qu'elle est validee ou publiee. */
export function estAccordee(demande: DemandeConge): boolean {
  return demande.etat === 'valide' || demande.etat === 'publie'
}

export interface SoldeConges {
  readonly collaborateurId: string
  /** Jours acquis sur la periode de reference. */
  readonly acquis: number
  /** Jours deja pris. */
  readonly pris: number
  /** Recalage manuel sur le bulletin de paie : le bulletin fait foi. */
  readonly ajustement: number
}

export function soldeDisponible(solde: SoldeConges): number {
  return solde.acquis + solde.ajustement - solde.pris
}

/**
 * Jours OUVRABLES d'un intervalle, bornes comprises.
 * Le dimanche n'est pas ouvrable ; le samedi l'est. C'est la regle de decompte
 * la plus courante pour les conges payes.
 */
export function joursOuvrables(debut: string, fin: string): number {
  let compte = 0
  let jour = debut
  while (jour <= fin) {
    if (jourDeLaSemaine(jour) !== 7) compte += 1
    jour = ajouterJours(jour, 1)
  }
  return compte
}

/** Toutes les dates d'un intervalle, bornes comprises. */
export function datesDe(debut: string, fin: string): string[] {
  const dates: string[] = []
  let jour = debut
  while (jour <= fin) {
    dates.push(jour)
    jour = ajouterJours(jour, 1)
  }
  return dates
}

export interface ParametresConges {
  /** Debut de la periode legale de prise du conge principal, « MM-JJ ». */
  readonly periodeLegaleDebut: string
  readonly periodeLegaleFin: string
  /** Duree minimale du conge principal, en jours ouvrables. */
  readonly congePrincipalMinimumJours: number
  /** Duree maximale d'un conge d'un seul tenant. */
  readonly congeMaximumJours: number
  /** Nombre de personnes pouvant etre absentes en meme temps dans un rayon. */
  readonly absentsMaximumParRayon: number
}

export const PARAMETRES_CONGES_PAR_DEFAUT: ParametresConges = {
  // Periode legale de prise du conge principal : 1er mai au 31 octobre.
  periodeLegaleDebut: '05-01',
  periodeLegaleFin: '10-31',
  // Le conge principal ne peut etre inferieur a 12 jours ouvrables continus...
  congePrincipalMinimumJours: 12,
  // ... ni superieur a 24 jours ouvrables.
  congeMaximumJours: 24,
  absentsMaximumParRayon: 1,
}

/** Vrai si la date tombe dans la periode legale de prise du conge principal. */
export function dansLaPeriodeLegale(date: string, parametres: ParametresConges): boolean {
  const mois = moisDe(date)
  const jour = Number(date.slice(8))
  const [moisDebut, jourDebut] = parametres.periodeLegaleDebut.split('-').map(Number)
  const [moisFin, jourFin] = parametres.periodeLegaleFin.split('-').map(Number)

  const apresLeDebut = mois > (moisDebut ?? 5) || (mois === moisDebut && jour >= (jourDebut ?? 1))
  const avantLaFin = mois < (moisFin ?? 10) || (mois === moisFin && jour <= (jourFin ?? 31))
  return apresLeDebut && avantLaFin
}

/** Vrai si la personne est en conge accorde ce jour-la. */
export function enCongeAccorde(
  demandes: readonly DemandeConge[],
  collaborateurId: string,
  date: string,
): boolean {
  return demandes.some(
    (demande) =>
      demande.collaborateurId === collaborateurId &&
      estAccordee(demande) &&
      estDansIntervalle(date, demande.debut, demande.fin),
  )
}

/** Demandes qui se chevauchent avec celle-ci, pour une meme date. */
export function demandesQuiSeChevauchent(
  demande: DemandeConge,
  autres: readonly DemandeConge[],
): DemandeConge[] {
  return autres.filter(
    (autre) =>
      autre.id !== demande.id &&
      autre.collaborateurId !== demande.collaborateurId &&
      autre.debut <= demande.fin &&
      autre.fin >= demande.debut,
  )
}
