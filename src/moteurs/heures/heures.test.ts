import { describe, expect, it } from 'vitest'
import { estFerie, joursFeriesDeLAnnee, paques } from '../../domaine/calendrier'
import type { Collaborateur } from '../../domaine/collaborateur'
import { PARAMETRES_PAR_DEFAUT, type Vacation } from '../regles'
import {
  calculerLesElementsVariables,
  exporterEnCsv,
  minutesRealisees,
  totaliser,
  type SaisieHeures,
} from './index'

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

function vacation(jour: string, debut = '06:00', fin = '13:20', pause = 20): Vacation {
  return {
    id: `v-${jour}-${debut}`,
    collaborateurId: 'c-01',
    rayonId: 'fruits-legumes',
    jour,
    debut,
    fin,
    pauseMinutes: pause,
  }
}

/** Semaine du lundi 2 au vendredi 6 novembre 2026 : cinq jours de 7 h. */
const SEMAINE = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((j) =>
  vacation(j),
)

describe('jours fériés', () => {
  it('calcule Pâques correctement', () => {
    expect(paques(2026)).toBe('2026-04-05')
    expect(paques(2027)).toBe('2027-03-28')
    expect(paques(2024)).toBe('2024-03-31')
  })

  it('donne les onze jours fériés français', () => {
    const feries = joursFeriesDeLAnnee(2026)
    expect(feries).toHaveLength(11)
    expect(feries.map((f) => f.nom)).toContain('Fête du Travail')
    expect(feries.map((f) => f.nom)).toContain('Lundi de Pentecôte')
  })

  it('place correctement les fêtes mobiles de 2026', () => {
    const feries = joursFeriesDeLAnnee(2026)
    expect(feries.find((f) => f.nom === 'Lundi de Pâques')?.date).toBe('2026-04-06')
    expect(feries.find((f) => f.nom === 'Ascension')?.date).toBe('2026-05-14')
    expect(feries.find((f) => f.nom === 'Lundi de Pentecôte')?.date).toBe('2026-05-25')
  })

  it('reconnaît une date fériée', () => {
    expect(estFerie('2026-12-25')).toBe(true)
    expect(estFerie('2026-12-26')).toBe(false)
  })
})

describe('heures réalisées', () => {
  it('reprend le prévu quand rien n’est saisi', () => {
    expect(minutesRealisees(SEMAINE, [], 'c-01', '2026-11-02')).toBe(420)
  })

  it('laisse la saisie l’emporter sur le prévu', () => {
    const saisies: SaisieHeures[] = [
      { id: 's1', collaborateurId: 'c-01', jour: '2026-11-02', minutesRealisees: 480 },
    ]
    expect(minutesRealisees(SEMAINE, saisies, 'c-01', '2026-11-02')).toBe(480)
  })
})

