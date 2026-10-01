import { ajouterJours, dateEnTexte, estAvant, estDansIntervalle } from '../../domaine/calendrier'
import {
  DELAI_DECLARATION_ACCIDENT_JOURS,
  LIBELLES_ENTRETIEN,
  PERIODICITE_ENTRETIEN,
  type ActionSecurite,
  type Entretien,
} from '../../domaine/faits'
import {
  estAutonome,
  nomAffiche,
  type Collaborateur,
} from '../../domaine/collaborateur'

/**
 * Alertes et echeances (cahier des charges §15, « Alertes et rappels »).
 *
 * Module pur. Il ne fait que constater des faits datés : rien de medical,
 * rien de personnel, aucune appreciation.
 */

export type GraviteAlerte = 'information' | 'attention' | 'urgent'

export type CategorieAlerte =
  | 'periode-essai'
  | 'fin-contrat'
  | 'habilitation'
  | 'competence-unique'
  | 'entretien'
  | 'securite'

export interface Alerte {
  readonly id: string
  readonly categorie: CategorieAlerte
  readonly gravite: GraviteAlerte
  /** Phrase courte, affichable telle quelle. */
  readonly titre: string
  readonly detail: string
  /** Date a laquelle l'echeance tombe, si elle en a une. */
  readonly echeance: string | null
  readonly collaborateurId: string | null
}

export interface ReglagesAlertes {
  /** Jours de preavis avant une fin de periode d'essai. */
  readonly preavisPeriodeEssaiJours: number
  /** Jours de preavis avant une fin de contrat. */
  readonly preavisFinContratJours: number
  /** Jours de preavis avant l'expiration d'une habilitation. */
  readonly preavisHabilitationJours: number
  /** Jours de preavis avant qu'un entretien obligatoire ne soit du. */
  readonly preavisEntretienJours: number
  /** Seuil a partir duquel on considere l'echeance urgente. */
  readonly seuilUrgenceJours: number
}

export const REGLAGES_ALERTES_PAR_DEFAUT: ReglagesAlertes = {
  preavisPeriodeEssaiJours: 21,
  preavisFinContratJours: 45,
  preavisHabilitationJours: 60,
  preavisEntretienJours: 60,
  seuilUrgenceJours: 7,
}

function graviteSelonDelai(jours: number, reglages: ReglagesAlertes): GraviteAlerte {
  if (jours < 0) return 'urgent'
  return jours <= reglages.seuilUrgenceJours ? 'urgent' : 'attention'
}

/** Nombre de jours entre deux dates (negatif si l'echeance est passee). */
export function joursEntre(depuis: string, jusqua: string): number {
  const unJour = 24 * 60 * 60 * 1000
  const depart = new Date(`${depuis}T00:00:00Z`).getTime()
  const arrivee = new Date(`${jusqua}T00:00:00Z`).getTime()
  return Math.round((arrivee - depart) / unJour)
}

function texteDelai(jours: number): string {
  if (jours < 0) return `dépassée depuis ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? 's' : ''}`
  if (jours === 0) return "c'est aujourd'hui"
  return `dans ${jours} jour${jours > 1 ? 's' : ''}`
}

/**
 * Toutes les alertes a la date indiquee.
 * Le resultat est trie : le plus urgent d'abord, puis par echeance.
 */
export function calculerAlertes(
  collaborateurs: readonly Collaborateur[],
  date: string,
  reglages: ReglagesAlertes = REGLAGES_ALERTES_PAR_DEFAUT,
): Alerte[] {
  const alertes: Alerte[] = []
  const actifs = collaborateurs.filter((collaborateur) => collaborateur.actif)

  for (const collaborateur of actifs) {
    const nom = nomAffiche(collaborateur)

    // Fin de periode d'essai
    if (collaborateur.finPeriodeEssai !== null) {
      const jours = joursEntre(date, collaborateur.finPeriodeEssai)
      if (jours <= reglages.preavisPeriodeEssaiJours) {
        alertes.push({
          id: `essai-${collaborateur.id}`,
          categorie: 'periode-essai',
          gravite: graviteSelonDelai(jours, reglages),
          titre: `Fin de période d’essai — ${nom}`,
          detail:
            `La période d’essai se termine le ${dateEnTexte(collaborateur.finPeriodeEssai)} ` +
            `(${texteDelai(jours)}). Une décision doit être prise avant cette date.`,
          echeance: collaborateur.finPeriodeEssai,
          collaborateurId: collaborateur.id,
        })
      }
    }

    // Fin de contrat
    if (collaborateur.finContrat !== null) {
      const jours = joursEntre(date, collaborateur.finContrat)
      if (jours <= reglages.preavisFinContratJours) {
        alertes.push({
          id: `contrat-${collaborateur.id}`,
          categorie: 'fin-contrat',
          gravite: graviteSelonDelai(jours, reglages),
          titre: `Fin de contrat — ${nom}`,
          detail:
            `Le contrat se termine le ${dateEnTexte(collaborateur.finContrat)} ` +
            `(${texteDelai(jours)}). Prévoir le renouvellement ou le remplacement.`,
          echeance: collaborateur.finContrat,
          collaborateurId: collaborateur.id,
        })
      }
    }

    // Habilitations qui expirent
    for (const habilitation of collaborateur.habilitations) {
      if (habilitation.expire === null) continue
      const jours = joursEntre(date, habilitation.expire)
      if (jours <= reglages.preavisHabilitationJours) {
        alertes.push({
          id: `habilitation-${collaborateur.id}-${habilitation.id}`,
          categorie: 'habilitation',
          gravite: graviteSelonDelai(jours, reglages),
          titre: `${habilitation.nom} — ${nom}`,
          detail:
            `L’habilitation expire le ${dateEnTexte(habilitation.expire)} ` +
            `(${texteDelai(jours)}). Prévoir le recyclage.`,
          echeance: habilitation.expire,
          collaborateurId: collaborateur.id,
        })
      }
    }
  }

  // Dependance : une seule personne sait faire quelque chose
  for (const alerte of alertesDeDependance(actifs)) alertes.push(alerte)

  return trierAlertes(alertes)
}

