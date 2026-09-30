import { describe, expect, it } from 'vitest'
import type { Absence } from '../../domaine/absence'
import type { Collaborateur } from '../../domaine/collaborateur'
import type { Rayon } from '../../domaine/magasin'
import type { BesoinJour } from '../besoin'
import type { Infraction, Vacation } from '../regles'
import { construireLeTableauDeBord, proposerDesActions, type EntreesTableauDeBord } from './pilotage'

/** Donnees FICTIVES uniquement. */

const RAYON: Rayon = {
  id: 'fruits-legumes', serviceId: 'frais', nom: 'Fruits et légumes',
  ordre: 1, actif: true, horairesPropres: null,
}

function personne(modifications: Partial<Collaborateur> = {}): Collaborateur {
  return {
    id: 'c-01', prenom: 'Camille', initiale: 'D.', serviceId: 'frais',
    rayonPrincipal: 'fruits-legumes', rayonsSecondaires: [], poste: 'Employé',
    statut: 'employe', niveauClassification: 'Niveau 2', contrat: 'cdi',
    heuresHebdomadaires: 35, tempsPlein: true, dateEntree: '2020-01-01',
    finPeriodeEssai: null, finContrat: null, disponibilites: [], competences: { x: 2 },
    habilitations: [],
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    estMineur: false, contactAutorise: false, actif: true,
    ...modifications,
  }
}

function vacation(jour: string, fin = '13:20'): Vacation {
  return {
    id: `v-${jour}`, collaborateurId: 'c-01', rayonId: 'fruits-legumes',
    jour, debut: '06:00', fin, pauseMinutes: 20,
  }
}

function entrees(modifications: Partial<EntreesTableauDeBord> = {}): EntreesTableauDeBord {
  return {
    semaine: '2026-11-02',
    rayons: [RAYON],
    vacations: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((j) =>
      vacation(j),
    ),
    collaborateurs: [personne()],
    absences: [],
    besoins: [],
    infractions: [],
    budgetHeuresParRayon: { 'fruits-legumes': 40 },
    dureeLegaleHebdomadaireMinutes: 35 * 60,
    ...modifications,
  }
}

