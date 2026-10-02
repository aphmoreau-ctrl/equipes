import { describe, expect, it } from 'vitest'
import type { Collaborateur } from '../../domaine/collaborateur'
import { TRANCHES_PAR_JOUR, enMinutes } from '../../domaine/temps'
import type { BesoinJour } from '../besoin'
import type { Vacation } from '../regles'
import {
  calculerCouverture,
  couvreLaTranche,
  ecartsAuContrat,
  expliquerLeTrou,
  heuresPrevues,
  mesurerEquite,
  regrouperLesTrous,
} from './index'

/** Donnees FICTIVES uniquement. */

function vacation(partiel: Partial<Vacation> = {}): Vacation {
  return {
    id: 'v1',
    collaborateurId: 'c-01',
    rayonId: 'fruits-legumes',
    jour: '2026-11-02',
    debut: '06:00',
    fin: '13:20',
    pauseMinutes: 20,
    ...partiel,
  }
}

function personne(modifications: Partial<Collaborateur> = {}): Collaborateur {
  return {
    id: 'c-01',
    prenom: 'Camille',
    initiale: 'D.',
    serviceId: 'frais',
    rayonPrincipal: 'fruits-legumes',
    rayonsSecondaires: [],
    poste: 'Employé commercial',
    statut: 'employe',
    niveauClassification: 'Niveau 2',
    contrat: 'cdi',
    heuresHebdomadaires: 35,
    tempsPlein: true,
    dateEntree: '2024-01-08',
    finPeriodeEssai: null,
    finContrat: null,
    disponibilites: [],
    competences: {},
    habilitations: [],
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    periodesFormation: [],
    trancheAge: 'majeur',
    contactAutorise: false,
    actif: true,
    ...modifications,
  }
}

/** Besoin fictif : deux personnes de 06:00 a 08:00, une de 08:00 a 09:00. */
function besoinDemo(): BesoinJour {
  const tranches = Array.from({ length: TRANCHES_PAR_JOUR }, (_, index) => {
    const debutMinutes = index * 30
    let personnes = 0
    let competences: string[] = []
    if (debutMinutes >= enMinutes('06:00') && debutMinutes < enMinutes('08:00')) {
      personnes = 2
      competences = ['mise en place']
    } else if (debutMinutes >= enMinutes('08:00') && debutMinutes < enMinutes('09:00')) {
      personnes = 1
    }
    return {
      index,
      debutMinutes,
      minutesParBloc: {},
      minutesTotal: personnes * 30,
      personnes,
      competences,
      competencesCritiques: [],
    niveauxMinimum: {},
    }
  })

  return {
    rayonId: 'fruits-legumes',
    date: '2026-11-02',
    tranches,
    minutesTotal: 300,
    heuresTotal: 5,
    heuresPresence: 5,
    coefficientsAppliques: { saison: 1, meteo: 1, evenement: 1, promotion: 1, qualite: 1 },
    alertes: [],
  }
}

describe('couverture d une tranche par une vacation', () => {
  it('reconnaît une tranche couverte', () => {
    const v = vacation({ debut: '06:00', fin: '09:00' })
    expect(couvreLaTranche(v, 12)).toBe(true) // 06:00
    expect(couvreLaTranche(v, 17)).toBe(true) // 08:30
    expect(couvreLaTranche(v, 18)).toBe(false) // 09:00, la vacation est finie
    expect(couvreLaTranche(v, 11)).toBe(false) // 05:30
  })
})

