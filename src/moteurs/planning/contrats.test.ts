import { describe, expect, it } from 'vitest'
import { jourDeLaSemaine, semaineDe } from '../../domaine/calendrier'
import { horsCalculDHeures, estMineur } from '../../domaine/collaborateur'
import { REGLES_INTERNES_PAR_DEFAUT } from '../../domaine/organisation'
import { duree, enMinutes } from '../../domaine/temps'
import { construireEtatReel, type SaisieCollaborateur } from '../../donnees/import-equipe'
import { ORGANISATION_LA_VAUGINE, RAYON as R } from '../../donnees/modele-la-vaugine'
import { calculerBesoin, type BesoinJour } from '../besoin'
import { contexteDeVerification, PARAMETRES_PAR_DEFAUT, verifier } from '../regles'
import {
  genererLePlanning,
  pauseDuPoste,
  placerLaPause,
  postesDeContrat,
  type EntreesGeneration,
} from './generateur'

/**
 * Le planning donne a chacun ses heures de contrat (regles du planning v2).
 *
 * Equipe ENTIEREMENT FICTIVE, de la taille d'un vrai service frais : vingt-six
 * personnes, huit rayons, deux mineurs, un cadre au forfait.
 */

const H = 36.75
const CM = R.cuisineMobile
const CF = R.charcuterieFromage
const BT = R.boucherieTrad
const BL = R.boucherieLs

const EQUIPE: SaisieCollaborateur[] = [
  { prenom: 'Abel', statut: 'employe', heures: H, principaux: [R.maree], secondaires: [CF, CM] },
  { prenom: 'Bérénice', statut: 'employe', heures: H, principaux: [R.maree], secondaires: [CF, BT] },
  { prenom: 'Cyril', statut: 'employe', heures: H, principaux: [R.maree], secondaires: [CF] },
  { prenom: 'Delphine', statut: 'employe', heures: 39, principaux: [CF], secondaires: [R.maree, BT] },
  { prenom: 'Eugène', statut: 'employe', heures: H, principaux: [CF], secondaires: [CM] },
  { prenom: 'Flore', statut: 'employe', heures: H, principaux: [CF], secondaires: [R.maree] },
  { prenom: 'Gaspard', statut: 'employe', heures: H, principaux: [CF], depannage: [BT] },
  { prenom: 'Hélène', statut: 'manager', heures: H, principaux: [R.fruitsLegumes], secondaires: [R.fraicheDecoupe] },
  { prenom: 'Igor', statut: 'employe', heures: H, principaux: [R.fruitsLegumes], secondaires: [R.fraicheDecoupe] },
  { prenom: 'Jade', statut: 'employe', heures: H, principaux: [R.fruitsLegumes], secondaires: [CM] },
  { prenom: 'Kevin', statut: 'employe', heures: H, principaux: [R.fruitsLegumes], secondaires: [R.maree] },
  { prenom: 'Lina', statut: 'interim', heures: H, principaux: [R.fruitsLegumes] },
  {
    prenom: 'Mona',
    statut: 'employe',
    heures: H,
    principaux: [R.fraicheDecoupe],
    posteDuMatin: 'contrainte',
  },
  { prenom: 'Nestor', statut: 'manager', heures: H, principaux: [BL, BT], secondaires: [CF] },
  { prenom: 'Odile', statut: 'manager', heures: H, principaux: [BT], secondaires: [CM] },
  { prenom: 'Pascal', statut: 'employe', heures: H, principaux: [BT, BL], secondaires: [CM] },
  { prenom: 'Quentin', statut: 'employe', heures: H, principaux: [BT, BL] },
  { prenom: 'Rose', statut: 'employe', heures: H, principaux: [BT, BL], secondaires: [CM] },
  { prenom: 'Simon', statut: 'employe', heures: H, principaux: [BT, BL], secondaires: [CM] },
  { prenom: 'Tess', statut: 'employe', heures: H, principaux: [BL, BT], secondaires: [CM] },
  { prenom: 'Ulysse', statut: 'apprenti', heures: H, principaux: [BT, BL] },
  { prenom: 'Victor', statut: 'apprenti', trancheAge: '16-17', heures: H, principaux: [BT, BL] },
  { prenom: 'Wanda', statut: 'employe', heures: H, principaux: [R.preparationTraiteur] },
  { prenom: 'Xavier', statut: 'employe', heures: H, principaux: [R.preparationTraiteur] },
  { prenom: 'Yvon', statut: 'apprenti', trancheAge: '16-17', heures: H, principaux: [R.preparationTraiteur] },
  { prenom: 'Zoé', statut: 'cadre-forfait', principaux: [R.preparationTraiteur] },
]

