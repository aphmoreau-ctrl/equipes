import type { Absence } from '../domaine/absence'
import type { Collaborateur } from '../domaine/collaborateur'
import type { DemandeConge, ParametresConges, SoldeConges } from '../domaine/conge'
import { PARAMETRES_CONGES_PAR_DEFAUT, estAccordee } from '../domaine/conge'
import type { Formation } from '../domaine/formation'
import type {
  ActionSecurite,
  BesoinRecrutement,
  DocumentInterne,
  Entretien,
  EtapeIntegration,
  Note,
} from '../domaine/faits'
import type { Mesure } from '../domaine/mesure'
import type { Mission, Renfort } from '../domaine/vivier'
import type { Magasin } from '../domaine/magasin'
import type { Planning } from '../domaine/planning'
import type { Scenario } from '../moteurs/planning/scenarios'
import { planningVide } from '../domaine/planning'
import type { ReglagesAlertes } from '../moteurs/alertes'
import type { ParametresRegles } from '../moteurs/regles'
import type { ParametresHeures, SaisieHeures } from '../moteurs/heures'
import { PARAMETRES_HEURES_PAR_DEFAUT } from '../moteurs/heures'
import { PARAMETRES_PAR_DEFAUT } from '../moteurs/regles'
import { REGLAGES_ALERTES_PAR_DEFAUT } from '../moteurs/alertes'
import type { ConfigurationRayon, Meteo, SaisieQualite } from '../moteurs/besoin'
import { COLLABORATEURS_DEMO } from './collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from './demo'
import { MISSIONS_DEMO, RENFORTS_DEMO } from './vivier-demo'

/**
 * Etat complet de l'application, conserve sur l'appareil.
 *
 * Jusqu'au lot 4, tout vit dans le stockage du navigateur : aucune
 * synchronisation entre appareils. Firebase prendra le relais, et cette
 * structure servira alors de format d'echange.
 */

/**
 * Un rapport remis au patron. Il ne suit PAS le circuit de validation : un
 * rapport ne se valide pas, il se remet. On en garde la trace pour pouvoir le
 * reimprimer a l'identique, avec un champ de remarques INTERNE.
 */
export interface RapportProduit {
  readonly id: string
  readonly type: 'hebdomadaire' | 'mensuel'
  /** Semaine ou mois couvert. */
  readonly periode: string
  readonly edite: string
  /** Remarques du patron et suites a donner. Visible UNIQUEMENT dans l'app. */
  readonly remarques: string
}

export const VERSION_ETAT = 1

export interface EtatApplication {
  readonly version: number
  readonly magasin: Magasin
  readonly configurations: readonly ConfigurationRayon[]
  readonly collaborateurs: readonly Collaborateur[]
  readonly absences: readonly Absence[]
  readonly demandesConge: readonly DemandeConge[]
  readonly soldesConges: readonly SoldeConges[]
  readonly parametresConges: ParametresConges
  readonly saisiesHeures: readonly SaisieHeures[]
  readonly parametresHeures: ParametresHeures
  /** Mesures du mode chrono (§7.6). */
  readonly mesures: readonly Mesure[]
  readonly formations: readonly Formation[]
  /** Rapports deja remis au patron. Simple liste : pas de circuit de suivi. */
  readonly rapportsProduits: readonly RapportProduit[]
  /** Chiffre d'affaires saisi, par semaine. */
  readonly chiffreAffairesParSemaine: Readonly<Record<string, number>>
  readonly notes: readonly Note[]
  readonly documents: readonly DocumentInterne[]
  readonly entretiens: readonly Entretien[]
  readonly besoinsRecrutement: readonly BesoinRecrutement[]
  readonly etapesIntegration: readonly EtapeIntegration[]
  readonly actionsSecurite: readonly ActionSecurite[]
  /** Vivier de remplacants exterieurs (module 8). */
  readonly renforts: readonly Renfort[]
  /** Historique des missions des renforts exterieurs. */
  readonly missions: readonly Mission[]
  /** Plannings, reperes par le lundi de leur semaine. */
  readonly plannings: Readonly<Record<string, Planning>>
  /** Scenarios conserves pour comparaison, par semaine (§9.4). */
  readonly scenariosParSemaine: Readonly<Record<string, readonly Scenario[]>>
  /** Heures supplementaires deja consommees cette annee, par collaborateur. */
  readonly heuresSupplementairesAnnuelles: Readonly<Record<string, number>>
  readonly reglagesAlertes: ReglagesAlertes
  /** Regles legales et conventionnelles, toutes modifiables. */
  readonly reglesParametres: ParametresRegles
  readonly saisiesQualite: readonly SaisieQualite[]
  /** Meteo constatee, par date. Absente = « normal ». */
  readonly meteoParDate: Readonly<Record<string, Meteo>>
  /** Rayons en promotion, par date. */
  readonly promotionsParDate: Readonly<Record<string, readonly string[]>>
  /** Les donnees affichees sont-elles celles de la demonstration ? */
  readonly demonstration: boolean
}