describe('tableau de bord', () => {
  it('totalise les heures prévues', () => {
    expect(construireLeTableauDeBord(entrees()).heuresPrevues).toBeCloseTo(35, 6)
  })

  it('compare au budget du service', () => {
    const tableau = construireLeTableauDeBord(entrees())
    expect(tableau.heuresBudget).toBe(40)
    expect(tableau.ecartAuBudget).toBeCloseTo(-5, 6)
  })

  it('considère couvert un service sans besoin calculé', () => {
    expect(construireLeTableauDeBord(entrees()).couverture).toBe(1)
  })

  it('mesure la couverture quand le besoin est connu', () => {
    const besoin: BesoinJour = {
      rayonId: 'fruits-legumes', date: '2026-11-02',
      tranches: Array.from({ length: 48 }, (_, index) => ({
        index, debutMinutes: index * 30, minutesParBloc: {},
        minutesTotal: index >= 12 && index < 26 ? 30 : 0,
        personnes: index >= 12 && index < 26 ? 1 : 0,
        competences: [], competencesCritiques: [],
      })),
      minutesTotal: 420, heuresTotal: 7, heuresPresence: 7,
      coefficientsAppliques: { saison: 1, meteo: 1, evenement: 1, promotion: 1, qualite: 1 },
      alertes: [],
    }
    const tableau = construireLeTableauDeBord(entrees({ besoins: [besoin] }))
    expect(tableau.couverture).toBeGreaterThan(0.8)
  })

  it('compte les heures supplémentaires au-delà de 35 h', () => {
    const six = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
      .map((j) => vacation(j))
    expect(construireLeTableauDeBord(entrees({ vacations: six })).heuresSupplementaires).toBeCloseTo(7, 6)
  })

  it('n’en compte pas pour un temps partiel', () => {
    const partiel = personne({ heuresHebdomadaires: 24, tempsPlein: false })
    expect(
      construireLeTableauDeBord(entrees({ collaborateurs: [partiel] })).heuresSupplementaires,
    ).toBe(0)
  })

  it('mesure l’absentéisme en jours-personnes', () => {
    const absences: Absence[] = [
      { id: 'a', collaborateurId: 'c-01', debut: '2026-11-03', fin: '2026-11-05', type: 'maladie', prevue: false },
    ]
    // Trois jours sur six jours ouvrables, une seule personne.
    expect(construireLeTableauDeBord(entrees({ absences })).absenteisme).toBeCloseTo(0.5, 6)
  })

  it('mesure la polyvalence moyenne et les compétences fragiles', () => {
    const tableau = construireLeTableauDeBord(entrees())
    expect(tableau.polyvalenceMoyenne).toBe(1)
    expect(tableau.competencesFragiles).toBe(1)
  })

  it('compte les règles enfreintes et les avertissements', () => {
    const infractions: Infraction[] = [
      { regle: 'repos-quotidien', severite: 'bloquante', collaborateurId: 'c-01', jour: '2026-11-02', libelle: '', explication: '' },
      { regle: 'travail-de-nuit', severite: 'avertissement', collaborateurId: 'c-01', jour: '2026-11-02', libelle: '', explication: '' },
      { regle: 'repos-hebdomadaire', severite: 'a-confirmer', collaborateurId: 'c-01', jour: '2026-11-02', libelle: '', explication: '' },
    ]
    const tableau = construireLeTableauDeBord(entrees({ infractions }))
    expect(tableau.reglesEnfreintes).toBe(1)
    expect(tableau.avertissements).toBe(1)
  })

  it('ne calcule la productivité que si le chiffre d’affaires est saisi', () => {
    expect(construireLeTableauDeBord(entrees()).productivite).toBeNull()
    const avecCa = construireLeTableauDeBord(entrees({ chiffreAffaires: 70000 }))
    expect(avecCa.productivite).toBeCloseTo(2000, 0)
  })
})

describe('plan d’actions', () => {
  it('met les règles enfreintes en première priorité', () => {
    const tableau = construireLeTableauDeBord(
      entrees({
        infractions: [
          { regle: 'repos-quotidien', severite: 'bloquante', collaborateurId: 'c-01', jour: '2026-11-02', libelle: '', explication: '' },
        ],
      }),
    )
    const actions = proposerDesActions(tableau)
    expect(actions[0]?.priorite).toBe(1)
    expect(actions[0]?.titre).toContain('Code du travail')
  })

  it('signale un budget dépassé', () => {
    const tableau = construireLeTableauDeBord(
      entrees({ budgetHeuresParRayon: { 'fruits-legumes': 20 } }),
    )
    expect(proposerDesActions(tableau).some((a) => a.titre.includes('Budget dépassé'))).toBe(true)
  })

  it('signale les compétences fragiles', () => {
    const tableau = construireLeTableauDeBord(entrees())
    expect(proposerDesActions(tableau).some((a) => a.titre.includes('une seule personne'))).toBe(true)
  })

  it('ne propose rien quand tout va bien', () => {
    const solide = [personne({ id: 'a' }), personne({ id: 'b' })]
    const tableau = construireLeTableauDeBord(
      entrees({ collaborateurs: solide, budgetHeuresParRayon: { 'fruits-legumes': 80 } }),
    )
    expect(proposerDesActions(tableau)).toEqual([])
  })

  it('classe les actions par priorité', () => {
    const tableau = construireLeTableauDeBord(
      entrees({
        budgetHeuresParRayon: { 'fruits-legumes': 10 },
        infractions: [
          { regle: 'repos-quotidien', severite: 'bloquante', collaborateurId: 'c-01', jour: '2026-11-02', libelle: '', explication: '' },
        ],
      }),
    )
    const actions = proposerDesActions(tableau)
    expect(actions.map((a) => a.priorite)).toEqual([...actions.map((a) => a.priorite)].sort())
  })
})
