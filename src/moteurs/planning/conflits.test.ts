import { describe, expect, it } from 'vitest'
import { clientsParTranche, rayonParId, tranchesOuvertes } from '../../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../../donnees/demo'
import { RENFORTS_DEMO } from '../../donnees/vivier-demo'
import { calculerBesoin, type BesoinJour } from '../besoin'
import { chercherLesConflits } from './conflits'

/** Donnees FICTIVES uniquement. */

const JOUR = '2026-11-03'

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

function conflits(rayonId = 'boucherie', vacations: Parameters<typeof chercherLesConflits>[0]['vacations'] = []) {
  return chercherLesConflits({
    besoins: [besoinDuRayon(rayonId)],
    vacations,
    collaborateurs: COLLABORATEURS_DEMO,
    absences: [],
    renforts: RENFORTS_DEMO,
    nomDuRayon: (identifiant) => rayonParId(MAGASIN_DEMO, identifiant)?.nom ?? identifiant,
  })
}

describe('conflits', () => {
  it('signale un rayon entièrement découvert', () => {
    const trouves = conflits()
    expect(trouves.length).toBeGreaterThan(0)
    expect(trouves.some((conflit) => conflit.nature === 'manque-de-monde')).toBe(true)
  })

  it('met les compétences critiques en premier', () => {
    const trouves = conflits()
    const critiques = trouves.filter((c) => c.nature === 'competence-critique')
    expect(critiques.length).toBeGreaterThan(0)
    expect(trouves[0]?.nature).toBe('competence-critique')
  })

  it('écrit des libellés lisibles, avec le rayon et l’heure', () => {
    const trouves = conflits()
    expect(trouves[0]?.libelle).toMatch(/^Boucherie, \d{2}:\d{2}–\d{2}:\d{2} :/)
  })

  it('regroupe les quarts d’heure consécutifs en une seule plage', () => {
    const trouves = conflits()
    const longues = trouves.filter((c) => c.finMinutes - c.debutMinutes > 60)
    expect(longues.length).toBeGreaterThan(0)
  })

  it('ne propose rien quand tout est couvert', () => {
    // Un rayon ferme ce jour-la n'a aucun besoin, donc aucun conflit.
    const lundi = chercherLesConflits({
      besoins: [
        calculerBesoin(CONFIGURATIONS_DEMO.find((c) => c.rayonId === 'maree') as never, {
          date: '2026-11-02',
          clientsParTranche: clientsParTranche(MAGASIN_DEMO, '2026-11-02'),
          tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, '2026-11-02', 'maree'),
          meteo: 'normal',
          coefficientEvenements: 1,
          enPromotion: false,
          saisiesQualite: [],
        }),
      ],
      vacations: [],
      collaborateurs: COLLABORATEURS_DEMO,
      absences: [],
      renforts: RENFORTS_DEMO,
      nomDuRayon: (identifiant) => identifiant,
    })
    expect(lundi).toEqual([])
  })
})

describe('solutions classées', () => {
  it('classe du moins coûteux au plus coûteux', () => {
    for (const conflit of conflits()) {
      const couts = conflit.solutions.map((solution) => solution.cout)
      expect(couts).toEqual([...couts].sort((a, b) => a - b))
    }
  })

  it('propose un prêt avant un renfort extérieur', () => {
    const avecCompetence = conflits().find((conflit) =>
      conflit.solutions.some((solution) => solution.nature === 'pret'),
    )
    expect(avecCompetence).toBeDefined()
    if (avecCompetence === undefined) return

    const rangPret = avecCompetence.solutions.findIndex((s) => s.nature === 'pret')
    const rangRenfort = avecCompetence.solutions.findIndex((s) => s.nature === 'renfort-exterieur')
    if (rangRenfort >= 0) expect(rangPret).toBeLessThan(rangRenfort)
  })

  it('ne prête que quelqu’un qui a vraiment la compétence', () => {
    const critique = conflits().find((conflit) => conflit.nature === 'competence-critique')
    expect(critique).toBeDefined()
    if (critique === undefined || critique.competence === undefined) return

    for (const solution of critique.solutions) {
      if (solution.nature !== 'pret' || solution.collaborateurId === undefined) continue
      const collaborateur = COLLABORATEURS_DEMO.find((c) => c.id === solution.collaborateurId)
      expect(collaborateur?.competences[critique.competence] ?? 0).toBeGreaterThanOrEqual(2)
    }
  })

  it('propose de former quelqu’un du rayon quand une compétence manque', () => {
    const critique = conflits().find((conflit) => conflit.nature === 'competence-critique')
    const formation = critique?.solutions.find((solution) => solution.nature === 'formation')
    expect(formation).toBeDefined()
    expect(formation?.detail).toContain('chaque semaine')
  })

  it('donne le même résultat à données égales', () => {
    expect(conflits()).toEqual(conflits())
  })
})

describe('prêts dans un rayon piloté par sa grille', () => {
  it('ne dépasse jamais la fermeture, et ne prête que ceux qui y travaillent', async () => {
    const { construireEtatReel } = await import('../../donnees/import-equipe')
    const { RAYON } = await import('../../donnees/modele-la-vaugine')
    const { enMinutes } = await import('../../domaine/temps')
    // Equipe FICTIVE : deux poissonniers, un preparateur.
    const etat = construireEtatReel([
      { prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
      { prenom: 'Bérénice', statut: 'employe', heures: 36.75, principaux: [RAYON.charcuterieFromage], secondaires: [RAYON.maree] },
      { prenom: 'Cyril', statut: 'employe', heures: 36.75, principaux: [RAYON.preparationTraiteur] },
    ])
    const configuration = etat.configurations.find((c) => c.rayonId === RAYON.maree)!
    const besoin = calculerBesoin(configuration, {
      date: JOUR,
      clientsParTranche: new Array<number>(96).fill(0),
      tranchesOuvertes: new Set(),
      meteo: 'normal',
      coefficientEvenements: 1,
      enPromotion: false,
      saisiesQualite: [],
    })
    const abel = etat.collaborateurs.find((c) => c.prenom === 'Abel')!
    // Abel tient la maree de 6 h 30 a 19 h 30 : il manque quelqu'un de 19 h 30 a 20 h.
    const trouves = chercherLesConflits({
      besoins: [besoin],
      vacations: [
        { id: 'v', collaborateurId: abel.id, rayonId: RAYON.maree, jour: JOUR, debut: '06:30', fin: '19:30', pauseMinutes: 0 },
      ],
      collaborateurs: etat.collaborateurs,
      absences: [],
      renforts: [],
      nomDuRayon: (id) => id,
      rayons: etat.magasin.rayons,
    })
    const soir = trouves.find((c) => c.debutMinutes === enMinutes('19:30'))
    expect(soir).toBeDefined()
    const prets = soir!.solutions.filter((s) => s.nature === 'pret')
    expect(prets.length).toBeGreaterThan(0)
    for (const pret of prets) {
      expect(enMinutes(pret.fin ?? '23:59')).toBeLessThanOrEqual(enMinutes('20:00'))
      expect(pret.debut).toBe('17:00')
    }
    // Le preparateur n'est jamais propose en maree.
    expect(prets.some((p) => p.libelle.includes('Cyril'))).toBe(false)
    expect(prets.some((p) => p.libelle.includes('Bérénice'))).toBe(true)
  })
})