describe('éléments variables de paie', () => {
  const P = PARAMETRES_PAR_DEFAUT

  it('additionne les heures prévues du mois', () => {
    const elements = calculerLesElementsVariables('2026-11', SEMAINE, [], [personne()], P)
    expect(elements).toHaveLength(1)
    expect(elements[0]?.heuresPrevues).toBeCloseTo(35, 6)
  })

  it('ne compte aucune heure supplémentaire à 35 h', () => {
    const elements = calculerLesElementsVariables('2026-11', SEMAINE, [], [personne()], P)
    expect(elements[0]?.heuresSupplementaires25).toBe(0)
    expect(elements[0]?.heuresSupplementaires50).toBe(0)
  })

  it('majore à 25 % les heures entre 35 h et 43 h', () => {
    // Six jours de 7 h = 42 h : 7 h supplementaires a 25 %.
    const six = [...SEMAINE, vacation('2026-11-07')]
    const elements = calculerLesElementsVariables('2026-11', six, [], [personne()], P)
    expect(elements[0]?.heuresSupplementaires25).toBeCloseTo(7, 6)
    expect(elements[0]?.heuresSupplementaires50).toBe(0)
  })

  it('majore à 50 % au-delà de 43 h', () => {
    // Six jours de 8 h = 48 h : 8 h a 25 % et 5 h a 50 %.
    const six = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
      .map((j) => vacation(j, '06:00', '14:20'))
    const elements = calculerLesElementsVariables('2026-11', six, [], [personne()], P)
    expect(elements[0]?.heuresSupplementaires25).toBeCloseTo(8, 6)
    expect(elements[0]?.heuresSupplementaires50).toBeCloseTo(5, 6)
  })

  it('compte des heures complémentaires pour un temps partiel', () => {
    const partiel = personne({ heuresHebdomadaires: 24, tempsPlein: false })
    const elements = calculerLesElementsVariables('2026-11', SEMAINE, [], [partiel], P)
    expect(elements[0]?.heuresComplementaires).toBeCloseTo(11, 6)
    expect(elements[0]?.heuresSupplementaires25).toBe(0)
  })

  it('compte les heures de nuit', () => {
    const nuit = [vacation('2026-11-02', '04:00', '11:20')]
    const elements = calculerLesElementsVariables('2026-11', nuit, [], [personne()], P)
    // La nuit legale va de 21 h a 6 h : de 04:00 a 06:00, deux heures.
    expect(elements[0]?.heuresDeNuit).toBeCloseTo(2, 6)
  })

  it('suit le paramètre, et non une valeur écrite en dur', () => {
    const nuit = [vacation('2026-11-02', '04:00', '11:20')]
    const avecNuitPlusCourte = { ...P, nuitFin: '05:00' }
    const elements = calculerLesElementsVariables(
      '2026-11',
      nuit,
      [],
      [personne()],
      avecNuitPlusCourte,
    )
    expect(elements[0]?.heuresDeNuit).toBeCloseTo(1, 6)
  })

  it('compte les dimanches et les jours fériés travaillés', () => {
    const special = [
      vacation('2026-11-08'), // un dimanche
      vacation('2026-11-11'), // Armistice
    ]
    const elements = calculerLesElementsVariables('2026-11', special, [], [personne()], P)
    expect(elements[0]?.dimanchesTravailles).toBe(1)
    expect(elements[0]?.joursFeriesTravailles).toBe(1)
    expect(elements[0]?.heuresFeriesTravaillees).toBeCloseTo(7, 6)
  })

  it('mesure l’écart entre le réalisé et le prévu', () => {
    const saisies: SaisieHeures[] = [
      { id: 's1', collaborateurId: 'c-01', jour: '2026-11-02', minutesRealisees: 480 },
    ]
    const elements = calculerLesElementsVariables('2026-11', SEMAINE, saisies, [personne()], P)
    expect(elements[0]?.ecart).toBeCloseTo(1, 6)
  })

  it('ignore les personnes sans aucune heure', () => {
    const elements = calculerLesElementsVariables(
      '2026-11',
      SEMAINE,
      [],
      [personne(), personne({ id: 'c-02', prenom: 'Mathieu' })],
      P,
    )
    expect(elements).toHaveLength(1)
  })

  it('ne retient que le mois demandé', () => {
    const deuxMois = [...SEMAINE, vacation('2026-12-01')]
    const elements = calculerLesElementsVariables('2026-12', deuxMois, [], [personne()], P)
    expect(elements[0]?.heuresPrevues).toBeCloseTo(7, 6)
  })
})

describe('export pour la paie', () => {
  it('produit un CSV lisible par un tableur français', () => {
    const elements = calculerLesElementsVariables(
      '2026-11',
      SEMAINE,
      [],
      [personne()],
      PARAMETRES_PAR_DEFAUT,
    )
    const csv = exporterEnCsv(elements)

    expect(csv.split('\r\n')[0]).toContain('Collaborateur;Mois;Heures prévues')
    expect(csv).toContain('Camille D.')
    // Virgule decimale et point-virgule : ce qu'attend un tableur francais.
    expect(csv).toContain('35,00')
  })

  it('n’exporte que prénom et initiale', () => {
    const elements = calculerLesElementsVariables(
      '2026-11',
      SEMAINE,
      [],
      [personne()],
      PARAMETRES_PAR_DEFAUT,
    )
    expect(exporterEnCsv(elements)).not.toMatch(/[A-ZÉÈ][a-zéèê]{3,}\s[A-Z][a-zéèê]{3,}/)
  })

  it('totalise le mois', () => {
    const elements = calculerLesElementsVariables(
      '2026-11',
      SEMAINE,
      [],
      [personne()],
      PARAMETRES_PAR_DEFAUT,
    )
    expect(totaliser(elements).heuresPrevues).toBeCloseTo(35, 6)
  })
})
