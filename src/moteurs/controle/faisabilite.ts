import { duree, enMinutes } from '../../domaine/temps'
import { heuresAuContrat } from '../indicateurs'
import type { Infraction, Vacation } from '../regles'
import { controlerLaSemaine, type Constat, type EntreesControleSemaine } from './index'

/**
 * Verification de faisabilite d'une modification a la main.
 *
 * Module pur. Avant d'enregistrer la journee d'une personne (un ou plusieurs
 * postes, dans un ou plusieurs rayons), on controle la semaine AVANT et
 * APRES, avec exactement les memes regles que le controle de la semaine :
 * loi, pauses, horaires du rayon, competences, minimum de chaque rayon,
 * contrat. On ne garde que ce qui touche la personne ou les rayons du jour.
 *
 * - « impossible » : la modification ferait apparaitre un constat bloquant
 *   (illegal) ; elle n'est pas enregistree ;
 * - « a discuter » : elle fait apparaitre une alerte (sous-effectif, ecart au
 *   contrat…) ; on peut l'enregistrer en connaissance de cause ;
 * - « faisable » : rien de nouveau.
 */

/** Un poste tel que saisi dans l'editeur. */
export interface PosteSaisi {
  readonly rayonId: string
  readonly debut: string
  readonly fin: string
  readonly pauseMinutes: number
  readonly pauseDebut?: string
}

export type Verdict = 'faisable' | 'a-discuter' | 'impossible'

export interface ResultatFaisabilite {
  readonly verdict: Verdict
  /** Erreurs de saisie : la journee n'est meme pas lisible. */
  readonly erreursDeSaisie: readonly string[]
  /** Constats que la modification fait apparaitre. */
  readonly nouveaux: readonly Constat[]
  /** Constats deja la, que la modification change (un manque plus ou moins long…). */
  readonly evolues: readonly Constat[]
  /** Constats que la modification fait disparaitre. */
  readonly resolus: readonly Constat[]
  /** Constats deja la, qui restent. */
  readonly restants: readonly Constat[]
  readonly heuresAvant: number
  readonly heuresApres: number
  /** Les postes prets a enregistrer (identifiants compris). */
  readonly vacations: readonly Vacation[]
}

export interface EntreesFaisabilite extends Omit<EntreesControleSemaine, 'infractions'> {
  /** Le verificateur legal, deja regle (parametres, historique, absences). */
  readonly infractionsDe: (vacations: readonly Vacation[]) => readonly Infraction[]
  readonly pausesPayees: boolean
}

/** Heure lue sans exception : NaN si la saisie est vide ou mal formee. */
function lire(heure: string | undefined): number {
  if (heure === undefined || !/^\d{2}:\d{2}$/.test(heure)) return Number.NaN
  return enMinutes(heure)
}

/** Erreurs de saisie d'une journee : horaires, pause, chevauchements. */
export function erreursDeLaJournee(postes: readonly PosteSaisi[]): string[] {
  const erreurs: string[] = []
  const plages: [number, number][] = []
  postes.forEach((poste, rang) => {
    const libelle = postes.length > 1 ? `Poste ${rang + 1} : ` : ''
    const debut = lire(poste.debut)
    const fin = lire(poste.fin)
    if (Number.isNaN(debut) || Number.isNaN(fin)) {
      erreurs.push(`${libelle}heure de début ou de fin manquante.`)
      return
    }
    if (fin <= debut) {
      erreurs.push(`${libelle}la fin (${poste.fin}) doit être après le début (${poste.debut}).`)
      return
    }
    if (poste.pauseMinutes < 0) erreurs.push(`${libelle}pause négative.`)
    if (poste.pauseMinutes >= fin - debut) erreurs.push(`${libelle}la pause dépasse la durée du poste.`)
    if (poste.pauseMinutes > 0 && poste.pauseDebut !== undefined && poste.pauseDebut !== '') {
      const pause = lire(poste.pauseDebut)
      if (Number.isNaN(pause)) {
        erreurs.push(`${libelle}heure de pause illisible.`)
        return
      }
      if (pause < debut || pause + poste.pauseMinutes > fin) {
        erreurs.push(`${libelle}la pause (${poste.pauseDebut}) doit tenir dans le poste.`)
      }
    }
    plages.push([debut, fin])
  })
  const triees = [...plages].sort((a, b) => a[0] - b[0])
  for (let i = 1; i < triees.length; i += 1) {
    if ((triees[i] as [number, number])[0] < (triees[i - 1] as [number, number])[1]) {
      erreurs.push('Deux postes se chevauchent dans la journée.')
      break
    }
  }
  return erreurs
}