const ORDRE_GRAVITE: Record<GraviteAlerte, number> = { urgent: 0, attention: 1, information: 2 }

/** Le plus urgent d'abord, puis par echeance, puis par identifiant (stable). */
export function trierAlertes(alertes: readonly Alerte[]): Alerte[] {
  return [...alertes].sort(
    (a, b) =>
      ORDRE_GRAVITE[a.gravite] - ORDRE_GRAVITE[b.gravite] ||
      (a.echeance ?? '9999').localeCompare(b.echeance ?? '9999') ||
      a.id.localeCompare(b.id),
  )
}

/**
 * Competences que personne ou une seule personne ne maitrise.
 * C'est l'indicateur de dependance du cahier des charges (§13, module 10).
 */
export function alertesDeDependance(collaborateurs: readonly Collaborateur[]): Alerte[] {
  const competences = new Set<string>()
  for (const collaborateur of collaborateurs) {
    for (const competence of Object.keys(collaborateur.competences)) competences.add(competence)
  }

  const alertes: Alerte[] = []
  for (const competence of [...competences].sort()) {
    const autonomes = collaborateurs.filter((collaborateur) =>
      estAutonome(collaborateur, competence),
    )

    if (autonomes.length === 0) {
      alertes.push({
        id: `dependance-${competence}`,
        categorie: 'competence-unique',
        gravite: 'urgent',
        titre: `Personne n’est autonome en « ${competence} »`,
        detail:
          `Aucun collaborateur actif ne tient ce poste seul. ` +
          `Prévoir une formation sans attendre.`,
        echeance: null,
        collaborateurId: null,
      })
    } else if (autonomes.length === 1) {
      const seul = autonomes[0]
      alertes.push({
        id: `dependance-${competence}`,
        categorie: 'competence-unique',
        gravite: 'attention',
        titre: `Une seule personne est autonome en « ${competence} »`,
        detail:
          `${seul === undefined ? '' : nomAffiche(seul)} est seul à tenir ce poste. ` +
          `Une absence laisserait le rayon découvert : prévoir de former quelqu’un.`,
        echeance: null,
        collaborateurId: seul?.id ?? null,
      })
    }
  }
  return alertes
}

/** Alertes dont l'echeance tombe dans les prochains jours. */
export function alertesProchaines(alertes: readonly Alerte[], date: string, jours: number): Alerte[] {
  const limite = ajouterJours(date, jours)
  return alertes.filter(
    (alerte) =>
      alerte.echeance !== null &&
      (estAvant(alerte.echeance, date) || estDansIntervalle(alerte.echeance, date, limite)),
  )
}

/** Compte les alertes par gravite. */
export function resumerAlertes(alertes: readonly Alerte[]): Record<GraviteAlerte, number> {
  const resume: Record<GraviteAlerte, number> = { urgent: 0, attention: 0, information: 0 }
  for (const alerte of alertes) resume[alerte.gravite] += 1
  return resume
}


/**
 * Entretiens obligatoires en retard ou proches (§13, module 11).
 * L'entretien professionnel est obligatoire tous les deux ans, avec un bilan
 * a six ans : les oublier expose l'employeur.
 */
