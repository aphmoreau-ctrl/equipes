import { describe, expect, it } from 'vitest'
import { jourDeLaSemaine, semaineDe } from '../../domaine/calendrier'
import { estMineur } from '../../domaine/collaborateur'
import { fenetresDuJour, REGLES_INTERNES_PAR_DEFAUT } from '../../domaine/organisation'
import { duree, enMinutes } from '../../domaine/temps'
import { construireEtatReel, type SaisieCollaborateur } from '../../donnees/import-equipe'
import { ORGANISATION_LA_VAUGINE, RAYON as R } from '../../donnees/modele-la-vaugine'
import { calculerBesoin, type BesoinJour } from '../besoin'
import { couvreLaTranche } from '../indicateurs'
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

function heuresDe(r: { vacations: readonly { collaborateurId: string; debut: string; fin: string }[] }, id: string): number {
  return r.vacations.filter((v) => v.collaborateurId === id).reduce((s, v) => s + duree(v.debut, v.fin), 0) / 60
}
const resultat = genererLePlanning(entrees)

describe('chacun fait ses heures', () => {
  it('chacun fait ses heures, à un quart d’heure près, sauf l’apprenti à l’école', () => {
    for (const collaborateur of etat.collaborateurs) {
      // Ulysse a un jour d'ecole : 36 h 75 x 5/6 a faire au magasin.
      const vise =
        collaborateur.prenom === 'Ulysse'
          ? (collaborateur.heuresHebdomadaires * 5) / 6
          : collaborateur.heuresHebdomadaires
      expect(heuresDe(resultat, collaborateur.id), collaborateur.prenom).toBeCloseTo(vise, 0)
      expect(Math.abs(heuresDe(resultat, collaborateur.id) - vise), collaborateur.prenom).toBeLessThanOrEqual(0.25)
    }
    expect(resultat.restesAExpliquer.filter((r) => r.includes('à faire cette semaine'))).toEqual([])
  })

  it('un congé payé vaut un jour ouvrable : contrat / 6', () => {
    const abel = etat.collaborateurs.find((c) => c.prenom === 'Abel')!
    const avecConge = genererLePlanning({
      ...entrees,
      absences: [
        { id: 'cp', collaborateurId: abel.id, debut: '2026-11-05', fin: '2026-11-06', type: 'conge-paye', prevue: true },
      ],
    })
    // 36 h 75 - 2 x 6 h 07 = 24 h 30, au quart d'heure pres.
    expect(Math.abs(heuresDe(avecConge, abel.id) - 24.5)).toBeLessThanOrEqual(0.25)
    expect(
      avecConge.vacations.some(
        (v) => v.collaborateurId === abel.id && (v.jour === '2026-11-05' || v.jour === '2026-11-06'),
      ),
    ).toBe(false)
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

  it('place aussi le cadre au forfait : il travaille, même si ses heures ne se comptent pas', () => {
    const zoe = etat.collaborateurs.find((c) => c.prenom === 'Zoé')!
    expect(zoe.forfait).toBe(true)
    expect(heuresDe(resultat, zoe.id)).toBeGreaterThan(30)
  })

  it('place les pauses quand un collègue couvre : aucune pause ne vide Fruits & Légumes en semaine', () => {
    // Le samedi, l'affluence (15 h-19 h) recouvre la plage de pause de l'apres-midi :
    // une pause y est forcement hors plage ou pendant l'affluence (point a regler).
    for (const besoin of entrees.besoins.filter(
      (b) => b.rayonId === R.fruitsLegumes && jourDeLaSemaine(b.date) <= 4,
    )) {
      const duJour = resultat.vacations.filter((v) => v.rayonId === R.fruitsLegumes && v.jour === besoin.date)
      for (const tranche of besoin.tranches) {
        if (tranche.personnes === 0) continue
        const presents = duJour.filter((v) => couvreLaTranche(v, tranche.index)).length
        if (presents >= tranche.personnes) continue
        // Sous le minimum : ce ne doit pas etre a cause d'une pause.
        const debutTranche = tranche.index * 15
        const enPause = duJour.filter(
          (v) =>
            enMinutes(v.debut) <= debutTranche &&
            debutTranche < enMinutes(v.fin) &&
            !couvreLaTranche(v, tranche.index),
        )
        expect(enPause, `${besoin.date} tranche ${tranche.index}`).toEqual([])
      }
    }
  })

  it('dit, pour chaque trou, pourquoi personne ne le comble', () => {
    const trous = resultat.restesAExpliquer.filter((reste) => reste.includes('minimum non tenu'))
    for (const trou of trous) expect(trou).toMatch(/Pourquoi personne : .+ : /)
  })

  it('le vendredi et le samedi, encore à définir, demandent au moins la cible du jeudi', () => {
    const jeudi = entrees.besoins.find((b) => b.rayonId === R.maree && b.date === '2026-11-05')!
    const vendredi = entrees.besoins.find((b) => b.rayonId === R.maree && b.date === '2026-11-06')!
    for (const tranche of vendredi.tranches) {
      expect(tranche.personnes).toBeGreaterThanOrEqual(jeudi.tranches[tranche.index]?.cible ?? 0)
    }
  })

  it('vendredi et samedi : présence maximale, repos plutôt du lundi au mercredi', () => {
    const presents = (date: string) => new Set(resultat.vacations.filter((v) => v.jour === date).map((v) => v.collaborateurId)).size
    expect(presents('2026-11-06')).toBeGreaterThan(presents('2026-11-02'))
    expect(presents('2026-11-07')).toBeGreaterThan(presents('2026-11-03'))
    // Qui manque un jour prioritaire est nomme, avec la raison.
    for (const reste of resultat.restesAExpliquer.filter((r) => r.includes('jour prioritaire'))) {
      expect(reste).toMatch(/ne travaillent pas .+ \(.+\)/)
    }
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

  it('le samedi, la pause se place dans les plages du samedi, hors affluence', () => {
    const samedi = [
      { debut: '10:00', fin: '13:00' },
      { debut: '15:00', fin: '19:00' },
    ]
    const depart = placerLaPause(enMinutes('12:00'), enMinutes('20:00'), 24, regles, samedi, fenetresDuJour(regles, 6))
    expect(depart).toBeGreaterThanOrEqual(enMinutes('13:00'))
    expect(depart + 24).toBeLessThanOrEqual(enMinutes('15:00'))
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