const SEMAINE = '2026-11-02'

function preparer() {
  const etat = construireEtatReel(EQUIPE)
  // Jours d'ecole fictifs : le mercredi pour un apprenti, aucun pour les autres.
  const collaborateurs = etat.collaborateurs.map((c) =>
    c.prenom === 'Ulysse'
      ? { ...c, joursEcole: [3 as const] }
      : c.contrat === 'apprenti'
        ? { ...c, joursEcole: [] }
        : c,
  )
  const besoins: BesoinJour[] = semaineDe(SEMAINE).flatMap((date) =>
    etat.configurations.map((configuration) =>
      calculerBesoin(configuration, {
        date,
        clientsParTranche: new Array<number>(96).fill(0),
        tranchesOuvertes: new Set(),
        meteo: 'normal',
        coefficientEvenements: 1,
        enPromotion: false,
        saisiesQualite: [],
      }),
    ),
  )
  const entrees: EntreesGeneration = {
    semaine: SEMAINE,
    rayons: etat.magasin.rayons,
    besoins,
    collaborateurs,
    absences: [],
    horairesTypes: etat.magasin.horairesTypes,
    parametres: PARAMETRES_PAR_DEFAUT,
    reglesInternes: etat.organisation.reglesInternes,
    plagesAffluence: etat.organisation.plagesAffluence,
    dureeMaximaleMs: 20000,
  }
  return { etat: { ...etat, collaborateurs }, entrees }
}

const { etat, entrees } = preparer()
const resultat = genererLePlanning(entrees)

describe('chacun fait ses heures', () => {
  it('chaque salarié est à moins d’1 h 30 sous son contrat, et jamais plus d’1 h au-dessus', () => {
    for (const collaborateur of etat.collaborateurs) {
      if (horsCalculDHeures(collaborateur)) continue
      const heures =
        resultat.vacations
          .filter((v) => v.collaborateurId === collaborateur.id)
          .reduce((somme, v) => somme + duree(v.debut, v.fin), 0) / 60
      expect(heures, collaborateur.prenom).toBeGreaterThanOrEqual(collaborateur.heuresHebdomadaires - 1.5)
      expect(heures, collaborateur.prenom).toBeLessThanOrEqual(collaborateur.heuresHebdomadaires + 1)
    }
  })

  it('n’enfreint aucune règle légale', () => {
    const infractions = verifier(
      contexteDeVerification(resultat.vacations, PARAMETRES_PAR_DEFAUT, {
        collaborateurs: etat.collaborateurs,
      }),
    ).filter((infraction) => infraction.severite === 'bloquante')
    expect(infractions).toEqual([])
  })

  it('reste dans les horaires de chaque rayon, jamais un jour de fermeture', () => {
    for (const vacation of resultat.vacations) {
      const rayon = etat.magasin.rayons.find((r) => r.id === vacation.rayonId)
      const horaires = rayon?.horairesPropres?.[jourDeLaSemaine(vacation.jour)]
      expect(horaires?.ouvert, `${vacation.rayonId} ${vacation.jour}`).toBe(true)
      expect(enMinutes(vacation.debut)).toBeGreaterThanOrEqual(enMinutes(horaires?.ouverture ?? '00:00'))
      expect(enMinutes(vacation.fin)).toBeLessThanOrEqual(enMinutes(horaires?.fermeture ?? '23:59'))
    }
  })

  it('ne place jamais un rayon tenu en dépannage seulement', () => {
    const gaspard = etat.collaborateurs.find((c) => c.prenom === 'Gaspard')
    expect(
      resultat.vacations.some((v) => v.collaborateurId === gaspard?.id && v.rayonId === BT),
    ).toBe(false)
  })

  it('respecte le jour d’école et le « matin uniquement »', () => {
    const ulysse = etat.collaborateurs.find((c) => c.prenom === 'Ulysse')
    const mona = etat.collaborateurs.find((c) => c.prenom === 'Mona')
    for (const vacation of resultat.vacations) {
      if (vacation.collaborateurId === ulysse?.id) expect(jourDeLaSemaine(vacation.jour)).not.toBe(3)
      if (vacation.collaborateurId === mona?.id) {
        expect(enMinutes(vacation.fin)).toBeLessThanOrEqual(enMinutes(REGLES_INTERNES_PAR_DEFAUT.finDuMatin))
      }
    }
  })

  it('donne aux mineurs leur pause de 30 minutes', () => {
    for (const collaborateur of etat.collaborateurs.filter(estMineur)) {
      for (const vacation of resultat.vacations.filter((v) => v.collaborateurId === collaborateur.id)) {
        if (duree(vacation.debut, vacation.fin) - vacation.pauseMinutes > 4.5 * 60) {
          expect(vacation.pauseMinutes).toBeGreaterThanOrEqual(30)
        }
      }
    }
  })

  it('n’attribue pas d’heures au cadre au forfait', () => {
    const zoe = etat.collaborateurs.find((c) => c.prenom === 'Zoé')
    expect(resultat.restesAExpliquer.some((reste) => reste.startsWith('Zoé'))).toBe(false)
    expect(zoe?.forfait).toBe(true)
  })

  it('donne le même planning à données égales', () => {
    const encore = genererLePlanning(entrees)
    expect(encore.vacations).toEqual(resultat.vacations)
  })
})

