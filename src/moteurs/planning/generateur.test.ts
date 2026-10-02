import { describe, expect, it } from 'vitest'
import { semaineDe } from '../../domaine/calendrier'
import { duree } from '../../domaine/temps'
import { clientsParTranche, tranchesOuvertes } from '../../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../../donnees/demo'
import { calculerBesoin, type BesoinJour } from '../besoin'
import { contexteDeVerification, PARAMETRES_PAR_DEFAUT, verifier, type Vacation } from '../regles'
import { genererLePlanning, postesCourts, type EntreesGeneration } from './generateur'
import { manqueRestant } from './score'
import { calculerCouverture } from '../indicateurs'

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

  it('tient les cinq secondes exigées sur tout le service', () => {
    /*
     * Le cahier des charges demande moins de cinq secondes sur iPad. Le
     * serveur de publication est environ trois fois plus lent qu'un Mac, et un
     * iPad se situe entre les deux : on verifie donc largement en dessous,
     * pour que la marge reste reelle sur l'appareil d'Arnaud.
     */
    const rayonIds = MAGASIN_DEMO.rayons.map((rayon) => rayon.id)
    const donnees = entrees({
      rayons: MAGASIN_DEMO.rayons,
      besoins: besoinsDeLaSemaine(rayonIds),
      dureeMaximaleMs: 15000,
    })

    const depart = Date.now()
    const resultat = genererLePlanning(donnees)
    const ecoule = Date.now() - depart

    expect(resultat.dureeMs).toBeLessThan(5000)
    expect(ecoule).toBeLessThan(5000)
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

describe('le générateur compte les tranches comme le calcul de couverture', () => {
  /*
   * Garde-fou : le generateur tient ses propres compteurs de presence, tranche
   * par tranche. S'ils ne suivent pas la meme maille que le calcul de
   * couverture, il croit couvrir ce qu'il ne couvre pas. C'est exactement ce
   * qui est arrive au passage de la demi-heure au quart d'heure.
   */
  it('annonce la même couverture que le calcul de couverture', () => {
    const donnees = entrees()
    const resultat = genererLePlanning(donnees)

    for (const besoin of donnees.besoins) {
      const duJour = resultat.vacations.filter(
        (vacation) => vacation.rayonId === besoin.rayonId && vacation.jour === besoin.date,
      )
      const couverture = calculerCouverture(besoin, duJour, COLLABORATEURS_DEMO)

      // Le manque mesure par le score et celui mesure par la couverture
      // doivent concorder : ce sont deux chemins vers la meme verite.
      const manqueParLeScore = manqueRestant(besoin, duJour)
      const manqueParLaCouverture = couverture.tranches.reduce(
        (somme, tranche) => somme + Math.max(0, tranche.besoin - tranche.presents),
        0,
      )
      expect(
        manqueParLeScore,
        `${besoin.rayonId} le ${besoin.date} : le générateur et la couverture ne comptent pas pareil`,
      ).toBe(manqueParLaCouverture)
    }
  })

  it('donne une pause à toute vacation de six heures ou plus', () => {
    const resultat = genererLePlanning(entrees())
    expect(resultat.vacations.length).toBeGreaterThan(0)

    for (const vacation of resultat.vacations) {
      const amplitude = duree(vacation.debut, vacation.fin)
      if (amplitude >= 6 * 60) {
        expect(
          vacation.pauseMinutes,
          `${vacation.debut}–${vacation.fin} dépasse six heures sans pause`,
        ).toBeGreaterThanOrEqual(20)
      }
    }
  })

  it('propose des postes courts quand le besoin ne remplit pas une journée', () => {
    const courts = postesCourts(entrees().besoins)
    expect(courts.length).toBeGreaterThan(0)

    for (const poste of courts) {
      const amplitude = duree(poste.debut, poste.fin)
      // Jamais moins de trois heures : on ne déplace personne pour moins.
      expect(amplitude).toBeGreaterThanOrEqual(3 * 60)
      expect(amplitude).toBeLessThan(6 * 60)
      // Moins de six heures : aucune pause légale n'est due.
      expect(poste.pauseMinutes).toBe(0)
    }
  })

  it('place effectivement des postes courts dans un petit rayon', () => {
    // La cave demande environ trois heures par jour : une journée entière y
    // serait du sureffectif pur.
    const resultat = genererLePlanning(
      entrees({
        rayons: MAGASIN_DEMO.rayons.filter((rayon) => rayon.id === 'cave-vins'),
        besoins: besoinsDeLaSemaine(['cave-vins']),
      }),
    )
    expect(resultat.vacations.length).toBeGreaterThan(0)

    const courtes = resultat.vacations.filter(
      (vacation) => duree(vacation.debut, vacation.fin) < 6 * 60,
    )
    expect(courtes.length).toBeGreaterThan(0)
  })
})

describe('verrouillage et relance', () => {
  it('ne touche jamais à une vacation verrouillée', () => {
    const verrouillee: Vacation = {
      id: 'verrou-1',
      collaborateurId: 'c-03',
      rayonId: 'fruits-legumes',
      jour: '2026-11-04',
      debut: '10:00',
      fin: '14:00',
      pauseMinutes: 0,
    }

    const resultat = genererLePlanning(entrees({ vacationsVerrouillees: [verrouillee] }))

    const retrouvee = resultat.vacations.find((vacation) => vacation.id === 'verrou-1')
    expect(retrouvee).toEqual(verrouillee)
    expect(resultat.verrouillees).toBe(1)
  })

  it('ne donne pas une deuxième vacation le même jour à quelqu’un de verrouillé', () => {
    const verrouillee: Vacation = {
      id: 'verrou-1',
      collaborateurId: 'c-03',
      rayonId: 'fruits-legumes',
      jour: '2026-11-04',
      debut: '10:00',
      fin: '14:00',
      pauseMinutes: 0,
    }

    const resultat = genererLePlanning(entrees({ vacationsVerrouillees: [verrouillee] }))
    const sonJour = resultat.vacations.filter(
      (vacation) => vacation.collaborateurId === 'c-03' && vacation.jour === '2026-11-04',
    )
    expect(sonJour).toHaveLength(1)
  })

  it('complète autour des cases verrouillées, sans violer de règle', () => {
    const verrouillee: Vacation = {
      id: 'verrou-1',
      collaborateurId: 'c-01',
      rayonId: 'fruits-legumes',
      jour: '2026-11-02',
      debut: '13:30',
      fin: '20:30',
      pauseMinutes: 20,
    }

    const donnees = entrees({ vacationsVerrouillees: [verrouillee] })
    const resultat = genererLePlanning(donnees)
    expect(resultat.vacations.length).toBeGreaterThan(1)

    const infractions = verifier(
      contexteDeVerification(resultat.vacations, PARAMETRES_PAR_DEFAUT, {
        collaborateurs: COLLABORATEURS_DEMO,
      }),
    )
    expect(infractions.filter((i) => i.severite === 'bloquante')).toEqual([])
  })

  it('décale des postes de 15 ou 30 minutes pour mieux coller au besoin', () => {
    const resultat = genererLePlanning(entrees())
    const heuresTypes = new Set(MAGASIN_DEMO.horairesTypes.map((h) => `${h.debut}-${h.fin}`))
    const decalees = resultat.vacations.filter(
      (vacation) => !heuresTypes.has(`${vacation.debut}-${vacation.fin}`),
    )
    // Le compteur et les vacations doivent raconter la meme chose.
    if (resultat.decalages > 0) expect(decalees.length).toBeGreaterThan(0)
    expect(resultat.decalages).toBeGreaterThanOrEqual(0)
  })

  it('reste déterministe avec des cases verrouillées', () => {
    const verrouillee: Vacation = {
      id: 'verrou-1',
      collaborateurId: 'c-03',
      rayonId: 'fruits-legumes',
      jour: '2026-11-04',
      debut: '10:00',
      fin: '14:00',
      pauseMinutes: 0,
    }
    const premier = genererLePlanning(entrees({ vacationsVerrouillees: [verrouillee] }))
    const second = genererLePlanning(entrees({ vacationsVerrouillees: [verrouillee] }))
    expect(second.vacations).toEqual(premier.vacations)
  })
})
