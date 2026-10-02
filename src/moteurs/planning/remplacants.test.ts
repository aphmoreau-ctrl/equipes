import { describe, expect, it } from 'vitest'
import type { Absence } from '../../domaine/absence'
import type { Collaborateur } from '../../domaine/collaborateur'
import type { Vacation } from '../regles'
import { chercherDesRemplacants } from './remplacants'

/** Donnees FICTIVES uniquement. */

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
    competences: { 'mise en place': 2 },
    habilitations: [],
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    periodesFormation: [],
    trancheAge: 'majeur',
    contactAutorise: false,
    actif: true,
    ...modifications,
  }
}

const A_COUVRIR: Vacation = {
  id: 'v-absente',
  collaborateurId: 'c-absent',
  rayonId: 'fruits-legumes',
  jour: '2026-11-02',
  debut: '05:30',
  fin: '12:30',
  pauseMinutes: 20,
}

function chercher(
  collaborateurs: readonly Collaborateur[],
  options: {
    absences?: readonly Absence[]
    vacations?: readonly Vacation[]
    competences?: readonly string[]
    critiques?: readonly string[]
  } = {},
) {
  return chercherDesRemplacants({
    vacation: A_COUVRIR,
    collaborateurs,
    absences: options.absences ?? [],
    vacationsDeLaSemaine: options.vacations ?? [],
    competencesRequises: options.competences ?? ['mise en place'],
    competencesCritiques: options.critiques ?? [],
    reposQuotidienMinutes: 11 * 60,
  })
}

describe('qui est écarté, et pourquoi', () => {
  it('écarte qui n’intervient pas dans le rayon', () => {
    const resultat = chercher([personne({ id: 'a', rayonPrincipal: 'boucherie' })])
    expect(resultat.possibles).toEqual([])
    expect(resultat.ecartes[0]?.motif).toContain('n’intervient pas dans ce rayon')
  })

  it('écarte qui est absent', () => {
    const absences: Absence[] = [
      { id: 'a1', collaborateurId: 'a', debut: '2026-11-01', fin: '2026-11-05', type: 'maladie', prevue: false },
    ]
    const resultat = chercher([personne({ id: 'a' })], { absences })
    expect(resultat.ecartes[0]?.motif).toContain('est absent ce jour-là')
  })

  it('écarte qui s’est déclaré indisponible', () => {
    const indisponible = personne({
      id: 'a',
      disponibilites: [{ jour: 1, disponible: false, plage: null }],
    })
    expect(chercher([indisponible]).ecartes[0]?.motif).toContain('indisponible')
  })

  it('écarte qui travaille déjà ce jour-là', () => {
    const vacations: Vacation[] = [{ ...A_COUVRIR, id: 'autre', collaborateurId: 'a' }]
    expect(chercher([personne({ id: 'a' })], { vacations }).ecartes[0]?.motif).toContain(
      'travaille déjà',
    )
  })

  it('écarte qui ne couvre aucune des compétences attendues', () => {
    const debutant = personne({ id: 'a', competences: { 'mise en place': 1 } })
    expect(chercher([debutant]).ecartes[0]?.motif).toContain('autonome sur aucune')
  })

  it('range à part qui ne couvre qu’une partie du poste', () => {
    const partiel = personne({ id: 'a', competences: { 'mise en place': 2 } })
    const resultat = chercher([partiel], { competences: ['mise en place', 'commandes'] })
    expect(resultat.possibles).toEqual([])
    expect(resultat.partiels).toHaveLength(1)
    expect(resultat.partiels[0]?.reserves.join(' ')).toContain('commandes')
  })

  it('ne propose en remplacement que qui couvre tout le poste', () => {
    const complet = personne({ id: 'complet', competences: { 'mise en place': 2, commandes: 2 } })
    const partiel = personne({ id: 'partiel', competences: { 'mise en place': 2 } })
    const resultat = chercher([partiel, complet], { competences: ['mise en place', 'commandes'] })
    expect(resultat.possibles.map((r) => r.collaborateur.id)).toEqual(['complet'])
    expect(resultat.partiels.map((r) => r.collaborateur.id)).toEqual(['partiel'])
  })

  it('écarte sans discussion qui n’a pas une compétence critique', () => {
    // Quelqu'un de tres bien par ailleurs, mais pas boucher.
    const polyvalent = personne({
      id: 'polyvalent',
      competences: { 'mise en place': 3, 'hygiène': 3 },
      contactAutorise: true,
    })
    const resultat = chercher([polyvalent], {
      competences: ['mise en place', 'boucherie'],
      critiques: ['boucherie'],
    })
    expect(resultat.possibles).toEqual([])
    expect(resultat.partiels).toEqual([])
    expect(resultat.ecartes[0]?.motif).toContain('indispensable pour tenir ce poste')
  })

  it('accepte qui possède la compétence critique', () => {
    const boucher = personne({ id: 'boucher', competences: { boucherie: 2, 'mise en place': 2 } })
    const resultat = chercher([boucher], {
      competences: ['mise en place', 'boucherie'],
      critiques: ['boucherie'],
    })
    expect(resultat.possibles.map((r) => r.collaborateur.id)).toEqual(['boucher'])
  })

  it('n’écarte jamais sans expliquer', () => {
    const resultat = chercher([
      personne({ id: 'a', rayonPrincipal: 'boucherie' }),
      personne({ id: 'b', competences: {} }),
    ])
    for (const ecarte of resultat.ecartes) {
      expect(ecarte.motif.length).toBeGreaterThan(15)
    }
  })

  it('ne se propose jamais la personne absente elle-même', () => {
    const resultat = chercher([personne({ id: 'c-absent' })])
    expect(resultat.possibles).toEqual([])
    expect(resultat.ecartes).toEqual([])
  })
})