export function verifierLaModification(
  entrees: EntreesFaisabilite,
  collaborateurId: string,
  jour: string,
  postes: readonly PosteSaisi[],
): ResultatFaisabilite {
  const avant = entrees.vacations
  const anciens = avant.filter((v) => v.collaborateurId === collaborateurId && v.jour === jour)
  const vacations: Vacation[] = postes.map((poste, rang) => ({
    id: `m-${collaborateurId}-${jour}-${rang}-${poste.rayonId}-${poste.debut}-${poste.fin}`,
    collaborateurId,
    rayonId: poste.rayonId,
    jour,
    debut: poste.debut,
    fin: poste.fin,
    pauseMinutes: poste.pauseMinutes,
    ...(poste.pauseDebut !== undefined && poste.pauseDebut !== '' && poste.pauseMinutes > 0
      ? { pauseDebut: poste.pauseDebut }
      : {}),
  }))
  const heuresAvant = heuresAuContrat(avant, collaborateurId, entrees.pausesPayees)

  const erreursDeSaisie = erreursDeLaJournee(postes)
  if (erreursDeSaisie.length > 0) {
    return {
      verdict: 'impossible',
      erreursDeSaisie,
      nouveaux: [],
      evolues: [],
      resolus: [],
      restants: [],
      heuresAvant,
      heuresApres: heuresAvant,
      vacations,
    }
  }

  const apres = [
    ...avant.filter((v) => !(v.collaborateurId === collaborateurId && v.jour === jour)),
    ...vacations,
  ]
  const controler = (liste: readonly Vacation[]) =>
    controlerLaSemaine({ ...entrees, vacations: liste, infractions: entrees.infractionsDe(liste) })

  // Ce qui touche la personne, ou les rayons qu'elle quitte ou rejoint ce jour-la.
  const rayonsTouches = new Set([...anciens, ...vacations].map((v) => v.rayonId))
  const pertinent = (constat: Constat) =>
    constat.collaborateurId === collaborateurId ||
    (constat.rayonId !== null &&
      rayonsTouches.has(constat.rayonId) &&
      (constat.jour === null || constat.jour === jour))

  const constatsAvant = controler(avant).filter(pertinent)
  const constatsApres = controler(apres).filter(pertinent)
  const empreinte = (c: Constat) => `${c.id}|${c.libelle}`
  const dejaLa = new Set(constatsAvant.map(empreinte))
  const idsAvant = new Set(constatsAvant.map((c) => c.id))
  const idsApres = new Set(constatsApres.map((c) => c.id))
  const nouveaux = constatsApres.filter((c) => !idsAvant.has(c.id) && c.aConfirmer !== true)
  const evolues = constatsApres.filter((c) => idsAvant.has(c.id) && !dejaLa.has(empreinte(c)))
  const restants = constatsApres.filter((c) => dejaLa.has(empreinte(c)))
  const resolus = constatsAvant.filter((c) => !idsApres.has(c.id))

  // Prudence : un constat qui evolue (sans dire dans quel sens) est une alerte.
  const verdict: Verdict = nouveaux.some((c) => c.gravite === 'bloquant')
    ? 'impossible'
    : nouveaux.length + evolues.length > 0
      ? 'a-discuter'
      : 'faisable'

  return {
    verdict,
    erreursDeSaisie,
    nouveaux,
    evolues,
    resolus,
    restants,
    heuresAvant,
    heuresApres: heuresAuContrat(apres, collaborateurId, entrees.pausesPayees),
    vacations,
  }
}

/** Duree d'un poste saisi, pause comprise, en minutes (0 si illisible). */
export function dureeDuPoste(poste: PosteSaisi): number {
  const d = lire(poste.debut)
  const f = lire(poste.fin)
  return Number.isNaN(d) || Number.isNaN(f) || f <= d ? 0 : duree(poste.debut, poste.fin)
}