export function alertesDEntretien(
  collaborateurs: readonly Collaborateur[],
  entretiens: readonly Entretien[],
  date: string,
  reglages: ReglagesAlertes = REGLAGES_ALERTES_PAR_DEFAUT,
): Alerte[] {
  const alertes: Alerte[] = []

  for (const collaborateur of collaborateurs.filter((candidat) => candidat.actif)) {
    for (const type of ['professionnel', 'bilan-6-ans'] as const) {
      const realises = entretiens
        .filter(
          (entretien) =>
            entretien.collaborateurId === collaborateur.id &&
            entretien.type === type &&
            entretien.realise,
        )
        .sort((a, b) => b.date.localeCompare(a.date))

      const dernier = realises[0]?.date ?? collaborateur.dateEntree
      const echeance = ajouterJours(dernier, PERIODICITE_ENTRETIEN[type] * 30)
      const jours = joursEntre(date, echeance)
      if (jours > reglages.preavisEntretienJours) continue

      alertes.push({
        id: `entretien-${type}-${collaborateur.id}`,
        categorie: 'entretien',
        gravite: jours < 0 ? 'urgent' : jours <= reglages.seuilUrgenceJours ? 'urgent' : 'attention',
        titre: `${LIBELLES_ENTRETIEN[type]} — ${nomAffiche(collaborateur)}`,
        detail:
          `Dû au plus tard le ${dateEnTexte(echeance)} ` +
          (jours < 0 ? `(dépassé depuis ${Math.abs(jours)} jours).` : `(dans ${jours} jours).`) +
          ` Le dernier remonte au ${dateEnTexte(dernier)}.`,
        echeance,
        collaborateurId: collaborateur.id,
      })
    }
  }

  return alertes
}

/** Echeances de securite : accidents a declarer, visites medicales, affichages. */
export function alertesDeSecurite(
  actions: readonly ActionSecurite[],
  collaborateurs: readonly Collaborateur[],
  date: string,
  reglages: ReglagesAlertes = REGLAGES_ALERTES_PAR_DEFAUT,
): Alerte[] {
  const alertes: Alerte[] = []

  for (const action of actions) {
    if (action.faite) continue

    const collaborateur = collaborateurs.find((candidat) => candidat.id === action.collaborateurId)
    const nom = collaborateur === undefined ? '' : ` — ${nomAffiche(collaborateur)}`

    if (action.type === 'accident') {
      const limite = ajouterJours(action.date, DELAI_DECLARATION_ACCIDENT_JOURS)
      const jours = joursEntre(date, limite)
      alertes.push({
        id: `securite-${action.id}`,
        categorie: 'securite',
        gravite: 'urgent',
        titre: `Accident du travail à déclarer${nom}`,
        detail:
          `Survenu le ${dateEnTexte(action.date)}. La déclaration est due sous ` +
          `${DELAI_DECLARATION_ACCIDENT_JOURS} jours ouvrables, soit avant le ` +
          `${dateEnTexte(limite)}` +
          (jours < 0 ? ` — dépassé depuis ${Math.abs(jours)} jours.` : '.'),
        echeance: limite,
        collaborateurId: action.collaborateurId,
      })
      continue
    }

    if (action.echeance === null) continue
    const jours = joursEntre(date, action.echeance)
    if (jours > reglages.preavisHabilitationJours) continue

    alertes.push({
      id: `securite-${action.id}`,
      categorie: 'securite',
      gravite: jours < 0 ? 'urgent' : jours <= reglages.seuilUrgenceJours ? 'urgent' : 'attention',
      titre: `${action.titre}${nom}`,
      detail:
        `Échéance le ${dateEnTexte(action.echeance)} ` +
        (jours < 0 ? `(dépassée depuis ${Math.abs(jours)} jours).` : `(dans ${jours} jours).`),
      echeance: action.echeance,
      collaborateurId: action.collaborateurId,
    })
  }

  return alertes
}

/** Tout ce qui peut produire une alerte, quel que soit le module d'origine. */
export interface SourcesAlertes {
  readonly collaborateurs: readonly Collaborateur[]
  readonly entretiens: readonly Entretien[]
  readonly actionsSecurite: readonly ActionSecurite[]
}

/**
 * Alertes centralisees (§15, « Alertes et rappels ») : contrats, essais,
 * habilitations, dependance, entretiens obligatoires et securite, reunis en
 * une seule liste triee. C'est elle qu'affichent l'ecran Alertes et la
 * pastille du menu.
 */
export function alertesCentralisees(
  sources: SourcesAlertes,
  date: string,
  reglages: ReglagesAlertes = REGLAGES_ALERTES_PAR_DEFAUT,
): Alerte[] {
  const toutes = [
    ...calculerAlertes(sources.collaborateurs, date, reglages),
    ...alertesDEntretien(sources.collaborateurs, sources.entretiens, date, reglages),
    ...alertesDeSecurite(sources.actionsSecurite, sources.collaborateurs, date, reglages),
  ]
  const vues = new Set<string>()
  const uniques = toutes.filter((alerte) => {
    if (vues.has(alerte.id)) return false
    vues.add(alerte.id)
    return true
  })
  return trierAlertes(uniques)
}
