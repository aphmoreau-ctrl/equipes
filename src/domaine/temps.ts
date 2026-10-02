/**
 * Manipulation des heures et des durees.
 *
 * Module pur : aucune dependance a l'interface, aux donnees ou au reseau.
 * Toute l'application raisonne en MINUTES (nombres entiers), jamais en texte :
 * le texte « 05:30 » n'existe qu'aux bords, a la saisie et a l'affichage.
 */

/** Minutes ecoulees depuis minuit (0 a 1439), ou duree en minutes. */
export type Minutes = number

export const MINUTES_PAR_HEURE = 60
export const MINUTES_PAR_JOUR = 24 * MINUTES_PAR_HEURE

/**
 * Le besoin et la couverture sont calcules par tranches de 15 minutes.
 *
 * Le quart d'heure est la bonne maille pour un service frais : une remise de
 * commande drive dure dix minutes, une fournee sort a 06:45, un comptoir
 * ouvre a 08:30. La demi-heure lissait ces details et faisait apparaitre des
 * besoins la ou il n'y en avait pas — et l'inverse.
 */
export const TRANCHE_MINUTES = 15
export const TRANCHES_PAR_JOUR = MINUTES_PAR_JOUR / TRANCHE_MINUTES

const FORMAT_HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Vrai si le texte est une heure valide au format « HH:MM ». */
export function estHeureValide(heure: string): boolean {
  return FORMAT_HEURE.test(heure)
}

/** « 05:30 » devient 330. Leve une erreur si le format est invalide. */
export function enMinutes(heure: string): Minutes {
  const trouve = FORMAT_HEURE.exec(heure)
  if (trouve === null) {
    throw new Error(`Heure invalide : « ${heure} ». Format attendu : HH:MM, par exemple 05:30.`)
  }
  return Number(trouve[1]) * MINUTES_PAR_HEURE + Number(trouve[2])
}

/** 330 devient « 05:30 ». Attend une heure du jour (0 a 1439). */
export function enTexte(minutes: Minutes): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MINUTES_PAR_JOUR) {
    throw new Error(
      `Heure invalide : ${minutes}. Attendu : un nombre entier de minutes entre 0 et ${MINUTES_PAR_JOUR - 1}.`,
    )
  }
  const heures = Math.floor(minutes / MINUTES_PAR_HEURE)
  const reste = minutes % MINUTES_PAR_HEURE
  return `${String(heures).padStart(2, '0')}:${String(reste).padStart(2, '0')}`
}

/** 450 devient « 7 h 30 », 45 devient « 45 min », 480 devient « 8 h ». */
export function dureeEnTexte(minutes: Minutes): string {
  if (!Number.isInteger(minutes) || minutes < 0) {
    throw new Error(`Duree invalide : ${minutes}. Attendu : un nombre entier de minutes positif.`)
  }
  const heures = Math.floor(minutes / MINUTES_PAR_HEURE)
  const reste = minutes % MINUTES_PAR_HEURE
  if (heures === 0) return `${reste} min`
  if (reste === 0) return `${heures} h`
  return `${heures} h ${String(reste).padStart(2, '0')}`
}

/**
 * Duree entre deux heures du jour, en minutes.
 * Si la fin est anterieure au debut, la vacation est consideree comme passant
 * minuit (poste de nuit) : 22:00 a 05:00 donne 420 minutes.
 */
export function duree(debut: string, fin: string): Minutes {
  const depart = enMinutes(debut)
  const arrivee = enMinutes(fin)
  if (depart === arrivee) {
    throw new Error(
      `Duree impossible a determiner : le debut et la fin sont identiques (${debut}). ` +
        'Precisez une fin differente du debut.',
    )
  }
  return arrivee > depart ? arrivee - depart : arrivee + MINUTES_PAR_JOUR - depart
}

/**
 * Minutes communes a deux intervalles exprimes en minutes absolues.
 * Renvoie 0 si les intervalles ne se touchent pas.
 */
export function chevauchement(debutA: Minutes, finA: Minutes, debutB: Minutes, finB: Minutes): Minutes {
  return Math.max(0, Math.min(finA, finB) - Math.max(debutA, debutB))
}

/** Numero de la tranche de 30 min contenant cette minute (0 a 47 pour un jour). */
export function indexTranche(minutes: Minutes): number {
  return Math.floor(minutes / TRANCHE_MINUTES)
}

/** Premiere minute de la tranche indiquee. */
export function debutDeTranche(index: number): Minutes {
  return index * TRANCHE_MINUTES
}

/**
 * Numeros des tranches de 30 min touchees par un intervalle.
 * Une tranche effleuree est comptee : 08:20 a 08:40 touche la seule tranche 16.
 */
export function tranchesCouvertes(debut: Minutes, fin: Minutes): number[] {
  if (fin <= debut) return []
  const premiere = indexTranche(debut)
  const derniere = indexTranche(fin - 1)
  const tranches: number[] = []
  for (let index = premiere; index <= derniere; index += 1) tranches.push(index)
  return tranches
}
