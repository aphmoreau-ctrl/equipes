import { TRANCHE_MINUTES, TRANCHES_PAR_JOUR, duree, enMinutes, indexTranche } from '../../domaine/temps'
import { estAutonome, type Collaborateur } from '../../domaine/collaborateur'
import type { BesoinJour } from '../besoin'
import { dureeTravailEffectif, type Vacation } from '../regles'
import { jourEnTexte } from '../../domaine/calendrier'

/**
 * Indicateurs : couverture, sureffectif, equite, heures.
 *
 * Module pur. Les indicateurs sont calcules ici, puis seulement affiches par
 * l'interface ou repris dans les PDF.
 */

export interface CouvertureTranche {
  readonly index: number
  readonly debutMinutes: number
  /** Personnes necessaires (besoin calcule). */
  readonly besoin: number
  /** Personnes effectivement presentes au planning. */
  readonly presents: number
  /** Positif = trop de monde, negatif = il en manque. */
  readonly ecart: number
  readonly competencesRequises: readonly string[]
  readonly competencesManquantes: readonly string[]
  /** Competences manquantes SANS LESQUELLES le poste ne peut pas etre tenu. */
  readonly competencesCritiquesManquantes: readonly string[]
}

export interface CouvertureJour {
  readonly rayonId: string
  readonly date: string
  readonly tranches: readonly CouvertureTranche[]
  /** Part du besoin effectivement couverte, de 0 a 1. */
  readonly tauxCouverture: number
  readonly heuresBesoin: number
  readonly heuresPresence: number
  /** Heures de presence au-dela du besoin. */
  readonly heuresSureffectif: number
  /** Heures de besoin non couvertes. */
  readonly heuresManquantes: number
  readonly trous: readonly CouvertureTranche[]
}

/**
 * Vrai si la vacation couvre la tranche indiquee.
 *
 * Une personne EN PAUSE ne couvre pas le rayon. Une pause qui occupe la moitie
 * de la tranche ou plus la rend non couverte ; en dessous, la personne reste
 * comptee. Ce seuil evite qu'une pause de 20 minutes a cheval sur deux
 * tranches n'en fasse perdre soixante.
 *
 * Une pause dont l'heure n'est pas renseignee est deduite du temps de travail,
 * mais ne creuse pas la couverture : on ne sait pas quand elle tombe.
 */
export function couvreLaTranche(vacation: Vacation, index: number): boolean {
  const debut = enMinutes(vacation.debut)
  const fin = debut + duree(vacation.debut, vacation.fin)
  const debutTranche = index * TRANCHE_MINUTES
  const finTranche = debutTranche + TRANCHE_MINUTES

  if (!(debut < finTranche && fin > debutTranche)) return false

  if (vacation.pauseDebut !== undefined && vacation.pauseMinutes > 0) {
    const pauseDebut = enMinutes(vacation.pauseDebut)
    const pauseFin = pauseDebut + vacation.pauseMinutes
    const enPause = Math.min(finTranche, pauseFin) - Math.max(debutTranche, pauseDebut)
    if (enPause >= TRANCHE_MINUTES / 2) return false
  }

  return true
}

/**
 * Compare le besoin d'un rayon a la presence prevue au planning.
 *
 * Simplification assumee : une personne presente couvre la tranche entiere.
 * Sa pause n'est pas positionnee a la minute pres — elle est deduite du
 * temps de travail, pas de la presence.
 */
export function calculerCouverture(
  besoin: BesoinJour,
  vacations: readonly Vacation[],
  collaborateurs: readonly Collaborateur[],
): CouvertureJour {
  const duJour = vacations.filter(
    (vacation) => vacation.jour === besoin.date && vacation.rayonId === besoin.rayonId,
  )

  const tranches: CouvertureTranche[] = []
  let besoinCumule = 0
  let couvertCumule = 0
  let sureffectif = 0
  let manquant = 0
  let presenceCumulee = 0

  for (let index = 0; index < TRANCHES_PAR_JOUR; index += 1) {
    const trancheBesoin = besoin.tranches[index]
    const attendu = trancheBesoin?.personnes ?? 0
    const presentes = duJour.filter((vacation) => couvreLaTranche(vacation, index))
    const presents = presentes.length

    const requises = trancheBesoin?.competences ?? []
    const manquantes = requises.filter(
      (competence) =>
        !presentes.some((vacation) => {
          const collaborateur = collaborateurs.find((c) => c.id === vacation.collaborateurId)
          return collaborateur !== undefined && estAutonome(collaborateur, competence)
        }),
    )

    besoinCumule += attendu
    couvertCumule += Math.min(presents, attendu)
    sureffectif += Math.max(0, presents - attendu)
    manquant += Math.max(0, attendu - presents)
    presenceCumulee += presents

    const critiques = trancheBesoin?.competencesCritiques ?? []

    tranches.push({
      index,
      debutMinutes: index * TRANCHE_MINUTES,
      besoin: attendu,
      presents,
      ecart: presents - attendu,
      competencesRequises: requises,
      competencesManquantes: manquantes,
      competencesCritiquesManquantes: manquantes.filter((competence) =>
        critiques.includes(competence),
      ),
    })
  }

  const enHeures = (personnesParTranche: number) => (personnesParTranche * TRANCHE_MINUTES) / 60

  return {
    rayonId: besoin.rayonId,
    date: besoin.date,
    tranches,
    tauxCouverture: besoinCumule === 0 ? 1 : couvertCumule / besoinCumule,
    heuresBesoin: enHeures(besoinCumule),
    heuresPresence: enHeures(presenceCumulee),
    heuresSureffectif: enHeures(sureffectif),
    heuresManquantes: enHeures(manquant),
    trous: tranches.filter(
      (tranche) => tranche.ecart < 0 || tranche.competencesManquantes.length > 0,
    ),
  }
}