describe('couverture du besoin', () => {
  it('signale un rayon entièrement découvert', () => {
    const couverture = calculerCouverture(besoinDemo(), [], [])
    expect(couverture.tauxCouverture).toBe(0)
    expect(couverture.heuresManquantes).toBe(5)
    expect(couverture.trous.length).toBeGreaterThan(0)
  })

  it('reconnaît une couverture parfaite', () => {
    const vacations = [
      vacation({ id: 'a', collaborateurId: 'c-01', debut: '06:00', fin: '09:00', pauseMinutes: 0 }),
      vacation({ id: 'b', collaborateurId: 'c-02', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
    ]
    const equipe = [
      personne({ id: 'c-01', competences: { 'mise en place': 2 } }),
      personne({ id: 'c-02', competences: { 'mise en place': 3 } }),
    ]
    const couverture = calculerCouverture(besoinDemo(), vacations, equipe)
    expect(couverture.tauxCouverture).toBe(1)
    expect(couverture.heuresManquantes).toBe(0)
    expect(couverture.trous).toEqual([])
  })

  it('mesure le sureffectif', () => {
    const vacations = [
      vacation({ id: 'a', collaborateurId: 'c-01', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
      vacation({ id: 'b', collaborateurId: 'c-02', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
      vacation({ id: 'c', collaborateurId: 'c-03', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
    ]
    const equipe = ['c-01', 'c-02', 'c-03'].map((id) =>
      personne({ id, competences: { 'mise en place': 2 } }),
    )
    const couverture = calculerCouverture(besoinDemo(), vacations, equipe)
    expect(couverture.heuresSureffectif).toBe(2) // une personne de trop pendant 2 h
  })

  it('signale une compétence manquante, même avec assez de monde', () => {
    const vacations = [
      vacation({ id: 'a', collaborateurId: 'c-01', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
      vacation({ id: 'b', collaborateurId: 'c-02', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
    ]
    // Personne n'est autonome en « mise en place » : niveau 1 seulement.
    const equipe = ['c-01', 'c-02'].map((id) => personne({ id, competences: { 'mise en place': 1 } }))
    const couverture = calculerCouverture(besoinDemo(), vacations, equipe)
    expect(couverture.trous.length).toBeGreaterThan(0)
    expect(couverture.trous[0]?.competencesManquantes).toEqual(['mise en place'])
  })

  it('ignore les vacations d’un autre rayon ou d’un autre jour', () => {
    const vacations = [
      vacation({ id: 'a', rayonId: 'boucherie', debut: '06:00', fin: '09:00' }),
      vacation({ id: 'b', jour: '2026-11-03', debut: '06:00', fin: '09:00' }),
    ]
    expect(calculerCouverture(besoinDemo(), vacations, []).tauxCouverture).toBe(0)
  })

  it('considère un rayon sans besoin comme couvert', () => {
    const besoinNul: BesoinJour = {
      ...besoinDemo(),
      tranches: besoinDemo().tranches.map((t) => ({ ...t, personnes: 0, minutesTotal: 0, competences: [] })),
    }
    expect(calculerCouverture(besoinNul, [], []).tauxCouverture).toBe(1)
  })
})

describe('heures et contrats', () => {
  it('additionne les heures de travail effectif', () => {
    const vacations = [
      vacation({ id: 'a', debut: '06:00', fin: '13:20', pauseMinutes: 20 }),
      vacation({ id: 'b', jour: '2026-11-03', debut: '06:00', fin: '13:20', pauseMinutes: 20 }),
    ]
    expect(heuresPrevues(vacations, 'c-01')).toBe(14)
    expect(heuresPrevues(vacations, 'c-02')).toBe(0)
  })

  it('compare les heures prévues au contrat', () => {
    const vacations = [vacation({ debut: '06:00', fin: '13:20' })]
    const ecarts = ecartsAuContrat(vacations, [personne()])
    expect(ecarts[0]?.heuresPrevues).toBe(7)
    expect(ecarts[0]?.heuresContrat).toBe(35)
    expect(ecarts[0]?.ecart).toBe(-28)
  })
})

describe('équité', () => {
  it('mesure l’écart entre le plus et le moins sollicité', () => {
    const equipe = [
      personne({ id: 'a', compteursEquite: { samedisTravailles: 20, dimanchesTravailles: 8, fermetures: 5, feriesTravailles: 2 } }),
      personne({ id: 'b', compteursEquite: { samedisTravailles: 4, dimanchesTravailles: 1, fermetures: 0, feriesTravailles: 0 } }),
    ]
    const equite = mesurerEquite(equipe)
    expect(equite.ecartMaximal).toBe(35 - 5)
    expect(equite.parPersonne[0]?.collaborateurId).toBe('a')
  })
})

describe('explication des trous', () => {
  it('explique un manque de monde', () => {
    const couverture = calculerCouverture(besoinDemo(), [], [])
    const trou = couverture.trous[0]
    expect(trou).toBeDefined()
    const phrase = expliquerLeTrou(trou!, 'Crèmerie', '2026-11-02', [personne(), personne({ id: 'c-02' })])
    expect(phrase).toContain('Crèmerie')
    expect(phrase).toContain('06:00')
    expect(phrase).toContain('il manque 2 personnes')
    expect(phrase).toContain('2 personnes disponibles')
  })

  it('explique une compétence manquante', () => {
    const vacations = [
      vacation({ id: 'a', collaborateurId: 'c-01', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
      vacation({ id: 'b', collaborateurId: 'c-02', debut: '06:00', fin: '08:00', pauseMinutes: 0 }),
    ]
    const equipe = ['c-01', 'c-02'].map((id) => personne({ id, competences: { 'mise en place': 1 } }))
    const trou = calculerCouverture(besoinDemo(), vacations, equipe).trous[0]
    const phrase = expliquerLeTrou(trou!, 'Fruits et légumes', '2026-11-02', equipe)
    expect(phrase).toContain('mise en place')
    expect(phrase).toContain('Aucun collaborateur disponible')
  })

  it('regroupe les trous consécutifs en plages', () => {
    const couverture = calculerCouverture(besoinDemo(), [], [])
    const plages = regrouperLesTrous(couverture.trous)
    expect(plages).toHaveLength(1)
    expect(plages[0]?.debutMinutes).toBe(enMinutes('06:00'))
    expect(plages[0]?.finMinutes).toBe(enMinutes('09:00'))
    expect(plages[0]?.manqueMaximal).toBe(2)
  })
})
