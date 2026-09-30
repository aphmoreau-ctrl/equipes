import { describe, expect, it } from 'vitest'
import { semaineDe } from '../../domaine/calendrier'
import { clientsParTranche, tranchesOuvertes } from '../../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../../donnees/demo'
import { calculerBesoin, type BesoinJour } from '../besoin'
import { contexteDeVerification, PARAMETRES_PAR_DEFAUT, verifier } from '../regles'
import { genererLePlanning, type EntreesGeneration } from './generateur'
import { manqueRestant } from './score'

/** Donnees FICTIVES uniquement. */

const SEMAINE = '2026-11-02'

function besoinsDeLaSemaine(rayonIds: readonly string[]): BesoinJour[] {
  const besoins: BesoinJour[] = []
  for (const rayonId of rayonIds) {
    const configuration = CONFIGURATIONS_DEMO.find((c) => c.rayonId === rayonId)
    if (configuration === undefined) continue
    for (const date of semaineDe(SEMAINE)) {
      besoins.push(
        calculerBesoin(configuration, {
          date,
          clientsParTranche: clientsParTranche(MAGASIN_DEMO, date),
          tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, date, rayonId),
          meteo: 'normal',
          coefficientEvenements: 1,
          enPromotion: false,
          saisiesQualite: [],
        }),
      )
    }
  }
  return besoins
}

function entrees(modifications: Partial<EntreesGeneration> = {}): EntreesGeneration {
  const rayonIds = ['fruits-legumes']
  return {
    semaine: SEMAINE,
    rayons: MAGASIN_DEMO.rayons.filter((rayon) => rayonIds.includes(rayon.id)),
    besoins: besoinsDeLaSemaine(rayonIds),
    collaborateurs: COLLABORATEURS_DEMO,
    absences: [],
    horairesTypes: MAGASIN_DEMO.horairesTypes,
    parametres: PARAMETRES_PAR_DEFAUT,
    dureeMaximaleMs: 6000,
    ...modifications,
  }
}

describe('génération d’un planning', () => {
  it('produit des vacations', () => {
    const resultat = genererLePlanning(entrees())
    expect(resultat.vacations.length).toBeGreaterThan(0)
    expect(resultat.dureeMs).toBeGreaterThanOrEqual(0)
  })

  it('ne viole AUCUNE règle légale bloquante', () => {
    const resultat = genererLePlanning(entrees())
    const infractions = verifier(
      contexteDeVerification(resultat.vacations, PARAMETRES_PAR_DEFAUT, {
        collaborateurs: COLLABORATEURS_DEMO,
      }),
    ).filter((infraction) => infraction.severite === 'bloquante')

    expect(infractions.map((i) => `${i.collaborateurId} ${i.libelle}`)).toEqual([])
  })

  it('ne place personne un jour où il s’est déclaré indisponible', () => {
    const resultat = genererLePlanning(entrees())
    for (const vacation of resultat.vacations) {
      const collaborateur = COLLABORATEURS_DEMO.find((c) => c.id === vacation.collaborateurId)!
      const jour = new Date(`${vacation.jour}T00:00:00Z`).getUTCDay()
      const numero = jour === 0 ? 7 : jour
      const disponibilite = collaborateur.disponibilites.find((d) => d.jour === numero)
      expect(disponibilite?.disponible ?? true).toBe(true)
    }
  })

  it('ne place personne dans un rayon où il n’intervient pas', () => {
    const resultat = genererLePlanning(entrees())
    for (const vacation of resultat.vacations) {
      const collaborateur = COLLABORATEURS_DEMO.find((c) => c.id === vacation.collaborateurId)!
      const rayons = [collaborateur.rayonPrincipal, ...collaborateur.rayonsSecondaires]
      expect(rayons).toContain(vacation.rayonId)
    }
  })

  it('ne place personne pendant une absence', () => {
    const absences = [
      {
        id: 'a1',
        collaborateurId: 'c-01',
        debut: '2026-11-02',
        fin: '2026-11-08',
        type: 'conge-paye' as const,
        prevue: true,
      },
    ]
    const resultat = genererLePlanning(entrees({ absences }))
    expect(resultat.vacations.some((v) => v.collaborateurId === 'c-01')).toBe(false)
  })

  it('ne donne qu’une vacation par personne et par jour', () => {
    const resultat = genererLePlanning(entrees())
    const vues = new Set<string>()
    for (const vacation of resultat.vacations) {
      const cle = `${vacation.collaborateurId}|${vacation.jour}`
      expect(vues.has(cle)).toBe(false)
      vues.add(cle)
    }
  })

  it('couvre une bonne part du besoin', () => {
    const donnees = entrees()
    const resultat = genererLePlanning(donnees)

    const manqueAvant = donnees.besoins.reduce((s, b) => s + manqueRestant(b, []), 0)
    const manqueApres = donnees.besoins.reduce((s, b) => s + manqueRestant(b, resultat.vacations), 0)

    expect(manqueApres).toBeLessThan(manqueAvant)
    expect(manqueApres / manqueAvant).toBeLessThan(0.5)
  })

  it('donne le même planning à données égales', () => {
    const premier = genererLePlanning(entrees())
    const second = genererLePlanning(entrees())
    expect(second.vacations).toEqual(premier.vacations)
  })

  it('explique ce qu’il n’a pas su couvrir', () => {
    // Une seule personne disponible : le besoin ne peut pas etre couvert.
    const resultat = genererLePlanning(
      entrees({ collaborateurs: COLLABORATEURS_DEMO.slice(0, 1) }),
    )
    expect(resultat.restesAExpliquer.length).toBeGreaterThan(0)
    expect(resultat.restesAExpliquer[0]).toMatch(/il manque|compétence indispensable/)
  })

  it('respecte le temps de calcul accordé', () => {
    const resultat = genererLePlanning(entrees({ dureeMaximaleMs: 300 }))
    expect(resultat.dureeMs).toBeLessThan(3000)
  })

  it('rend compte du détail des pénalités', () => {
    const resultat = genererLePlanning(entrees())
    expect(resultat.penalites.total).toBeGreaterThanOrEqual(0)
    expect(Object.keys(resultat.penalites)).toContain('manque')
    expect(Object.keys(resultat.penalites)).toContain('ecartAuContrat')
  })
})