describe('classement des remplaçants', () => {
  it('place le rayon principal avant le renfort', () => {
    const duRayon = personne({ id: 'principal' })
    const renfort = personne({
      id: 'renfort',
      rayonPrincipal: 'cremerie',
      rayonsSecondaires: ['fruits-legumes'],
    })
    const resultat = chercher([renfort, duRayon])
    expect(resultat.possibles[0]?.collaborateur.id).toBe('principal')
    expect(resultat.possibles[0]?.atouts).toContain('C’est son rayon')
  })

  it('privilégie qui a des heures restantes au contrat', () => {
    const dispo = personne({ id: 'dispo' })
    const charge = personne({ id: 'charge' })
    const vacations: Vacation[] = [
      { ...A_COUVRIR, id: 'v1', collaborateurId: 'charge', jour: '2026-11-03', debut: '05:00', fin: '17:00' },
      { ...A_COUVRIR, id: 'v2', collaborateurId: 'charge', jour: '2026-11-04', debut: '05:00', fin: '17:00' },
      { ...A_COUVRIR, id: 'v3', collaborateurId: 'charge', jour: '2026-11-05', debut: '05:00', fin: '17:00' },
    ]
    const resultat = chercher([charge, dispo], { vacations })
    expect(resultat.possibles[0]?.collaborateur.id).toBe('dispo')
  })

  it('prévient d’un dépassement de contrat sans interdire', () => {
    const presque = personne({ id: 'presque', heuresHebdomadaires: 10 })
    const vacations: Vacation[] = [
      { ...A_COUVRIR, id: 'v1', collaborateurId: 'presque', jour: '2026-11-03', debut: '06:00', fin: '14:20' },
    ]
    const resultat = chercher([presque], { vacations })
    expect(resultat.possibles).toHaveLength(1)
    expect(resultat.possibles[0]?.reserves.join(' ')).toMatch(/contrat/)
  })

  it('sollicite en premier qui l’a le moins été', () => {
    const peu = personne({ id: 'peu' })
    const beaucoup = personne({
      id: 'beaucoup',
      compteursEquite: { samedisTravailles: 25, dimanchesTravailles: 12, fermetures: 10, feriesTravailles: 3 },
    })
    const resultat = chercher([beaucoup, peu])
    expect(resultat.possibles[0]?.collaborateur.id).toBe('peu')
  })

  it('signale qui n’a pas donné son accord pour être contacté', () => {
    const resultat = chercher([personne({ id: 'a', contactAutorise: false })])
    expect(resultat.possibles[0]?.reserves.join(' ')).toContain('accord')
  })

  it('valorise qui accepte d’être contacté', () => {
    const resultat = chercher([personne({ id: 'a', contactAutorise: true })])
    expect(resultat.possibles[0]?.atouts).toContain('Accepte d’être contacté')
  })

  it('donne toujours au moins un atout à chaque proposition', () => {
    const resultat = chercher([personne({ id: 'a' }), personne({ id: 'b' })])
    for (const remplacant of resultat.possibles) {
      expect(remplacant.atouts.length).toBeGreaterThan(0)
    }
  })

  it('rend le même classement à données égales', () => {
    const equipe = [personne({ id: 'a' }), personne({ id: 'b' }), personne({ id: 'c' })]
    expect(chercher(equipe).possibles.map((r) => r.collaborateur.id)).toEqual(
      chercher([...equipe].reverse()).possibles.map((r) => r.collaborateur.id),
    )
  })
})