/** Heures de travail effectif prevues pour une personne. */
export function heuresPrevues(vacations: readonly Vacation[], collaborateurId: string): number {
  return (
    vacations
      .filter((vacation) => vacation.collaborateurId === collaborateurId)
      .reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60
  )
}

export interface EcartAuContrat {
  readonly collaborateurId: string
  readonly heuresPrevues: number
  readonly heuresContrat: number
  /** Positif = au-dela du contrat, negatif = en dessous. */
  readonly ecart: number
}

/** Compare, pour chacun, les heures prevues aux heures du contrat. */
export function ecartsAuContrat(
  vacations: readonly Vacation[],
  collaborateurs: readonly Collaborateur[],
): EcartAuContrat[] {
  return collaborateurs
    .filter((collaborateur) => collaborateur.actif)
    .map((collaborateur) => {
      const prevues = heuresPrevues(vacations, collaborateur.id)
      return {
        collaborateurId: collaborateur.id,
        heuresPrevues: prevues,
        heuresContrat: collaborateur.heuresHebdomadaires,
        ecart: prevues - collaborateur.heuresHebdomadaires,
      }
    })
    .sort((a, b) => a.collaborateurId.localeCompare(b.collaborateurId))
}

export interface IndicateurEquite {
  readonly collaborateurId: string
  readonly samedis: number
  readonly dimanches: number
  readonly fermetures: number
  readonly feries: number
  readonly total: number
}

/**
 * Equite : ecart entre la personne la plus sollicitee et la moins sollicitee,
 * sur les sujetions (samedis, dimanches, fermetures, jours feries).
 */
export function mesurerEquite(collaborateurs: readonly Collaborateur[]): {
  readonly parPersonne: readonly IndicateurEquite[]
  readonly ecartMaximal: number
} {
  const parPersonne = collaborateurs
    .filter((collaborateur) => collaborateur.actif)
    .map((collaborateur) => {
      const compteurs = collaborateur.compteursEquite
      return {
        collaborateurId: collaborateur.id,
        samedis: compteurs.samedisTravailles,
        dimanches: compteurs.dimanchesTravailles,
        fermetures: compteurs.fermetures,
        feries: compteurs.feriesTravailles,
        total:
          compteurs.samedisTravailles +
          compteurs.dimanchesTravailles +
          compteurs.fermetures +
          compteurs.feriesTravailles,
      }
    })
    .sort((a, b) => b.total - a.total)

  const totaux = parPersonne.map((indicateur) => indicateur.total)
  return {
    parPersonne,
    ecartMaximal: totaux.length === 0 ? 0 : Math.max(...totaux) - Math.min(...totaux),
  }
}

/**
 * Explique un trou de couverture en une phrase, comme le demande le §9.4 :
 * « Crèmerie mardi 8h–10h : manque 1 personne ; aucune disponible avec la
 * compétence réception. »
 */
export function expliquerLeTrou(
  trou: CouvertureTranche,
  nomDuRayon: string,
  date: string,
  disponibles: readonly Collaborateur[],
): string {
  const heure = `${String(Math.floor(trou.debutMinutes / 60)).padStart(2, '0')}:${String(
    trou.debutMinutes % 60,
  ).padStart(2, '0')}`

  // Le manque de monde passe avant tout : c'est le fait principal.
  if (trou.ecart < 0) {
    const manque = -trou.ecart
    const phrase =
      `${nomDuRayon}, le ${jourEnTexte(date)} à ${heure} : il manque ${manque} personne${manque > 1 ? 's' : ''}. ` +
      (disponibles.length === 0
        ? 'Personne n’est disponible sur ce créneau.'
        : `${disponibles.length} personne${disponibles.length > 1 ? 's' : ''} disponible${disponibles.length > 1 ? 's' : ''}.`)

    if (trou.competencesManquantes.length === 0) return phrase
    return `${phrase} Compétence à couvrir : « ${trou.competencesManquantes.join(' », « ')} ».`
  }

  // Assez de monde, mais pas la bonne competence.
  const competence = trou.competencesManquantes[0] ?? ''
  const capables = disponibles.filter((collaborateur) => estAutonome(collaborateur, competence))
  return (
    `${nomDuRayon}, le ${jourEnTexte(date)} à ${heure} : personne d’autonome en « ${competence} ». ` +
    (capables.length === 0
      ? 'Aucun collaborateur disponible ne maîtrise ce poste.'
      : `${capables.length} personne${capables.length > 1 ? 's' : ''} pourrai${capables.length > 1 ? 'ent' : 't'} le tenir.`)
  )
}

/** Regroupe les trous consecutifs en plages lisibles. */
export function regrouperLesTrous(trous: readonly CouvertureTranche[]): {
  readonly debutMinutes: number
  readonly finMinutes: number
  readonly manqueMaximal: number
}[] {
  const plages: { debutMinutes: number; finMinutes: number; manqueMaximal: number }[] = []

  for (const trou of trous) {
    const derniere = plages[plages.length - 1]
    if (derniere !== undefined && derniere.finMinutes === trou.debutMinutes) {
      derniere.finMinutes = trou.debutMinutes + TRANCHE_MINUTES
      derniere.manqueMaximal = Math.max(derniere.manqueMaximal, -trou.ecart)
    } else {
      plages.push({
        debutMinutes: trou.debutMinutes,
        finMinutes: trou.debutMinutes + TRANCHE_MINUTES,
        manqueMaximal: Math.max(0, -trou.ecart),
      })
    }
  }

  return plages
}

export { indexTranche }
