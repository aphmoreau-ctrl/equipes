import type { JourSemaine } from '../domaine/calendrier'
import type {
  Collaborateur,
  Disponibilite,
  Habilitation,
  NiveauCompetence,
  PeriodeFormation,
  StatutCollaborateur,
  TrancheAge,
  TypeContrat,
} from '../domaine/collaborateur'

/**
 * COLLABORATEURS DE DEMONSTRATION - ENTIEREMENT FICTIFS.
 *
 * Aucune personne reelle. Les prenoms sont courants et les initiales tirees
 * au hasard : ils ne designent personne.
 *
 * RGPD : prenom + initiale uniquement, faits datés, aucune appreciation.
 */

function indisponible(jours: readonly JourSemaine[]): Disponibilite[] {
  return jours.map((jour) => ({ jour, disponible: false, plage: null }))
}

function matinsSeulement(jours: readonly JourSemaine[]): Disponibilite[] {
  return jours.map((jour) => ({
    jour,
    disponible: true,
    plage: { debut: '05:00', fin: '14:00' },
  }))
}

function habilitation(
  id: string,
  nom: string,
  obtenue: string,
  expire: string | null,
): Habilitation {
  return { id, nom, obtenue, expire }
}

interface Raccourci {
  readonly id: string
  readonly prenom: string
  readonly initiale: string
  readonly rayonPrincipal: string
  readonly rayonsSecondaires?: readonly string[]
  readonly poste: string
  readonly statut?: StatutCollaborateur
  readonly niveauClassification?: string
  readonly contrat?: TypeContrat
  readonly heures?: number
  readonly dateEntree: string
  readonly finPeriodeEssai?: string | null
  readonly finContrat?: string | null
  readonly disponibilites?: readonly Disponibilite[]
  readonly competences: Readonly<Record<string, NiveauCompetence>>
  readonly habilitations?: readonly Habilitation[]
  readonly equite?: Partial<Collaborateur['compteursEquite']>
  readonly periodesFormation?: readonly PeriodeFormation[]
  readonly trancheAge?: TrancheAge
  readonly contactAutorise?: boolean
}

function collaborateur(raccourci: Raccourci): Collaborateur {
  const heures = raccourci.heures ?? 35
  return {
    id: raccourci.id,
    prenom: raccourci.prenom,
    initiale: raccourci.initiale,
    serviceId: 'frais',
    rayonPrincipal: raccourci.rayonPrincipal,
    rayonsSecondaires: raccourci.rayonsSecondaires ?? [],
    poste: raccourci.poste,
    statut: raccourci.statut ?? 'employe',
    niveauClassification: raccourci.niveauClassification ?? 'Niveau 2',
    contrat: raccourci.contrat ?? 'cdi',
    heuresHebdomadaires: heures,
    tempsPlein: heures >= 35,
    dateEntree: raccourci.dateEntree,
    finPeriodeEssai: raccourci.finPeriodeEssai ?? null,
    finContrat: raccourci.finContrat ?? null,
    disponibilites: raccourci.disponibilites ?? [],
    competences: raccourci.competences,
    habilitations: raccourci.habilitations ?? [],
    compteursEquite: {
      samedisTravailles: 0,
      dimanchesTravailles: 0,
      fermetures: 0,
      feriesTravailles: 0,
      ...raccourci.equite,
    },
    periodesFormation: raccourci.periodesFormation ?? [],
    trancheAge: raccourci.trancheAge ?? 'majeur',
    contactAutorise: raccourci.contactAutorise ?? false,
    actif: true,
  }
}

const HYGIENE_2028 = habilitation('hygiene', 'Formation hygiène HACCP', '2025-03-10', '2028-03-10')
const HYGIENE_BIENTOT = habilitation('hygiene', 'Formation hygiène HACCP', '2023-11-20', '2026-11-20')
const TRANSPALETTE = habilitation('transpalette', 'Transpalette électrique', '2024-06-05', '2029-06-05')

