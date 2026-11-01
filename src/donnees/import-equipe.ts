import type {
  Collaborateur,
  NiveauCompetence,
  PosteDuMatin,
  TrancheAge,
} from '../domaine/collaborateur'
import type { Fonction, OrganisationPlanning } from '../domaine/organisation'
import { etatInitial, type EtatApplication } from './etat'
import {
  COMPETENCE,
  COMPETENCES_LA_VAUGINE,
  CONFIGURATIONS_LA_VAUGINE,
  MAGASIN_LA_VAUGINE,
  ORGANISATION_LA_VAUGINE,
  RAYON,
  RAYONS_LA_VAUGINE,
} from './modele-la-vaugine'

/**
 * Construction des donnees REELLES a importer dans l'application.
 *
 * Ce module ne contient AUCUN nom : il transforme une liste saisie a part
 * (jamais versee dans le depot public) en un etat complet, pret a etre
 * restaure par « Restaurer une sauvegarde ». Les tests n'utilisent que des
 * prenoms fictifs.
 */

export type StatutSaisi = 'employe' | 'manager' | 'apprenti' | 'interim' | 'cadre-forfait'

export interface SaisieCollaborateur {
  readonly prenom: string
  /** Initiale du nom, si elle est connue (« C. »). */
  readonly initiale?: string
  readonly statut: StatutSaisi
  readonly trancheAge?: TrancheAge
  /** Heures du contrat. Ignorees pour un cadre au forfait. */
  readonly heures?: number
  /** Rayons ou la personne est titulaire, le principal en premier. */
  readonly principaux: readonly string[]
  /** Rayons tenus en renfort. */
  readonly secondaires?: readonly string[]
  /** Rayons tenus en depannage uniquement. */
  readonly depannage?: readonly string[]
  readonly fonctions?: readonly Fonction[]
  readonly posteDuMatin?: PosteDuMatin
  /** Taches confiees nommement (identifiants de TACHE). */
  readonly taches?: readonly string[]
  /** Rotations auxquelles la personne participe. */
  readonly rotations?: readonly string[]
}

/** Competence attachee a chaque rayon du modele. */
const COMPETENCE_DU_RAYON: Readonly<Record<string, string>> = {
  [RAYON.fruitsLegumes]: COMPETENCE.fruitsLegumes,
  [RAYON.maree]: COMPETENCE.maree,
  [RAYON.charcuterieFromage]: COMPETENCE.charcuterieFromage,
  [RAYON.boucherieTrad]: COMPETENCE.boucherieTrad,
  [RAYON.boucherieLs]: COMPETENCE.boucherieLs,
  [RAYON.fraicheDecoupe]: COMPETENCE.fraicheDecoupe,
  [RAYON.cuisineMobile]: COMPETENCE.cuisineMobile,
  [RAYON.preparationTraiteur]: COMPETENCE.preparationTraiteur,
}

const RAYONS_BOUCHERIE: readonly string[] = [RAYON.boucherieTrad, RAYON.boucherieLs]

