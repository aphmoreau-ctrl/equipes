import { describe, expect, it } from 'vitest'
import type { Mission, Renfort } from '../../domaine/vivier'
import { MISSIONS_DEMO, RENFORTS_DEMO } from '../../donnees/vivier-demo'
import { bilanDesMissions, classerRenforts, heuresTravaillees, type DemandeRenfort } from './index'

/** Donnees FICTIVES uniquement. */
function renfort(modifications: Partial<Renfort> = {}): Renfort {
  return {
    id: 'r-x',
    prenom: 'Noé',
    initiale: 'P.',
    origine: 'interim',
    agence: '',
    rayons: ['fruits-legumes'],
    competences: { 'mise en place': 2 },
    joursPossibles: [1, 2, 3, 4, 5, 6],
    coutHoraire: 20,
    contactAutorise: true,
    actif: true,
    ...modifications,
  }
}

// 2026-10-03 est un samedi.
const DEMANDE: DemandeRenfort = {
  date: '2026-10-03',
  rayonId: 'fruits-legumes',
  debut: '06:00',
  fin: '13:00',
  pauseMinutes: 20,
  competencesRequises: ['mise en place'],
  competencesCritiques: [],
}

describe('classement du vivier exterieur', () => {
  it('ecarte qui n intervient pas dans le rayon, n est pas disponible ou est inactif', () => {
    const resultat = classerRenforts(
      DEMANDE,
      [
        renfort({ id: 'a', rayons: ['boucherie'] }),
        renfort({ id: 'b', joursPossibles: [1, 2] }),
        renfort({ id: 'c', actif: false }),
      ],
      [],
    )
    expect(resultat.possibles).toHaveLength(0)
    expect(resultat.ecartes.map((ecarte) => ecarte.renfort.id)).toEqual(['a', 'b'])
  })

  it('n accepte aucune tolerance sur une competence critique', () => {
    const resultat = classerRenforts(
      { ...DEMANDE, rayonId: 'boucherie', competencesCritiques: ['boucherie'] },
      [renfort({ rayons: ['boucherie'], competences: { boucherie: 1, 'mise en place': 3 } })],
      [],
    )
    expect(resultat.possibles).toHaveLength(0)
    expect(resultat.partiels).toHaveLength(0)
    expect(resultat.ecartes[0]?.motif).toMatch(/indispensable/)
  })

  it('ecarte qui a deja une mission ce jour-la', () => {
    const mission: Mission = {
      id: 'm', renfortId: 'r-x', date: DEMANDE.date, rayonId: 'cremerie',
      debut: '14:00', fin: '19:00', pauseMinutes: 0, motif: 'renfort', vacationCouverte: null,
    }
    expect(classerRenforts(DEMANDE, [renfort()], [mission]).possibles).toHaveLength(0)
  })

  it('propose comme renfort partiel qui ne couvre qu une partie des competences', () => {
    const resultat = classerRenforts(
      { ...DEMANDE, competencesRequises: ['mise en place', 'réception'] },
      [renfort()],
      [],
    )
    expect(resultat.possibles).toHaveLength(0)
    expect(resultat.partiels).toHaveLength(1)
    expect(resultat.partiels[0]?.reserves.join(' ')).toMatch(/réception/)
  })

  it('a competences egales, prefere celui qui connait le rayon puis le moins cher', () => {
    const habitue = renfort({ id: 'habitue', coutHoraire: 25 })
    const nouveau = renfort({ id: 'nouveau', coutHoraire: 25 })
    const moinsCher = renfort({ id: 'moins-cher', coutHoraire: 16 })
    const passe: Mission[] = [1, 2, 3].map((numero) => ({
      id: `m${numero}`, renfortId: 'habitue', date: `2026-09-0${numero}`, rayonId: 'fruits-legumes',
      debut: '06:00', fin: '13:00', pauseMinutes: 20, motif: 'renfort', vacationCouverte: null,
    }))
    const ordre = classerRenforts(DEMANDE, [nouveau, moinsCher, habitue], passe).possibles.map(
      (proposition) => proposition.renfort.id,
    )
    expect(ordre).toEqual(['habitue', 'moins-cher', 'nouveau'])
  })

  it('estime le cout de la vacation, pause deduite', () => {
    const resultat = classerRenforts(DEMANDE, [renfort({ coutHoraire: 24 })], [])
    // 7 h - 20 min = 6 h 40 = 6,67 h × 24 € = 160 €
    expect(resultat.possibles[0]?.coutEstime).toBe(160)
  })

  it('signale sans l ecarter qui n a pas accepte d etre recontacte', () => {
    const resultat = classerRenforts(DEMANDE, [renfort({ contactAutorise: false })], [])
    expect(resultat.possibles[0]?.reserves.join(' ')).toMatch(/accord/)
  })

  it('est deterministe sur la demonstration', () => {
    expect(classerRenforts(DEMANDE, RENFORTS_DEMO, MISSIONS_DEMO)).toEqual(
      classerRenforts(DEMANDE, RENFORTS_DEMO, MISSIONS_DEMO),
    )
    expect(classerRenforts(DEMANDE, RENFORTS_DEMO, MISSIONS_DEMO).possibles[0]?.renfort.id).toBe('r-01')
  })
})

describe('bilan des missions', () => {
  it('compte les heures et le cout sur la periode', () => {
    expect(heuresTravaillees({ debut: '06:00', fin: '13:00', pauseMinutes: 20 })).toBeCloseTo(6.667, 2)
    const bilan = bilanDesMissions(MISSIONS_DEMO, RENFORTS_DEMO, '2026-09-01', '2026-09-30')
    expect(bilan.lignes.map((ligne) => ligne.renfortId)).toEqual(['r-01', 'r-03'])
    expect(bilan.lignes[0]?.missions).toBe(2)
    expect(bilan.heures).toBeCloseTo(20, 1)
    expect(bilan.cout).toBeCloseTo(13.33 * 24.5 + 6.67 * 21, 0)
  })

  it('ignore les missions hors periode', () => {
    expect(bilanDesMissions(MISSIONS_DEMO, RENFORTS_DEMO, '2026-10-01', '2026-10-31').lignes).toEqual([])
  })
})

describe('vivier de demonstration', () => {
  it('ne contient que prenom et initiale', () => {
    for (const personne of RENFORTS_DEMO) {
      expect(personne.initiale).toMatch(/^[A-ZÉ]\.$/)
    }
  })
})