describe('compétences critiques', () => {
  it('ne met que des bouchers au comptoir boucherie', () => {
    const rayonIds = ['boucherie']
    const resultat = genererLePlanning(
      entrees({
        rayons: MAGASIN_DEMO.rayons.filter((r) => rayonIds.includes(r.id)),
        besoins: besoinsDeLaSemaine(rayonIds),
      }),
    )

    expect(resultat.vacations.length).toBeGreaterThan(0)
    for (const vacation of resultat.vacations) {
      const collaborateur = COLLABORATEURS_DEMO.find((c) => c.id === vacation.collaborateurId)!
      // Toute personne placee en boucherie doit y etre rattachee.
      expect([collaborateur.rayonPrincipal, ...collaborateur.rayonsSecondaires]).toContain(
        'boucherie',
      )
    }
  })
})

describe('plusieurs rayons à la fois', () => {
  it('construit un planning pour tout le service', () => {
    const rayonIds = MAGASIN_DEMO.rayons.map((rayon) => rayon.id)
    const resultat = genererLePlanning(
      entrees({
        rayons: MAGASIN_DEMO.rayons,
        besoins: besoinsDeLaSemaine(rayonIds),
        dureeMaximaleMs: 8000,
      }),
    )

    expect(resultat.vacations.length).toBeGreaterThan(10)
    const rayonsUtilises = new Set(resultat.vacations.map((v) => v.rayonId))
    expect(rayonsUtilises.size).toBeGreaterThan(2)
  })

  it('ne viole aucune règle même sur tout le service', () => {
    const rayonIds = MAGASIN_DEMO.rayons.map((rayon) => rayon.id)
    const resultat = genererLePlanning(
      entrees({
        rayons: MAGASIN_DEMO.rayons,
        besoins: besoinsDeLaSemaine(rayonIds),
        dureeMaximaleMs: 8000,
      }),
    )
    const bloquantes = verifier(
      contexteDeVerification(resultat.vacations, PARAMETRES_PAR_DEFAUT, {
        collaborateurs: COLLABORATEURS_DEMO,
      }),
    ).filter((infraction) => infraction.severite === 'bloquante')

    expect(bloquantes.map((i) => `${i.collaborateurId} ${i.libelle}`)).toEqual([])
  })
})