/** Identifiant stable, sans accent : « Jean Luc », « C. » -> « jean-luc-c ». */
export function identifiantDe(prenom: string, initiale = ''): string {
  return `${prenom} ${initiale}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function initialeNormalisee(initiale: string | undefined): string {
  const lettre = (initiale ?? '').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 1).toUpperCase()
  return lettre === '' ? '' : `${lettre}.`
}

export function versCollaborateur(saisie: SaisieCollaborateur): Collaborateur {
  const [principal, ...autresPrincipaux] = saisie.principaux
  if (principal === undefined) {
    throw new Error(`${saisie.prenom} : au moins un rayon principal est nécessaire.`)
  }
  const inconnus = [...saisie.principaux, ...(saisie.secondaires ?? []), ...(saisie.depannage ?? [])]
    .filter((rayonId) => !RAYONS_LA_VAUGINE.some((rayon) => rayon.id === rayonId))
  if (inconnus.length > 0) {
    throw new Error(`${saisie.prenom} : rayon inconnu (${inconnus.join(', ')}).`)
  }

  // Competences : chaque rayon tenu, au niveau « autonome ».
  const competences: Record<string, NiveauCompetence> = {}
  for (const rayonId of [...saisie.principaux, ...(saisie.secondaires ?? []), ...(saisie.depannage ?? [])]) {
    const competence = COMPETENCE_DU_RAYON[rayonId]
    if (competence !== undefined) competences[competence] = 2
  }
  // Tous les bouchers titulaires ont la rotisserie (D-128).
  if (saisie.principaux.some((rayonId) => RAYONS_BOUCHERIE.includes(rayonId))) {
    competences[COMPETENCE.rotisserie] = 2
  }

  const forfait = saisie.statut === 'cadre-forfait'
  // Un cadre au forfait n'a pas d'heures : 35 h ne sert qu'a garder la fiche
  // coherente, ses heures ne sont jamais comptees (D-129).
  const heures = forfait ? 35 : (saisie.heures ?? 35)
  const initiale = initialeNormalisee(saisie.initiale)

  return {
    id: `c-${identifiantDe(saisie.prenom, initiale)}`,
    prenom: saisie.prenom,
    initiale,
    serviceId: 'frais',
    rayonPrincipal: principal,
    rayonsSecondaires: [...(saisie.secondaires ?? [])],
    poste: '',
    statut:
      saisie.statut === 'cadre-forfait'
        ? 'cadre'
        : saisie.statut === 'manager'
          ? 'agent-maitrise'
          : 'employe',
    niveauClassification: '',
    contrat:
      saisie.statut === 'apprenti' ? 'apprenti' : saisie.statut === 'interim' ? 'interim' : 'cdi',
    heuresHebdomadaires: heures,
    tempsPlein: heures >= 35,
    dateEntree: '',
    finPeriodeEssai: null,
    finContrat: null,
    disponibilites: [],
    competences,
    habilitations: [],
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    trancheAge: saisie.trancheAge ?? 'majeur',
    periodesFormation: [],
    contactAutorise: false,
    actif: true,
    autresRayonsPrincipaux: autresPrincipaux,
    rayonsDepannage: [...(saisie.depannage ?? [])],
    fonctions: [
      ...new Set<Fonction>([
        ...(saisie.statut === 'manager' ? (['manager'] as const) : []),
        ...(saisie.fonctions ?? []),
      ]),
    ],
    forfait,
    posteDuMatin: saisie.posteDuMatin ?? 'non',
    // Jours d'ecole : laisses A DEFINIR pour un apprenti, signales.
    ...(saisie.statut === 'apprenti' ? {} : { joursEcole: [] }),
  }
}

/** Range les personnes dans les taches et rotations qui les nomment. */
function organisationAvec(
  saisies: readonly SaisieCollaborateur[],
  collaborateurs: readonly Collaborateur[],
): OrganisationPlanning {
  const idDe = (index: number) => (collaborateurs[index] as Collaborateur).id
  const designes = (tacheId: string) =>
    saisies.flatMap((saisie, index) => ((saisie.taches ?? []).includes(tacheId) ? [idDe(index)] : []))
  const tournent = (rotationId: string) =>
    saisies.flatMap((saisie, index) =>
      (saisie.rotations ?? []).includes(rotationId) ? [idDe(index)] : [],
    )

  return {
    ...ORGANISATION_LA_VAUGINE,
    taches: ORGANISATION_LA_VAUGINE.taches.map((tache) => {
      const personnes = designes(tache.id)
      return personnes.length === 0 ? tache : { ...tache, personnesDesignees: personnes }
    }),
    rotations: ORGANISATION_LA_VAUGINE.rotations.map((rotation) => {
      const personnes = tournent(rotation.id)
      return personnes.length === 0 ? rotation : { ...rotation, personnes }
    }),
  }
}

/**
 * Etat complet du magasin, avec l'equipe saisie. Aucune donnee fictive n'y
 * est melangee : plannings, absences et vivier partent vides.
 */
export function construireEtatReel(saisies: readonly SaisieCollaborateur[]): EtatApplication {
  const collaborateurs = saisies.map(versCollaborateur)
  const doublons = collaborateurs.filter(
    (collaborateur, index) => collaborateurs.findIndex((c) => c.id === collaborateur.id) !== index,
  )
  if (doublons.length > 0) {
    throw new Error(
      `Deux personnes portent le même nom : ${doublons.map((c) => c.prenom).join(', ')}. ` +
        `Ajoutez l’initiale du nom pour les distinguer.`,
    )
  }

  return {
    ...etatInitial(),
    magasin: MAGASIN_LA_VAUGINE,
    configurations: CONFIGURATIONS_LA_VAUGINE,
    competences: COMPETENCES_LA_VAUGINE,
    collaborateurs,
    soldesConges: collaborateurs.map((c) => ({ collaborateurId: c.id, acquis: 0, pris: 0, ajustement: 0 })),
    renforts: [],
    missions: [],
    organisation: organisationAvec(saisies, collaborateurs),
    creditsHeures: {},
    demonstration: false,
  }
}
