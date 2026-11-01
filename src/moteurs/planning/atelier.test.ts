import { describe, expect, it } from 'vitest'
import { semaineDe } from '../../domaine/calendrier'
import { tranchesOuvertes } from '../../domaine/magasin'
import { construireEtatReel } from '../../donnees/import-equipe'
import { RAYON } from '../../donnees/modele-la-vaugine'
import { calculerBesoin } from '../besoin'
import { PARAMETRES_PAR_DEFAUT, type Vacation } from '../regles'
import { bilanDuRayon, fusionnerLeRayon, postesFigesPourUnRayon } from './atelier'
import { genererLePlanning } from './generateur'

/** Equipe ENTIEREMENT FICTIVE. */
const SEMAINE = '2026-11-02'
const etat = construireEtatReel([
  { prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
  { prenom: 'Bérénice', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
  { prenom: 'Cyril', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
  { prenom: 'Delphine', statut: 'employe', heures: 39, principaux: [RAYON.charcuterieFromage], secondaires: [RAYON.maree] },
  { prenom: 'Eugène', statut: 'employe', heures: 36.75, principaux: [RAYON.charcuterieFromage], depannage: [RAYON.maree] },
])
const besoins = semaineDe(SEMAINE).flatMap((date) =>
  etat.configurations.map((c) =>
    calculerBesoin(c, {
      date,
      clientsParTranche: new Array<number>(96).fill(0),
      tranchesOuvertes: tranchesOuvertes(etat.magasin, date, c.rayonId),
      meteo: 'normal',
      coefficientEvenements: 1,
      enPromotion: false,
      saisiesQualite: [],
    }),
  ),
)
const delphine = etat.collaborateurs.find((c) => c.prenom === 'Delphine')!
const enCharcuterie: Vacation = {
  id: 'cf', collaborateurId: delphine.id, rayonId: RAYON.charcuterieFromage, jour: SEMAINE,
  debut: '07:00', fin: '15:00', pauseMinutes: 24, pauseDebut: '10:00',
}

describe('bilan d’un rayon', () => {
  const bilan = bilanDuRayon({
    rayonId: RAYON.maree,
    semaine: SEMAINE,
    besoins,
    vacations: [enCharcuterie],
    collaborateurs: etat.collaborateurs,
    absences: [{ id: 'cp', collaborateurId: etat.collaborateurs[0]!.id, debut: '2026-11-03', fin: '2026-11-03', type: 'conge-paye', prevue: true }],
    pausesPayees: true,
    joursOuvrables: 6,
  })

  it('compte les heures exigées et souhaitées de la grille', () => {
    expect(bilan.heuresMinimum).toBeGreaterThan(70)
    expect(bilan.heuresCible).toBeGreaterThanOrEqual(bilan.heuresMinimum)
  })

  it('liste titulaires, renforts puis dépannage, avec leurs heures restantes', () => {
    expect(bilan.personnes.map((p) => [p.collaborateur.prenom, p.rang])).toEqual([
      ['Abel', 'principal'],
      ['Bérénice', 'principal'],
      ['Cyril', 'principal'],
      ['Delphine', 'secondaire'],
      ['Eugène', 'depannage'],
    ])
    const abel = bilan.personnes[0]!
    expect(abel.visees).toBeCloseTo((36.75 * 5) / 6, 5)
    expect(abel.joursImpossibles).toEqual(['2026-11-03'])
    const d = bilan.personnes[3]!
    expect(d.ailleurs).toBe(8)
    expect(d.restantes).toBe(31)
  })

  it('ne compte pas le dépannage dans les heures disponibles', () => {
    const attendu = bilan.personnes.filter((p) => p.rang !== 'depannage').reduce((s, p) => s + p.ici + p.restantes, 0)
    expect(bilan.heuresDisponibles).toBeCloseTo(attendu, 5)
    expect(bilan.solde).toBeCloseTo(bilan.heuresDisponibles - bilan.heuresCible, 5)
  })
})

describe('générer un seul rayon', () => {
  it('recalcule le rayon sans toucher aux autres, en comptant leurs heures', () => {
    const avant: Vacation[] = [enCharcuterie]
    const figes = postesFigesPourUnRayon(RAYON.maree, avant, new Set())
    const resultat = genererLePlanning({
      semaine: SEMAINE,
      rayons: etat.magasin.rayons.filter((r) => r.id === RAYON.maree),
      besoins: besoins.filter((b) => b.rayonId === RAYON.maree),
      collaborateurs: etat.collaborateurs,
      absences: [],
      horairesTypes: etat.magasin.horairesTypes,
      parametres: PARAMETRES_PAR_DEFAUT,
      reglesInternes: etat.organisation.reglesInternes,
      plagesAffluence: etat.organisation.plagesAffluence,
      vacationsVerrouillees: figes,
      dureeMaximaleMs: 8000,
    })
    const apres = fusionnerLeRayon(RAYON.maree, avant, resultat.vacations, new Set())
    expect(apres).toContainEqual(enCharcuterie)
    expect(apres.filter((v) => v.rayonId !== RAYON.maree)).toEqual([enCharcuterie])
    expect(apres.some((v) => v.rayonId === RAYON.maree)).toBe(true)
    // Delphine ne travaille pas deux fois le lundi.
    expect(apres.filter((v) => v.collaborateurId === delphine.id && v.jour === SEMAINE)).toHaveLength(1)
  })
})
