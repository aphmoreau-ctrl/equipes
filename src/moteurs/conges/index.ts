import {
  dansLaPeriodeLegale,
  datesDe,
  demandesQuiSeChevauchent,
  estAccordee,
  joursOuvrables,
  soldeDisponible,
  type DemandeConge,
  type ParametresConges,
  type SoldeConges,
} from '../../domaine/conge'
import { nomAffiche, type Collaborateur } from '../../domaine/collaborateur'
import { dateEnTexte } from '../../domaine/calendrier'

/**
 * Controles des demandes de conges (cahier des charges §12).
 *
 * Module pur. Aucune demande n'est refusee automatiquement : l'application
 * signale, Arnaud decide, le patron valide hors application.
 *
 * RGPD : l'ordre des departs legal tient compte de la situation de famille.
 * Cette donnee est INTERDITE dans l'application : l'ordre propose ici ne
 * repose donc que sur l'anciennete et la date de la demande. C'est un
 * classement indicatif, pas une decision.
 */

export type GraviteConstat = 'bloquant' | 'attention' | 'information'

export interface ConstatConge {
  readonly demandeId: string
  readonly gravite: GraviteConstat
  readonly libelle: string
  readonly explication: string
}

/** Jours de conge deja accordes a une personne. */
export function joursAccordes(
  demandes: readonly DemandeConge[],
  collaborateurId: string,
): number {
  return demandes
    .filter((demande) => demande.collaborateurId === collaborateurId && estAccordee(demande))
    .reduce((somme, demande) => somme + joursOuvrables(demande.debut, demande.fin), 0)
}

/**
 * Jours de fractionnement dus.
 * Quand une partie du conge est prise HORS periode legale, le salarie gagne
 * des jours : 2 jours des 6 jours hors periode, 1 jour pour 3 a 5.
 */
export function joursDeFractionnement(
  demandes: readonly DemandeConge[],
  collaborateurId: string,
  parametres: ParametresConges,
): number {
  const horsPeriode = demandes
    .filter(
      (demande) =>
        demande.collaborateurId === collaborateurId &&
        estAccordee(demande) &&
        demande.type === 'conge-paye',
    )
    .flatMap((demande) => datesDe(demande.debut, demande.fin))
    .filter((date) => !dansLaPeriodeLegale(date, parametres)).length

  if (horsPeriode >= 6) return 2
  if (horsPeriode >= 3) return 1
  return 0
}

/** Passe une demande au crible : tout ce qu'il faut savoir avant de la soumettre. */
export function controlerLaDemande(
  demande: DemandeConge,
  collaborateur: Collaborateur,
  autresDemandes: readonly DemandeConge[],
  soldes: readonly SoldeConges[],
  collaborateurs: readonly Collaborateur[],
  parametres: ParametresConges,
): ConstatConge[] {
  const constats: ConstatConge[] = []

  if (demande.fin < demande.debut) {
    return [
      {
        demandeId: demande.id,
        gravite: 'bloquant',
        libelle: 'Dates incohérentes',
        explication: 'La date de fin précède la date de début.',
      },
    ]
  }

  const jours = joursOuvrables(demande.debut, demande.fin)

  if (demande.type === 'conge-paye') {
    const solde = soldes.find((candidat) => candidat.collaborateurId === collaborateur.id)
    const disponible = solde === undefined ? 0 : soldeDisponible(solde)
    const restant = disponible - joursAccordes(autresDemandes, collaborateur.id)

    if (jours > restant) {
      constats.push({
        demandeId: demande.id,
        gravite: 'bloquant',
        libelle: `Solde insuffisant : ${jours} jours demandés, ${Math.max(0, restant)} disponibles`,
        explication:
          `${nomAffiche(collaborateur)} dispose de ${Math.max(0, restant)} jours ouvrables ` +
          `après les congés déjà accordés. La demande en réclame ${jours}.`,
      })
    }
  }

  if (jours > parametres.congeMaximumJours) {
    constats.push({
      demandeId: demande.id,
      gravite: 'attention',
      libelle: `Congé de ${jours} jours d’un seul tenant`,
      explication:
        `Le congé principal ne peut excéder ${parametres.congeMaximumJours} jours ouvrables ` +
        `consécutifs. Il faut le fractionner.`,
    })
  }

  if (demande.type === 'conge-paye' && jours >= parametres.congePrincipalMinimumJours) {
    const horsPeriode = datesDe(demande.debut, demande.fin).filter(
      (date) => !dansLaPeriodeLegale(date, parametres),
    ).length
    if (horsPeriode > 0) {
      constats.push({
        demandeId: demande.id,
        gravite: 'information',
        libelle: `${horsPeriode} jours hors période légale`,
        explication:
          'La période légale de prise du congé principal va du 1er mai au 31 octobre. ' +
          'Prendre des jours en dehors ouvre droit à des jours de fractionnement.',
      })
    }
  }

  const enMemeTemps = demandesQuiSeChevauchent(demande, autresDemandes).filter((autre) => {
    if (!estAccordee(autre)) return false
    const collegue = collaborateurs.find((candidat) => candidat.id === autre.collaborateurId)
    return collegue !== undefined && collegue.rayonPrincipal === collaborateur.rayonPrincipal
  })

  if (enMemeTemps.length >= parametres.absentsMaximumParRayon) {
    const noms = enMemeTemps
      .map((autre) => collaborateurs.find((c) => c.id === autre.collaborateurId))
      .filter((c): c is Collaborateur => c !== undefined)
      .map(nomAffiche)
    constats.push({
      demandeId: demande.id,
      gravite: 'attention',
      libelle: `${enMemeTemps.length + 1} personnes absentes en même temps dans le rayon`,
      explication:
        `${noms.join(', ')} ${noms.length > 1 ? 'sont déjà absents' : 'est déjà absent'} ` +
        'sur tout ou partie de cette période. Le rayon risque d’être découvert.',
    })
  }

  return constats
}

export interface RangDansLOrdreDesDeparts {
  readonly collaborateurId: string
  readonly rang: number
  readonly anciennete: string
  readonly demandeeLe: string
}

/**
 * Ordre des departs, a titre INDICATIF.
 * Criteres : anciennete, puis date de la demande. Le critere legal de la
 * situation de famille est volontairement absent : donnee interdite ici (§3).
 */
export function ordreDesDeparts(
  demandes: readonly DemandeConge[],
  collaborateurs: readonly Collaborateur[],
): RangDansLOrdreDesDeparts[] {
  return demandes
    .map((demande) => ({
      collaborateurId: demande.collaborateurId,
      anciennete:
        collaborateurs.find((candidat) => candidat.id === demande.collaborateurId)?.dateEntree ??
        '9999-12-31',
      demandeeLe: demande.demandeeLe,
    }))
    .sort(
      (a, b) =>
        a.anciennete.localeCompare(b.anciennete) || a.demandeeLe.localeCompare(b.demandeeLe),
    )
    .map((element, index) => ({ ...element, rang: index + 1 }))
}

/** Phrase resumant une demande, pour l'affichage. */
export function resumerLaDemande(
  demande: DemandeConge,
  collaborateur: Collaborateur | undefined,
): string {
  const jours = joursOuvrables(demande.debut, demande.fin)
  return (
    `${collaborateur === undefined ? demande.collaborateurId : nomAffiche(collaborateur)} — ` +
    `du ${dateEnTexte(demande.debut)} au ${dateEnTexte(demande.fin)} ` +
    `(${jours} jour${jours > 1 ? 's' : ''} ouvrable${jours > 1 ? 's' : ''})`
  )
}