export const COLLABORATEURS_DEMO: readonly Collaborateur[] = [
  // ------------------------------------------------- Fruits et légumes
  collaborateur({
    id: 'c-01', prenom: 'Camille', initiale: 'D.', rayonPrincipal: 'fruits-legumes',
    rayonsSecondaires: ['cremerie'], poste: 'Adjoint du rayon',
    statut: 'agent-maitrise', niveauClassification: 'Niveau 4', dateEntree: '2019-04-15',
    competences: { 'réception': 3, 'mise en place': 3, 'commandes': 3, 'hygiène': 2, 'découpe': 2 },
    habilitations: [HYGIENE_2028, TRANSPALETTE],
    equite: { samedisTravailles: 18, dimanchesTravailles: 4, fermetures: 12 },
    contactAutorise: true,
  }),
  collaborateur({
    id: 'c-02', prenom: 'Mathieu', initiale: 'R.', rayonPrincipal: 'fruits-legumes',
    poste: 'Employé commercial', dateEntree: '2021-09-01',
    competences: { 'réception': 2, 'mise en place': 3, 'hygiène': 2, 'découpe': 2 },
    habilitations: [HYGIENE_2028],
    equite: { samedisTravailles: 21, dimanchesTravailles: 6, fermetures: 9 },
  }),
  collaborateur({
    id: 'c-03', prenom: 'Sofia', initiale: 'B.', rayonPrincipal: 'fruits-legumes',
    poste: 'Employée commerciale', heures: 30, dateEntree: '2023-02-13',
    disponibilites: indisponible([3]),
    competences: { 'mise en place': 2, 'hygiène': 1 },
    equite: { samedisTravailles: 16, dimanchesTravailles: 2, fermetures: 14 },
  }),
  collaborateur({
    id: 'c-04', prenom: 'Lucas', initiale: 'P.', rayonPrincipal: 'fruits-legumes',
    rayonsSecondaires: ['boulangerie'], poste: 'Employé commercial', contrat: 'etudiant',
    heures: 12, dateEntree: '2025-09-06',
    disponibilites: [...indisponible([1, 2, 3, 4]), ...matinsSeulement([6, 7])],
    competences: { 'mise en place': 2 },
    equite: { samedisTravailles: 24, dimanchesTravailles: 12 },
  }),
  collaborateur({
    id: 'c-05', prenom: 'Inès', initiale: 'K.', rayonPrincipal: 'fruits-legumes',
    poste: 'Employée commerciale', contrat: 'cdd', heures: 35,
    dateEntree: '2026-09-14', finPeriodeEssai: '2026-10-14', finContrat: '2026-11-30',
    competences: { 'mise en place': 1, 'réception': 1 },
  }),

  // ------------------------------------------------------- Boucherie
  collaborateur({
    id: 'c-06', prenom: 'Thierry', initiale: 'M.', rayonPrincipal: 'boucherie',
    poste: 'Chef boucher', statut: 'agent-maitrise', niveauClassification: 'Niveau 5',
    dateEntree: '2012-01-09',
    competences: { 'boucherie': 3, 'hygiène': 3, 'commandes': 3 },
    habilitations: [HYGIENE_2028],
    equite: { samedisTravailles: 20, dimanchesTravailles: 8, fermetures: 6 },
    contactAutorise: true,
  }),
  collaborateur({
    id: 'c-07', prenom: 'Élodie', initiale: 'V.', rayonPrincipal: 'boucherie',
    poste: 'Bouchère', dateEntree: '2018-06-25',
    competences: { 'boucherie': 3, 'hygiène': 2 },
    habilitations: [HYGIENE_BIENTOT],
    equite: { samedisTravailles: 19, dimanchesTravailles: 7, fermetures: 11 },
  }),
  collaborateur({
    id: 'c-08', prenom: 'Karim', initiale: 'A.', rayonPrincipal: 'boucherie',
    rayonsSecondaires: ['charcuterie-traiteur'], poste: 'Employé libre-service',
    dateEntree: '2022-03-07',
    competences: { 'boucherie': 1, 'hygiène': 2, 'charcuterie': 2 },
    habilitations: [HYGIENE_2028],
    equite: { samedisTravailles: 22, dimanchesTravailles: 5, fermetures: 13 },
  }),
  collaborateur({
    id: 'c-09', prenom: 'Noé', initiale: 'F.', rayonPrincipal: 'boucherie',
    poste: 'Apprenti boucher', contrat: 'apprenti', heures: 35, dateEntree: '2025-09-01',
    trancheAge: '16-17',
    // Une semaine de cours par mois : le magasin ne peut pas le planifier.
    periodesFormation: [
      { id: 'f-01', debut: '2026-10-05', fin: '2026-10-09', intitule: 'CFA' },
      { id: 'f-02', debut: '2026-11-02', fin: '2026-11-06', intitule: 'CFA' },
      { id: 'f-03', debut: '2026-12-07', fin: '2026-12-11', intitule: 'CFA' },
    ],
    competences: { 'boucherie': 1, 'hygiène': 1 },
    equite: { samedisTravailles: 15, dimanchesTravailles: 3 },
  }),

  // ----------------------------------------------------------- Marée
  collaborateur({
    id: 'c-10', prenom: 'Yann', initiale: 'L.', rayonPrincipal: 'maree',
    rayonsSecondaires: ['fruits-legumes'], poste: 'Responsable marée',
    niveauClassification: 'Niveau 4', dateEntree: '2016-11-02',
    competences: { 'marée': 3, 'hygiène': 2, 'commandes': 2 },
    habilitations: [HYGIENE_2028],
    equite: { samedisTravailles: 23, dimanchesTravailles: 10, fermetures: 8 },
    contactAutorise: true,
  }),
  collaborateur({
    id: 'c-11', prenom: 'Aurélie', initiale: 'G.', rayonPrincipal: 'maree',
    rayonsSecondaires: ['charcuterie-traiteur'], poste: 'Employée commerciale',
    heures: 28, dateEntree: '2024-05-06',
    disponibilites: matinsSeulement([1, 2, 3, 4, 5]),
    competences: { 'marée': 1, 'hygiène': 2, 'charcuterie': 1 },
    equite: { samedisTravailles: 17, dimanchesTravailles: 6 },
  }),

  // ------------------------------------------- Crèmerie / LS frais
  collaborateur({
    id: 'c-12', prenom: 'Julien', initiale: 'S.', rayonPrincipal: 'cremerie',
    rayonsSecondaires: ['fruits-legumes'], poste: 'Employé commercial',
    dateEntree: '2020-08-17',
    competences: { 'mise en place': 3, 'réception': 3 },
    habilitations: [TRANSPALETTE],
    equite: { samedisTravailles: 20, dimanchesTravailles: 5, fermetures: 15 },
  }),
  collaborateur({
    id: 'c-13', prenom: 'Fatou', initiale: 'N.', rayonPrincipal: 'cremerie',
    poste: 'Employée commerciale', heures: 24, dateEntree: '2023-10-02',
    disponibilites: indisponible([6]),
    competences: { 'mise en place': 2, 'réception': 1 },
    equite: { samedisTravailles: 4, dimanchesTravailles: 3, fermetures: 10 },
  }),
  collaborateur({
    id: 'c-14', prenom: 'Bastien', initiale: 'C.', rayonPrincipal: 'cremerie',
    rayonsSecondaires: ['fromage'], poste: 'Employé commercial', dateEntree: '2022-11-21',
    competences: { 'mise en place': 2, 'fromage': 2 },
    equite: { samedisTravailles: 21, dimanchesTravailles: 4, fermetures: 12 },
  }),

  // --------------------------------------- Charcuterie-traiteur
  collaborateur({
    id: 'c-15', prenom: 'Sandrine', initiale: 'T.', rayonPrincipal: 'charcuterie-traiteur',
    rayonsSecondaires: ['fromage'], poste: 'Responsable charcuterie-traiteur',
    niveauClassification: 'Niveau 4', dateEntree: '2017-02-06',
    competences: { 'charcuterie': 3, 'traiteur': 3, 'hygiène': 3, 'fromage': 2 },
    habilitations: [HYGIENE_2028],
    equite: { samedisTravailles: 22, dimanchesTravailles: 9, fermetures: 7 },
    contactAutorise: true,
  }),
  collaborateur({
    id: 'c-16', prenom: 'Pierre', initiale: 'H.', rayonPrincipal: 'charcuterie-traiteur',
    poste: 'Employé traiteur', dateEntree: '2021-04-12',
    competences: { 'charcuterie': 2, 'traiteur': 2, 'hygiène': 2 },
    habilitations: [HYGIENE_BIENTOT],
    equite: { samedisTravailles: 18, dimanchesTravailles: 6, fermetures: 11 },
  }),

  // -------------------------------------------------------- Fromage
  collaborateur({
    id: 'c-17', prenom: 'Margot', initiale: 'E.', rayonPrincipal: 'fromage',
    rayonsSecondaires: ['charcuterie-traiteur'], poste: 'Fromagère',
    dateEntree: '2019-09-30',
    competences: { 'fromage': 3, 'hygiène': 2, 'charcuterie': 2 },
    habilitations: [HYGIENE_2028],
    equite: { samedisTravailles: 20, dimanchesTravailles: 7, fermetures: 10 },
  }),

  // ---------------------------------------------------- Boulangerie
  collaborateur({
    id: 'c-18', prenom: 'Hugo', initiale: 'B.', rayonPrincipal: 'boulangerie',
    poste: 'Employé boulangerie', dateEntree: '2020-01-13',
    competences: { 'boulangerie': 3, 'hygiène': 2 },
    habilitations: [HYGIENE_2028],
    equite: { samedisTravailles: 23, dimanchesTravailles: 11, fermetures: 5 },
  }),
  collaborateur({
    id: 'c-19', prenom: 'Leïla', initiale: 'Z.', rayonPrincipal: 'boulangerie',
    rayonsSecondaires: ['fruits-legumes'], poste: 'Employée boulangerie',
    heures: 30, dateEntree: '2024-02-19',
    competences: { 'boulangerie': 2, 'mise en place': 2 },
    equite: { samedisTravailles: 19, dimanchesTravailles: 8, fermetures: 9 },
  }),
  collaborateur({
    id: 'c-20', prenom: 'Antoine', initiale: 'W.', rayonPrincipal: 'boulangerie',
    poste: 'Employé boulangerie', contrat: 'etudiant', heures: 10,
    dateEntree: '2026-09-07', finPeriodeEssai: '2026-10-07',
    disponibilites: [...indisponible([1, 2, 3, 4, 5]), ...matinsSeulement([6, 7])],
    competences: { 'boulangerie': 1 },
    equite: { samedisTravailles: 3, dimanchesTravailles: 3 },
  }),

  // ------------------------------------------------- Cave / vins et Drive
  collaborateur({
    id: 'c-21', prenom: 'Victor', initiale: 'M.', rayonPrincipal: 'cave-vins',
    rayonsSecondaires: ['cremerie'], poste: 'Caviste',
    niveauClassification: 'Niveau 3', heures: 35, dateEntree: '2021-04-12',
    competences: { 'conseil vins': 3, 'mise en rayon': 2, 'étiquetage': 2, 'réception': 2 },
    equite: { samedisTravailles: 22, dimanchesTravailles: 4, fermetures: 14 },
  }),
  collaborateur({
    id: 'c-22', prenom: 'Sonia', initiale: 'R.', rayonPrincipal: 'cave-vins',
    rayonsSecondaires: ['drive'], poste: 'Employée commerciale',
    heures: 24, dateEntree: '2025-06-02',
    disponibilites: indisponible([3, 7]),
    competences: { 'conseil vins': 2, 'mise en rayon': 2, 'étiquetage': 1 },
    equite: { samedisTravailles: 11, dimanchesTravailles: 0, fermetures: 5 },
  }),
  collaborateur({
    id: 'c-23', prenom: 'Damien', initiale: 'P.', rayonPrincipal: 'drive',
    rayonsSecondaires: ['cremerie', 'fruits-legumes'], poste: 'Responsable drive',
    statut: 'agent-maitrise', niveauClassification: 'Niveau 5',
    heures: 35, dateEntree: '2020-09-14',
    competences: {
      'préparation drive': 3, 'contrôle drive': 3, 'remise drive': 3,
      'contrôle températures': 3, 'nettoyage': 2,
    },
    equite: { samedisTravailles: 25, dimanchesTravailles: 10, fermetures: 18 },
  }),
  collaborateur({
    id: 'c-24', prenom: 'Awa', initiale: 'S.', rayonPrincipal: 'drive',
    poste: 'Préparatrice drive', heures: 35, dateEntree: '2023-03-06',
    competences: {
      'préparation drive': 2, 'contrôle drive': 2, 'remise drive': 2,
      'contrôle températures': 2, 'nettoyage': 2,
    },
    equite: { samedisTravailles: 20, dimanchesTravailles: 7, fermetures: 11 },
  }),
  collaborateur({
    id: 'c-25', prenom: 'Tom', initiale: 'B.', rayonPrincipal: 'drive',
    poste: 'Préparateur drive', contrat: 'apprenti', heures: 28,
    dateEntree: '2026-09-01', finContrat: '2028-08-31',
    periodesFormation: [
      { id: 'f-04', debut: '2026-09-28', fin: '2026-10-02', intitule: 'CFA' },
      { id: 'f-05', debut: '2026-11-16', fin: '2026-11-20', intitule: 'CFA' },
    ],
    competences: { 'préparation drive': 1, 'remise drive': 1, 'nettoyage': 2 },
    equite: { samedisTravailles: 2, dimanchesTravailles: 0 },
  }),
  collaborateur({
    id: 'c-26', prenom: 'Clara', initiale: 'J.', rayonPrincipal: 'drive',
    rayonsSecondaires: ['cave-vins'], poste: 'Préparatrice drive',
    heures: 30, dateEntree: '2024-11-18',
    disponibilites: matinsSeulement([1, 2, 3, 4, 5]),
    competences: {
      'préparation drive': 2, 'remise drive': 2, 'contrôle températures': 2,
      'conseil vins': 1,
    },
    equite: { samedisTravailles: 16, dimanchesTravailles: 5, fermetures: 3 },
  }),
]
