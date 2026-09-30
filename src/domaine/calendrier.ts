/**
 * Dates et jours de la semaine.
 *
 * Module pur. Les dates circulent partout sous la forme « AAAA-MM-JJ » :
 * c'est lisible, comparable avec un simple tri alphabetique, et cela evite
 * les surprises de fuseau horaire.
 */

/** 1 = lundi ... 7 = dimanche (norme ISO 8601). */
export type JourSemaine = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const JOURS_SEMAINE: readonly JourSemaine[] = [1, 2, 3, 4, 5, 6, 7]

const NOMS_JOURS: Readonly<Record<JourSemaine, string>> = {
  1: 'lundi',
  2: 'mardi',
  3: 'mercredi',
  4: 'jeudi',
  5: 'vendredi',
  6: 'samedi',
  7: 'dimanche',
}

const NOMS_MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

const FORMAT_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function estDateValide(date: string): boolean {
  const trouve = FORMAT_DATE.exec(date)
  if (trouve === null) return false
  const instant = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(instant.getTime()) && instant.toISOString().slice(0, 10) === date
}

function enInstant(date: string): Date {
  if (!estDateValide(date)) {
    throw new Error(`Date invalide : « ${date} ». Format attendu : AAAA-MM-JJ.`)
  }
  return new Date(`${date}T00:00:00Z`)
}

/** Jour de la semaine, de 1 (lundi) a 7 (dimanche). */
export function jourDeLaSemaine(date: string): JourSemaine {
  const jourAmericain = enInstant(date).getUTCDay() // 0 = dimanche
  return (jourAmericain === 0 ? 7 : jourAmericain) as JourSemaine
}

/** Numero du mois, de 1 a 12. */
export function moisDe(date: string): number {
  return enInstant(date).getUTCMonth() + 1
}

export function nomDuJour(jour: JourSemaine): string {
  return NOMS_JOURS[jour]
}

export function nomDuMois(mois: number): string {
  const nom = NOMS_MOIS[mois - 1]
  if (nom === undefined) throw new Error(`Mois invalide : ${mois}. Attendu : 1 à 12.`)
  return nom
}

/** « 2026-11-02 » devient « lundi 2 novembre 2026 ». */
export function dateEnTexte(date: string): string {
  const instant = enInstant(date)
  return `${nomDuJour(jourDeLaSemaine(date))} ${instant.getUTCDate()} ${nomDuMois(
    moisDe(date),
  )} ${instant.getUTCFullYear()}`
}

/** Ajoute (ou retire, si le nombre est negatif) des jours a une date. */
export function ajouterJours(date: string, nombre: number): string {
  const instant = enInstant(date)
  instant.setUTCDate(instant.getUTCDate() + nombre)
  return instant.toISOString().slice(0, 10)
}

/** Le lundi de la semaine contenant cette date. */
export function lundiDeLaSemaine(date: string): string {
  return ajouterJours(date, 1 - jourDeLaSemaine(date))
}

/** Les sept dates de la semaine contenant cette date, du lundi au dimanche. */
export function semaineDe(date: string): string[] {
  const lundi = lundiDeLaSemaine(date)
  return [0, 1, 2, 3, 4, 5, 6].map((decalage) => ajouterJours(lundi, decalage))
}

/** Vrai si la premiere date est strictement anterieure a la seconde. */
export function estAvant(date: string, autre: string): boolean {
  return enInstant(date).getTime() < enInstant(autre).getTime()
}

/** Vrai si la date est comprise dans l'intervalle, bornes incluses. */
export function estDansIntervalle(date: string, debut: string, fin: string): boolean {
  const instant = enInstant(date).getTime()
  return instant >= enInstant(debut).getTime() && instant <= enInstant(fin).getTime()
}

/** Date du jour, au format « AAAA-MM-JJ », dans le fuseau de l'appareil. */
export function aujourdhui(): string {
  const maintenant = new Date()
  const annee = maintenant.getFullYear()
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  const jour = String(maintenant.getDate()).padStart(2, '0')
  return `${annee}-${mois}-${jour}`
}
