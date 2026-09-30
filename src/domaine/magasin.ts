import { estDansIntervalle, jourDeLaSemaine, type JourSemaine } from './calendrier'
import { TRANCHES_PAR_JOUR, enMinutes, indexTranche } from './temps'

/**
 * Description du magasin : services, rayons, horaires, frequentation,
 * horaires types et calendrier des evenements.
 *
 * Module pur. Toute valeur a un defaut modifiable : rien n'est fige.
 */

export interface HorairesJour {
  readonly ouvert: boolean
  readonly ouverture: string
  readonly fermeture: string
}

export type HorairesSemaine = Readonly<Record<JourSemaine, HorairesJour>>

export interface Service {
  readonly id: string
  readonly nom: string
  readonly ordre: number
  readonly actif: boolean
}

export interface Rayon {
  readonly id: string
  readonly serviceId: string
  readonly nom: string
  readonly ordre: number
  readonly actif: boolean
  /** Horaires propres au comptoir du rayon ; null = ceux du magasin. */
  readonly horairesPropres: HorairesSemaine | null
}

export interface Frequentation {
  readonly clientsParJour: Readonly<Record<JourSemaine, number>>
  /** 48 parts, une par tranche de 30 min. Leur somme vaut 100. */
  readonly profilHoraire: readonly number[]
}

export interface HoraireType {
  readonly id: string
  readonly nom: string
  readonly debut: string
  readonly fin: string
  readonly pauseMinutes: number
  /** Heure a laquelle la pause commence : une personne en pause ne couvre rien. */
  readonly pauseDebut: string
}

export interface Evenement {
  readonly id: string
  readonly nom: string
  readonly debut: string
  readonly fin: string
  /** Liste vide = tous les rayons. */
  readonly rayonsConcernes: readonly string[]
  /** Multiplie le volume de travail : 1,3 = trente pour cent de plus. */
  readonly coefficient: number
}

export interface Magasin {
  readonly nom: string
  readonly services: readonly Service[]
  readonly rayons: readonly Rayon[]
  readonly horaires: HorairesSemaine
  readonly frequentation: Frequentation
  readonly horairesTypes: readonly HoraireType[]
  readonly evenements: readonly Evenement[]
  /** Budget d'heures par semaine et par rayon. */
  readonly budgetHeuresParRayon: Readonly<Record<string, number>>
}

/** Rayons actifs d'un service, dans l'ordre d'affichage. */
export function rayonsActifs(magasin: Magasin, serviceId?: string): Rayon[] {
  return magasin.rayons
    .filter((rayon) => rayon.actif && (serviceId === undefined || rayon.serviceId === serviceId))
    .sort((a, b) => a.ordre - b.ordre)
}

export function rayonParId(magasin: Magasin, rayonId: string): Rayon | undefined {
  return magasin.rayons.find((rayon) => rayon.id === rayonId)
}

/** Horaires applicables un jour donne : ceux du rayon s'il en a, sinon ceux du magasin. */
export function horairesDuJour(magasin: Magasin, date: string, rayonId?: string): HorairesJour {
  const jour = jourDeLaSemaine(date)
  if (rayonId !== undefined) {
    const rayon = rayonParId(magasin, rayonId)
    if (rayon?.horairesPropres != null) return rayon.horairesPropres[jour]
  }
  return magasin.horaires[jour]
}

/** Numeros des tranches de 30 min pendant lesquelles le magasin est ouvert. */
export function tranchesOuvertes(magasin: Magasin, date: string, rayonId?: string): Set<number> {
  const horaires = horairesDuJour(magasin, date, rayonId)
  const ouvertes = new Set<number>()
  if (!horaires.ouvert) return ouvertes

  const premiere = indexTranche(enMinutes(horaires.ouverture))
  const derniere = indexTranche(Math.max(enMinutes(horaires.fermeture) - 1, 0))
  for (let index = premiere; index <= derniere; index += 1) ouvertes.add(index)
  return ouvertes
}

/** Nombre de clients attendus ce jour-la. */
export function clientsDuJour(magasin: Magasin, date: string): number {
  return magasin.frequentation.clientsParJour[jourDeLaSemaine(date)]
}

/**
 * Repartition des clients sur les 48 tranches de la journee.
 * Le profil horaire est normalise : meme s'il ne totalise pas exactement 100,
 * la somme des clients par tranche reste egale au total du jour.
 */
export function clientsParTranche(magasin: Magasin, date: string): number[] {
  const total = clientsDuJour(magasin, date)
  const profil = magasin.frequentation.profilHoraire
  const sommeProfil = profil.reduce((somme, part) => somme + part, 0)

  if (sommeProfil <= 0) return new Array<number>(TRANCHES_PAR_JOUR).fill(0)

  return Array.from({ length: TRANCHES_PAR_JOUR }, (_, index) => {
    const part = profil[index] ?? 0
    return (total * part) / sommeProfil
  })
}

/** Evenements du calendrier qui touchent ce rayon ce jour-la. */
export function evenementsDuJour(
  magasin: Magasin,
  date: string,
  rayonId: string,
): Evenement[] {
  return magasin.evenements.filter(
    (evenement) =>
      estDansIntervalle(date, evenement.debut, evenement.fin) &&
      (evenement.rayonsConcernes.length === 0 || evenement.rayonsConcernes.includes(rayonId)),
  )
}

/**
 * Coefficient global des evenements du jour.
 * Plusieurs evenements se cumulent en se multipliant : une fete a 1,4 pendant
 * une semaine de promotion a 1,2 donne 1,68.
 */
export function coefficientEvenements(
  magasin: Magasin,
  date: string,
  rayonId: string,
): number {
  return evenementsDuJour(magasin, date, rayonId).reduce(
    (produit, evenement) => produit * evenement.coefficient,
    1,
  )
}