export function etatInitial(): EtatApplication {
  return {
    version: VERSION_ETAT,
    magasin: MAGASIN_DEMO,
    configurations: CONFIGURATIONS_DEMO,
    collaborateurs: COLLABORATEURS_DEMO,
    absences: [],
    demandesConge: [],
    soldesConges: COLLABORATEURS_DEMO.map((collaborateur) => ({
      collaborateurId: collaborateur.id,
      acquis: 30,
      pris: 0,
      ajustement: 0,
    })),
    parametresConges: PARAMETRES_CONGES_PAR_DEFAUT,
    saisiesHeures: [],
    parametresHeures: PARAMETRES_HEURES_PAR_DEFAUT,
    mesures: [],
    formations: [],
    rapportsProduits: [],
    chiffreAffairesParSemaine: {},
    notes: [],
    documents: [],
    entretiens: [],
    besoinsRecrutement: [],
    etapesIntegration: [],
    actionsSecurite: [],
    renforts: RENFORTS_DEMO,
    missions: MISSIONS_DEMO,
    plannings: {},
    scenariosParSemaine: {},
    heuresSupplementairesAnnuelles: {},
    reglagesAlertes: REGLAGES_ALERTES_PAR_DEFAUT,
    reglesParametres: PARAMETRES_PAR_DEFAUT,
    saisiesQualite: [],
    meteoParDate: {},
    promotionsParDate: {},
    demonstration: true,
  }
}

/**
 * Collections apparues apres la premiere version et pre-remplies en
 * demonstration. Pour des donnees REELLES qui ne les connaissaient pas encore,
 * elles partent VIDES : on ne melange jamais des personnes fictives a la
 * vraie equipe.
 */
const AJOUTS_VIDES: Partial<EtatApplication> = {
  renforts: [],
  missions: [],
}

/** Complete un etat enregistre (ou restaure) avec les champs apparus depuis. */
export function completerEtat(partiel: Partial<EtatApplication>): EtatApplication {
  return {
    ...etatInitial(),
    ...(partiel.demonstration === false ? AJOUTS_VIDES : {}),
    ...partiel,
    version: VERSION_ETAT,
  }
}

const CLE = 'equipes.donnees.v1'

/**
 * Relit l'etat enregistre. En cas de doute (donnee absente, illisible, d'une
 * version inconnue), on repart des donnees de demonstration plutot que de
 * planter : l'application doit toujours s'ouvrir.
 */
export function lireEtat(): EtatApplication {
  try {
    const brut = window.localStorage.getItem(CLE)
    if (brut === null) return etatInitial()
    const valeur: unknown = JSON.parse(brut)
    if (
      typeof valeur !== 'object' ||
      valeur === null ||
      (valeur as EtatApplication).version !== VERSION_ETAT
    ) {
      return etatInitial()
    }
    return completerEtat(valeur as Partial<EtatApplication>)
  } catch {
    return etatInitial()
  }
}

export function enregistrerEtat(etat: EtatApplication): void {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(etat))
  } catch {
    // Stockage indisponible : les modifications ne survivront pas a la fermeture.
  }
}

export function effacerEtat(): void {
  try {
    window.localStorage.removeItem(CLE)
  } catch {
    // Rien a faire.
  }
}

/** Meteo retenue pour une date. */
export function meteoDuJour(etat: EtatApplication, date: string): Meteo {
  return etat.meteoParDate[date] ?? 'normal'
}

/** Vrai si ce rayon est en promotion ce jour-la. */
export function enPromotion(etat: EtatApplication, date: string, rayonId: string): boolean {
  return (etat.promotionsParDate[date] ?? []).includes(rayonId)
}

export function configurationDeRayon(
  etat: EtatApplication,
  rayonId: string,
): ConfigurationRayon | undefined {
  return etat.configurations.find((configuration) => configuration.rayonId === rayonId)
}

/** Saisies de qualite d'un rayon pour une date. */
export function saisiesDuJour(
  etat: EtatApplication,
  date: string,
  rayonId: string,
): SaisieQualite[] {
  return etat.saisiesQualite.filter(
    (saisie) => saisie.date === date && saisie.rayonId === rayonId,
  )
}

/** Planning d'une semaine, cree vide s'il n'existe pas encore. */
export function planningDeLaSemaine(etat: EtatApplication, semaine: string): Planning {
  return etat.plannings[semaine] ?? planningVide(semaine)
}

/** Vacations des semaines precedentes, pour les regles qui regardent l'historique. */
export function vacationsAnterieures(etat: EtatApplication, semaine: string) {
  return Object.values(etat.plannings)
    .filter((planning) => planning.semaine < semaine)
    .flatMap((planning) => planning.vacations)
}

/**
 * Absences REELLEMENT opposables au planning : celles saisies a la main, plus
 * les conges accordes. Un conge non valide ne bloque rien.
 */
export function absencesEffectives(etat: EtatApplication): Absence[] {
  const desConges: Absence[] = etat.demandesConge.filter(estAccordee).map((demande) => ({
    id: `conge-${demande.id}`,
    collaborateurId: demande.collaborateurId,
    debut: demande.debut,
    fin: demande.fin,
    type: demande.type,
    prevue: true,
  }))
  return [...etat.absences, ...desConges]
}

/** Toutes les vacations connues, tous plannings confondus. */
export function toutesLesVacations(etat: EtatApplication) {
  return Object.values(etat.plannings).flatMap((planning) => planning.vacations)
}
