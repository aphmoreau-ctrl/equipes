import { describe, expect, it } from 'vitest'
import { enMinutes } from '../../domaine/temps'
import { clientsParTranche, tranchesOuvertes } from '../../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../../donnees/demo'
import { calculerBesoin, type BesoinJour } from '../besoin'
import type { Vacation } from '../regles'
import { construireLesFeuilles, plageEnTexte } from './feuilles'

/** Donnees FICTIVES uniquement. */

const JOUR = '2026-11-03' // un mardi

function besoinDuRayon(rayonId: string): BesoinJour {
  const configuration = CONFIGURATIONS_DEMO.find((c) => c.rayonId === rayonId)
  if (configuration === undefined) throw new Error(`Rayon « ${rayonId} » introuvable.`)
  return calculerBesoin(configuration, {
    date: JOUR,
    clientsParTranche: clientsParTranche(MAGASIN_DEMO, JOUR),
    tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, JOUR, rayonId),
    meteo: 'normal',
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  })
}

function vacation(partiel: Partial<Vacation> & Pick<Vacation, 'collaborateurId'>): Vacation {
  return {
    id: `v-${partiel.collaborateurId}`,
    rayonId: 'fruits-legumes',
    jour: JOUR,
    debut: '05:30',
    fin: '12:30',
    pauseMinutes: 20,
    ...partiel,
  }
}

function feuilles(vacations: readonly Vacation[], rayonId = 'fruits-legumes') {
  return construireLesFeuilles({
    jour: JOUR,
    vacations,
    besoins: [besoinDuRayon(rayonId)],
    configurations: CONFIGURATIONS_DEMO,
    collaborateurs: COLLABORATEURS_DEMO,
  })
}

describe('feuilles de route', () => {
  it('donne une feuille à chaque personne présente', () => {
    const resultat = feuilles([vacation({ collaborateurId: 'c-01' })])
    expect(resultat.feuilles).toHaveLength(1)
    expect(resultat.feuilles[0]?.collaborateurId).toBe('c-01')
    expect(resultat.feuilles[0]?.lignes.length).toBeGreaterThan(0)
  })

  it('n’affecte jamais deux tâches à la même personne au même moment', () => {
    const resultat = feuilles([
      vacation({ collaborateurId: 'c-01' }),
      vacation({ collaborateurId: 'c-02' }),
    ])

    for (const feuille of resultat.feuilles) {
      for (let i = 1; i < feuille.lignes.length; i += 1) {
        const precedente = feuille.lignes[i - 1]
        const courante = feuille.lignes[i]
        if (precedente === undefined || courante === undefined) continue
        expect(courante.debutMinutes).toBeGreaterThanOrEqual(precedente.finMinutes)
      }
    }
  })

  it('rassemble les quarts d’heure consécutifs sur une même tâche', () => {
    const resultat = feuilles([vacation({ collaborateurId: 'c-01' })])
    const lignes = resultat.feuilles[0]?.lignes ?? []
    // Une ligne de plus de quinze minutes prouve que la fusion a eu lieu.
    expect(lignes.some((ligne) => ligne.finMinutes - ligne.debutMinutes > 15)).toBe(true)
  })

  it('ne place aucune tâche en dehors des heures de la vacation', () => {
    const resultat = feuilles([
      vacation({ collaborateurId: 'c-01', debut: '07:00', fin: '14:00' }),
    ])
    for (const ligne of resultat.feuilles[0]?.lignes ?? []) {
      expect(ligne.debutMinutes).toBeGreaterThanOrEqual(enMinutes('07:00'))
      expect(ligne.finMinutes).toBeLessThanOrEqual(enMinutes('14:00'))
    }
  })

  it('signale une tâche que personne ne sait tenir', () => {
    // Sofia B. ne connaît pas la boucherie : le comptoir reste découvert.
    const resultat = feuilles(
      [vacation({ collaborateurId: 'c-03', rayonId: 'boucherie' })],
      'boucherie',
    )
    const comptoir = resultat.nonAffectees.filter((tache) => tache.tacheId === 'bo-comptoir')
    expect(comptoir.length).toBeGreaterThan(0)
    expect(comptoir[0]?.raison).toBe('competence-absente')
  })

  it('signale une tâche que personne n’a le temps de prendre', () => {
    // Une seule personne pour tous les blocs du matin : il en reste.
    const resultat = feuilles([vacation({ collaborateurId: 'c-01' })])
    expect(resultat.nonAffectees.some((tache) => tache.raison === 'personne-de-libre')).toBe(true)
  })

  it('confie le comptoir boucherie à un boucher, jamais à quelqu’un d’autre', () => {
    const resultat = feuilles(
      [
        vacation({ collaborateurId: 'c-06', rayonId: 'boucherie', debut: '07:00', fin: '14:00' }),
        vacation({ collaborateurId: 'c-03', rayonId: 'boucherie', debut: '07:00', fin: '14:00' }),
      ],
      'boucherie',
    )

    const surLeComptoir = resultat.feuilles.filter((feuille) =>
      feuille.lignes.some((ligne) => ligne.tacheId === 'bo-comptoir'),
    )
    for (const feuille of surLeComptoir) {
      expect(feuille.collaborateurId).toBe('c-06')
    }
  })

  it('donne le même résultat à données égales', () => {
    const vacations = [
      vacation({ collaborateurId: 'c-01' }),
      vacation({ collaborateurId: 'c-02' }),
      vacation({ collaborateurId: 'c-05' }),
    ]
    expect(feuilles(vacations)).toEqual(feuilles(vacations))
  })

  it('écrit les plages à la française', () => {
    const resultat = feuilles([vacation({ collaborateurId: 'c-01' })])
    const ligne = resultat.feuilles[0]?.lignes[0]
    expect(ligne).toBeDefined()
    if (ligne === undefined) return
    expect(plageEnTexte(ligne)).toMatch(/^\d{2}:\d{2} – \d{2}:\d{2}$/)
  })
})
