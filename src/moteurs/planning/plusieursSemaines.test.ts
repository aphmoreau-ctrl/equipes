import { describe, expect, it } from 'vitest'
import { ajouterJours, semaineDe } from '../../domaine/calendrier'
import { clientsParTranche, tranchesOuvertes } from '../../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../../donnees/demo'
import { calculerBesoin } from '../besoin'
import { contexteDeVerification, PARAMETRES_PAR_DEFAUT, verifier } from '../regles'
import { genererPlusieursSemaines } from './plusieursSemaines'

/** Donnees FICTIVES uniquement. */

const PREMIERE = '2026-11-02'
const RAYONS = MAGASIN_DEMO.rayons.filter((rayon) => rayon.id === 'fruits-legumes')

function besoinDuJour(date: string, rayonId: string) {
  const configuration = CONFIGURATIONS_DEMO.find((c) => c.rayonId === rayonId)
  if (configuration === undefined) throw new Error(`Rayon « ${rayonId} » introuvable.`)
  return calculerBesoin(configuration, {
    date,
    clientsParTranche: clientsParTranche(MAGASIN_DEMO, date),
    tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, date, rayonId),
    meteo: 'normal' as const,
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  })
}

function entrees(nombreDeSemaines: number) {
  return {
    semaines: Array.from({ length: nombreDeSemaines }, (_, numero) => {
      const semaine = ajouterJours(PREMIERE, numero * 7)
      return {
        semaine,
        besoins: semaineDe(semaine).flatMap((jour) =>
          RAYONS.map((rayon) => besoinDuJour(jour, rayon.id)),
        ),
      }
    }),
    rayons: RAYONS,
    collaborateurs: COLLABORATEURS_DEMO,
    absences: [],
    horairesTypes: MAGASIN_DEMO.horairesTypes,
    parametres: PARAMETRES_PAR_DEFAUT,
    dureeMaximaleMs: 3000,
  }
}

describe('plusieurs semaines à l’avance', () => {
  it('construit chaque semaine demandée', () => {
    const resultat = genererPlusieursSemaines(entrees(3))
    expect(resultat.semaines.map((s) => s.semaine)).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ])
    for (const semaine of resultat.semaines) {
      expect(semaine.resultat.vacations.length).toBeGreaterThan(0)
    }
  })

  it('ne place chaque vacation que dans sa propre semaine', () => {
    const resultat = genererPlusieursSemaines(entrees(2))
    for (const { semaine, resultat: construit } of resultat.semaines) {
      const jours = new Set(semaineDe(semaine))
      for (const vacation of construit.vacations) {
        expect(jours.has(vacation.jour)).toBe(true)
      }
    }
  })

  it('n’enfreint aucune règle bloquante, y compris entre deux semaines', () => {
    const resultat = genererPlusieursSemaines(entrees(3))
    const toutes = resultat.semaines.flatMap((s) => s.resultat.vacations)

    const infractions = verifier(
      contexteDeVerification(toutes, PARAMETRES_PAR_DEFAUT, {
        collaborateurs: COLLABORATEURS_DEMO,
      }),
    )
    const bloquantes = infractions.filter((i) => i.severite === 'bloquante')
    expect(
      bloquantes.map((i) => `${i.regle} ${i.jour} ${i.libelle}`),
      'la jonction entre deux semaines doit être contrôlée comme le reste',
    ).toEqual([])
  })

  it('répartit les samedis au lieu de les donner toujours au même', () => {
    const resultat = genererPlusieursSemaines(entrees(4))
    const toutes = resultat.semaines.flatMap((s) => s.resultat.vacations)

    const samedis = toutes.filter((vacation) =>
      ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'].includes(vacation.jour),
    )
    const personnes = new Set(samedis.map((vacation) => vacation.collaborateurId))
    // Plusieurs personnes doivent avoir pris un samedi, pas une seule.
    expect(personnes.size).toBeGreaterThan(1)
  })

  it('rend l’équité constatée sur l’ensemble des semaines', () => {
    const resultat = genererPlusieursSemaines(entrees(2))
    expect(resultat.equite.length).toBeGreaterThan(0)
    const totalDesEcarts = resultat.equite.reduce((somme, p) => somme + p.ecart, 0)
    // Par construction, les ecarts a la moyenne se compensent.
    expect(Math.abs(totalDesEcarts)).toBeLessThan(0.001)
  })

  it('donne le même résultat à données égales', () => {
    const premier = genererPlusieursSemaines(entrees(2))
    const second = genererPlusieursSemaines(entrees(2))
    expect(second.semaines.map((s) => s.resultat.vacations)).toEqual(
      premier.semaines.map((s) => s.resultat.vacations),
    )
  })
})
