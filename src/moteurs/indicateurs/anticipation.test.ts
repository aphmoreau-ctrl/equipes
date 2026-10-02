import { describe, expect, it } from 'vitest'
import type { Absence } from '../../domaine/absence'
import type { Collaborateur } from '../../domaine/collaborateur'
import type { Rayon } from '../../domaine/magasin'
import type { BesoinJour } from '../besoin'
import { alertesDAnticipation, anticiper, capaciteDeLaPersonne } from './anticipation'

/** Donnees FICTIVES uniquement. */

function personne(modifications: Partial<Collaborateur> = {}): Collaborateur {
  return {
    id: 'c-01', prenom: 'Camille', initiale: 'D.', serviceId: 'frais',
    rayonPrincipal: 'fruits-legumes', rayonsSecondaires: [], poste: 'Employé commercial',
    statut: 'employe', niveauClassification: 'Niveau 2', contrat: 'cdi',
    heuresHebdomadaires: 35, tempsPlein: true, dateEntree: '2019-04-15',
    finPeriodeEssai: null, finContrat: null, disponibilites: [], competences: {},
    habilitations: [],
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    periodesFormation: [],
    trancheAge: 'majeur', contactAutorise: false, actif: true,
    ...modifications,
  }
}

const RAYON: Rayon = {
  id: 'fruits-legumes', serviceId: 'frais', nom: 'Fruits et légumes',
  ordre: 1, actif: true, horairesPropres: null,
}

/** Besoin fictif : 10 h de presence par jour. */
function besoinDe(): BesoinJour {
  return {
    rayonId: 'fruits-legumes', date: '2026-11-02', tranches: [],
    minutesTotal: 600, heuresTotal: 10, heuresPresence: 10,
    coefficientsAppliques: { saison: 1, meteo: 1, evenement: 1, promotion: 1, qualite: 1 },
    alertes: [],
  }
}

describe('capacité d’une personne', () => {
  it('vaut ses heures de contrat sans absence', () => {
    expect(capaciteDeLaPersonne(personne(), '2026-11-02', [])).toBe(35)
  })

  it('diminue à proportion des jours d’absence', () => {
    const absences: Absence[] = [
      { id: 'a', collaborateurId: 'c-01', debut: '2026-11-02', fin: '2026-11-04', type: 'conge-paye', prevue: true },
    ]
    // Trois jours ouvrables sur six : la moitie de la capacite.
    expect(capaciteDeLaPersonne(personne(), '2026-11-02', absences)).toBeCloseTo(17.5, 6)
  })

  it('tombe à zéro pendant une semaine entièrement absente', () => {
    const absences: Absence[] = [
      { id: 'a', collaborateurId: 'c-01', debut: '2026-11-02', fin: '2026-11-08', type: 'conge-paye', prevue: true },
    ]
    expect(capaciteDeLaPersonne(personne(), '2026-11-02', absences)).toBe(0)
  })

  it('vaut zéro avant l’entrée dans l’entreprise', () => {
    expect(capaciteDeLaPersonne(personne({ dateEntree: '2027-01-05' }), '2026-11-02', [])).toBe(0)
  })

  it('vaut zéro après la fin du contrat', () => {
    expect(capaciteDeLaPersonne(personne({ finContrat: '2026-10-31' }), '2026-11-02', [])).toBe(0)
  })

  it('vaut zéro pour quelqu’un sorti de l’effectif', () => {
    expect(capaciteDeLaPersonne(personne({ actif: false }), '2026-11-02', [])).toBe(0)
  })
})

describe('anticipation sur douze semaines', () => {
  it('produit une ligne par rayon et par semaine', () => {
    const semaines = anticiper('2026-11-02', 12, [RAYON], [personne()], [], () => null)
    expect(semaines).toHaveLength(12)
    expect(semaines[0]?.semaine).toBe('2026-11-02')
    expect(semaines[11]?.semaine).toBe('2027-01-18')
  })

  it('compare le besoin à la capacité', () => {
    const semaines = anticiper('2026-11-02', 1, [RAYON], [personne()], [], () => besoinDe())
    // Sept jours a 10 h = 70 h de besoin, 35 h de capacite.
    expect(semaines[0]?.besoinHeures).toBe(70)
    expect(semaines[0]?.capaciteHeures).toBe(35)
    expect(semaines[0]?.ecartHeures).toBe(-35)
  })

  it('compte les personnes absentes dans la semaine', () => {
    const absences: Absence[] = [
      { id: 'a', collaborateurId: 'c-01', debut: '2026-11-04', fin: '2026-11-04', type: 'maladie', prevue: false },
    ]
    const semaines = anticiper('2026-11-02', 1, [RAYON], [personne()], absences, () => null)
    expect(semaines[0]?.absents).toBe(1)
  })

  it('ignore les rayons désactivés', () => {
    const semaines = anticiper('2026-11-02', 4, [{ ...RAYON, actif: false }], [personne()], [], () => null)
    expect(semaines).toEqual([])
  })

  it('ne compte pas les renforts d’autres rayons dans la capacité', () => {
    const renfort = personne({ id: 'c-02', rayonPrincipal: 'boucherie', rayonsSecondaires: ['fruits-legumes'] })
    const semaines = anticiper('2026-11-02', 1, [RAYON], [personne(), renfort], [], () => null)
    expect(semaines[0]?.capaciteHeures).toBe(35)
  })
})

describe('alertes d’anticipation', () => {
  it('signale les semaines en manque, avec les leviers', () => {
    const semaines = anticiper('2026-11-02', 2, [RAYON], [personne()], [], () => besoinDe())
    const alertes = alertesDAnticipation(semaines, [RAYON])

    expect(alertes).toHaveLength(2)
    expect(alertes[0]?.manqueHeures).toBe(35)
    expect(alertes[0]?.message).toContain('Fruits et légumes')
    expect(alertes[0]?.message).toContain('renfort')
    expect(alertes[0]?.message).toContain('congés')
  })

  it('ne signale rien quand la capacité suffit', () => {
    const equipe = [personne(), personne({ id: 'c-02' }), personne({ id: 'c-03' })]
    const semaines = anticiper('2026-11-02', 4, [RAYON], equipe, [], () => besoinDe())
    expect(alertesDAnticipation(semaines, [RAYON])).toEqual([])
  })

  it('respecte le seuil de tolérance', () => {
    const equipe = [personne({ heuresHebdomadaires: 65 })]
    const semaines = anticiper('2026-11-02', 1, [RAYON], equipe, [], () => besoinDe())
    // Manque de 5 h : sous le seuil de 8 h par defaut.
    expect(alertesDAnticipation(semaines, [RAYON])).toEqual([])
    expect(alertesDAnticipation(semaines, [RAYON], 2)).toHaveLength(1)
  })
})
