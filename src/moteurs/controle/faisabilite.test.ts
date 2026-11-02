import { describe, expect, it } from 'vitest'
import { construireEtatReel } from '../../donnees/import-equipe'
import { RAYON } from '../../donnees/modele-la-vaugine'
import { calculerBesoin } from '../besoin'
import { contexteDeVerification, PARAMETRES_PAR_DEFAUT, verifier, type Vacation } from '../regles'
import { erreursDeLaJournee, verifierLaModification, type EntreesFaisabilite } from './faisabilite'

/** Equipe et planning ENTIEREMENT FICTIFS. */

const LUNDI = '2026-11-02'
const MARDI = '2026-11-03'

const etat = construireEtatReel([
  { prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree], secondaires: [RAYON.charcuterieFromage] },
  { prenom: 'Bérénice', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
])
const [abel, berenice] = etat.collaborateurs as [
  (typeof etat.collaborateurs)[0],
  (typeof etat.collaborateurs)[0],
]

function v(id: string, collaborateurId: string, jour: string, debut: string, fin: string, rayonId = RAYON.maree): Vacation {
  return { id, collaborateurId, rayonId, jour, debut, fin, pauseMinutes: 0 }
}

function besoin(rayonId: string, date: string) {
  const configuration = etat.configurations.find((c) => c.rayonId === rayonId)!
  return calculerBesoin(configuration, {
    date,
    clientsParTranche: new Array<number>(96).fill(0),
    tranchesOuvertes: new Set(),
    meteo: 'normal',
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  })
}

function entrees(vacations: Vacation[]): EntreesFaisabilite {
  return {
    semaine: LUNDI,
    vacations,
    besoins: [besoin(RAYON.maree, LUNDI), besoin(RAYON.maree, MARDI)],
    rayons: etat.magasin.rayons,
    collaborateurs: etat.collaborateurs,
    absences: [],
    organisation: etat.organisation,
    pausesPayees: true,
    infractionsDe: (liste) =>
      verifier(contexteDeVerification(liste, PARAMETRES_PAR_DEFAUT, { collaborateurs: etat.collaborateurs })),
  }
}

describe('saisie d’une journée', () => {
  it('refuse une fin avant le début, une pause hors poste, deux postes qui se chevauchent', () => {
    expect(erreursDeLaJournee([{ rayonId: 'x', debut: '12:00', fin: '08:00', pauseMinutes: 0 }])[0]).toMatch(
      /doit être après le début/,
    )
    expect(
      erreursDeLaJournee([{ rayonId: 'x', debut: '08:00', fin: '15:00', pauseMinutes: 20, pauseDebut: '16:00' }])[0],
    ).toMatch(/doit tenir dans le poste/)
    expect(
      erreursDeLaJournee([
        { rayonId: 'x', debut: '08:00', fin: '12:00', pauseMinutes: 0 },
        { rayonId: 'y', debut: '11:00', fin: '15:00', pauseMinutes: 0 },
      ]),
    ).toContain('Deux postes se chevauchent dans la journée.')
    expect(erreursDeLaJournee([{ rayonId: 'x', debut: '', fin: '15:00', pauseMinutes: 0 }])[0]).toMatch(/manquante/)
  })

  it('accepte deux postes dans deux rayons qui se suivent', () => {
    expect(
      erreursDeLaJournee([
        { rayonId: 'x', debut: '08:00', fin: '12:00', pauseMinutes: 0 },
        { rayonId: 'y', debut: '12:00', fin: '15:00', pauseMinutes: 0 },
      ]),
    ).toEqual([])
  })
})

describe('vérification de faisabilité', () => {
  it('refuse ce qui enfreint la loi : repos quotidien de 11 h', () => {
    const resultat = verifierLaModification(
      entrees([v('l', abel.id, LUNDI, '12:00', '20:00')]),
      abel.id,
      MARDI,
      [{ rayonId: RAYON.maree, debut: '05:00', fin: '12:00', pauseMinutes: 21, pauseDebut: '09:00' }],
    )
    expect(resultat.verdict).toBe('impossible')
    expect(resultat.nouveaux.some((c) => c.gravite === 'bloquant' && c.categorie === 'Règle légale')).toBe(true)
  })

  it('compte les heures de la semaine avant et après', () => {
    const resultat = verifierLaModification(
      entrees([v('l', abel.id, LUNDI, '07:00', '14:00')]),
      abel.id,
      MARDI,
      [{ rayonId: RAYON.maree, debut: '07:00', fin: '14:00', pauseMinutes: 21, pauseDebut: '10:00' }],
    )
    expect(resultat.heuresAvant).toBe(7)
    expect(resultat.heuresApres).toBe(14)
    expect(resultat.verdict).not.toBe('impossible')
  })

  it('signale un rayon que la personne ne tient pas, sans le bloquer', () => {
    const resultat = verifierLaModification(entrees([]), berenice.id, LUNDI, [
      { rayonId: RAYON.charcuterieFromage, debut: '08:00', fin: '15:00', pauseMinutes: 21, pauseDebut: '11:00' },
    ])
    expect(resultat.verdict).toBe('a-discuter')
    expect(resultat.nouveaux.some((c) => c.categorie === 'Horaires et rayons')).toBe(true)
  })

  it('dit ce qu’une journée vidée règle et ce qu’elle provoque', () => {
    // Un poste de 2 h (journee trop courte) : le retirer regle ce constat.
    const resultat = verifierLaModification(
      entrees([v('c', abel.id, LUNDI, '07:00', '09:00')]),
      abel.id,
      LUNDI,
      [],
    )
    expect(resultat.resolus.some((c) => c.categorie === 'Journée')).toBe(true)
    expect(resultat.vacations).toEqual([])
    expect(resultat.heuresApres).toBe(0)
  })

  it('prépare les postes à enregistrer, plusieurs le même jour', () => {
    const resultat = verifierLaModification(entrees([]), abel.id, LUNDI, [
      { rayonId: RAYON.maree, debut: '06:00', fin: '10:00', pauseMinutes: 0 },
      { rayonId: RAYON.charcuterieFromage, debut: '10:00', fin: '13:00', pauseMinutes: 0 },
    ])
    expect(resultat.vacations.map((x) => `${x.rayonId} ${x.debut}-${x.fin}`)).toEqual([
      `${RAYON.maree} 06:00-10:00`,
      `${RAYON.charcuterieFromage} 10:00-13:00`,
    ])
    expect(resultat.heuresApres).toBe(7)
  })
})