describe('postes de contrat et pauses', () => {
  const regles = ORGANISATION_LA_VAUGINE.reglesInternes

  it('3 minutes de pause par heure, 20 minutes au moins dès 6 h de travail', () => {
    expect(pauseDuPoste(8 * 60, regles, false, PARAMETRES_PAR_DEFAUT)).toBe(24)
    expect(pauseDuPoste(7 * 60, regles, false, PARAMETRES_PAR_DEFAUT)).toBe(21)
    expect(pauseDuPoste(5 * 60, regles, false, PARAMETRES_PAR_DEFAUT)).toBe(15)
    // 6 h 30 de presence : 20 min de pause donnent 6 h 10 de travail, la loi
    // impose 20 min ; 3 min/h n'en donneraient que 19,5.
    expect(pauseDuPoste(6 * 60 + 30, regles, false, PARAMETRES_PAR_DEFAUT)).toBe(20)
    // Mineur : 30 minutes des 4 h 30 de travail.
    expect(pauseDuPoste(7 * 60, regles, true, PARAMETRES_PAR_DEFAUT)).toBe(30)
  })

  it('place la pause dans une plage permise, hors affluence', () => {
    const affluence = [
      { debut: '11:00', fin: '13:00' },
      { debut: '17:00', fin: '19:00' },
    ]
    const depart = placerLaPause(enMinutes('06:00'), enMinutes('14:00'), 24, regles, affluence)
    expect(depart).toBeGreaterThanOrEqual(enMinutes('08:30'))
    expect(depart + 24).toBeLessThanOrEqual(enMinutes('11:00'))
    const soir = placerLaPause(enMinutes('12:00'), enMinutes('20:00'), 24, regles, affluence)
    expect(soir).toBeGreaterThanOrEqual(enMinutes('15:00'))
    expect(soir + 24).toBeLessThanOrEqual(enMinutes('17:00'))
  })

  it('cale les postes sur les horaires du rayon, dimanche matin compris', () => {
    const dimanche = entrees.besoins.filter(
      (b) => b.rayonId === R.maree && jourDeLaSemaine(b.date) === 7,
    )
    const postes = postesDeContrat(dimanche, etat.magasin.rayons, regles, PARAMETRES_PAR_DEFAUT, () => [], false)
    expect(postes.length).toBeGreaterThan(0)
    for (const poste of postes) {
      expect(enMinutes(poste.debut)).toBeGreaterThanOrEqual(enMinutes('07:00'))
      expect(enMinutes(poste.fin)).toBeLessThanOrEqual(enMinutes('12:45'))
    }
  })
})
