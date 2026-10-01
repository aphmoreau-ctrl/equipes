import { describe, expect, it } from 'vitest'
import type { Collaborateur } from '../../domaine/collaborateur'
import { COLLABORATEURS_DEMO } from '../../donnees/collaborateurs-demo'
import {
  alertesCentralisees,
  alertesDeDependance,
  alertesProchaines,
  calculerAlertes,
  joursEntre,
  REGLAGES_ALERTES_PAR_DEFAUT,
  resumerAlertes,
} from './index'

/** Donnees FICTIVES uniquement. */

function personne(modifications: Partial<Collaborateur> = {}): Collaborateur {
  return {
    id: 'demo-1',
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
    competences: {},
    habilitations: [],
    compteursEquite: {
      samedisTravailles: 0,
      dimanchesTravailles: 0,
      fermetures: 0,
      feriesTravailles: 0,
    },
    estMineur: false,
    contactAutorise: false,
    actif: true,
    ...modifications,
  }
}

const AUJOURD_HUI = '2026-11-02'

describe('calcul du nombre de jours', () => {
  it('compte les jours a venir', () => {
    expect(joursEntre('2026-11-02', '2026-11-09')).toBe(7)
  })

  it('compte negativement une date passee', () => {
    expect(joursEntre('2026-11-02', '2026-10-30')).toBe(-3)
  })

  it('traverse les mois et les annees', () => {
    expect(joursEntre('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('alertes de periode d essai', () => {
  it('signale une fin de periode d essai proche', () => {
    const alertes = calculerAlertes([personne({ finPeriodeEssai: '2026-11-15' })], AUJOURD_HUI)
    expect(alertes).toHaveLength(1)
    expect(alertes[0]?.categorie).toBe('periode-essai')
    expect(alertes[0]?.detail).toContain('dans 13 jours')
  })

  it('ne signale rien tant que l echeance est lointaine', () => {
    expect(calculerAlertes([personne({ finPeriodeEssai: '2027-03-01' })], AUJOURD_HUI)).toEqual([])
  })

  it('marque comme urgente une echeance a moins d une semaine', () => {
    const alertes = calculerAlertes([personne({ finPeriodeEssai: '2026-11-06' })], AUJOURD_HUI)
    expect(alertes[0]?.gravite).toBe('urgent')
  })

  it('marque comme urgente une echeance deja depassee', () => {
    const alertes = calculerAlertes([personne({ finPeriodeEssai: '2026-10-25' })], AUJOURD_HUI)
    expect(alertes[0]?.gravite).toBe('urgent')
    expect(alertes[0]?.detail).toContain('dépassée depuis 8 jours')
  })
})

describe('alertes de fin de contrat', () => {
  it('signale une fin de CDD dans le delai de preavis', () => {
    const alertes = calculerAlertes([personne({ contrat: 'cdd', finContrat: '2026-12-10' })], AUJOURD_HUI)
    expect(alertes.some((alerte) => alerte.categorie === 'fin-contrat')).toBe(true)
  })

  it('respecte un preavis modifie', () => {
    const lointain = personne({ contrat: 'cdd', finContrat: '2027-01-31' })
    expect(calculerAlertes([lointain], AUJOURD_HUI)).toEqual([])
    expect(
      calculerAlertes([lointain], AUJOURD_HUI, {
        ...REGLAGES_ALERTES_PAR_DEFAUT,
        preavisFinContratJours: 120,
      }),
    ).toHaveLength(1)
  })
})

describe('alertes d habilitation', () => {
  it('signale une habilitation qui expire bientot', () => {
    const alertes = calculerAlertes(
      [
        personne({
          habilitations: [
            { id: 'h', nom: 'Formation hygiène', obtenue: '2023-11-20', expire: '2026-11-20' },
          ],
        }),
      ],
      AUJOURD_HUI,
    )
    expect(alertes.some((alerte) => alerte.categorie === 'habilitation')).toBe(true)
  })

  it('ignore une habilitation qui ne se perime pas', () => {
    const alertes = calculerAlertes(
      [personne({ habilitations: [{ id: 'h', nom: 'Permis', obtenue: '2020-01-01', expire: null }] })],
      AUJOURD_HUI,
    )
    expect(alertes).toEqual([])
  })
})

describe('dependance aux competences', () => {
  it('signale une competence tenue par une seule personne', () => {
    const alertes = alertesDeDependance([
      personne({ id: 'a', competences: { 'marée': 3 } }),
      personne({ id: 'b', competences: { 'marée': 1 } }),
    ])
    expect(alertes).toHaveLength(1)
    expect(alertes[0]?.titre).toContain('Une seule personne')
  })

  it('signale une competence que personne ne tient', () => {
    const alertes = alertesDeDependance([personne({ competences: { 'boucherie': 1 } })])
    expect(alertes[0]?.gravite).toBe('urgent')
    expect(alertes[0]?.titre).toContain('Personne n’est autonome')
  })

  it('ne signale rien quand deux personnes sont autonomes', () => {
    const alertes = alertesDeDependance([
      personne({ id: 'a', competences: { 'hygiène': 2 } }),
      personne({ id: 'b', competences: { 'hygiène': 3 } }),
    ])
    expect(alertes).toEqual([])
  })
})

describe('tri et resume', () => {
  it('place les alertes urgentes en premier', () => {
    const alertes = calculerAlertes(
      [
        personne({ id: 'a', finPeriodeEssai: '2026-11-20' }),
        personne({ id: 'b', finPeriodeEssai: '2026-11-03' }),
      ],
      AUJOURD_HUI,
    )
    expect(alertes[0]?.gravite).toBe('urgent')
    expect(alertes[0]?.collaborateurId).toBe('b')
  })

  it('compte les alertes par gravite', () => {
    const resume = resumerAlertes([
      { id: '1', categorie: 'fin-contrat', gravite: 'urgent', titre: '', detail: '', echeance: null, collaborateurId: null },
      { id: '2', categorie: 'fin-contrat', gravite: 'attention', titre: '', detail: '', echeance: null, collaborateurId: null },
      { id: '3', categorie: 'fin-contrat', gravite: 'attention', titre: '', detail: '', echeance: null, collaborateurId: null },
    ])
    expect(resume).toEqual({ urgent: 1, attention: 2, information: 0 })
  })

  it('filtre les alertes des prochains jours', () => {
    const alertes = calculerAlertes(
      [
        personne({ id: 'a', finPeriodeEssai: '2026-11-04' }),
        personne({ id: 'b', contrat: 'cdd', finContrat: '2026-12-10' }),
      ],
      AUJOURD_HUI,
    )
    expect(alertesProchaines(alertes, AUJOURD_HUI, 7)).toHaveLength(1)
  })

  it('ignore les collaborateurs sortis des effectifs', () => {
    expect(
      calculerAlertes([personne({ actif: false, finPeriodeEssai: '2026-11-03' })], AUJOURD_HUI),
    ).toEqual([])
  })

  it('rend le meme resultat a donnees egales', () => {
    const equipe = [personne({ id: 'a', finPeriodeEssai: '2026-11-10' })]
    expect(calculerAlertes(equipe, AUJOURD_HUI)).toEqual(calculerAlertes(equipe, AUJOURD_HUI))
  })
})

describe('alertes sur l equipe de demonstration', () => {
  it('produit des alertes plausibles', () => {
    const alertes = calculerAlertes(COLLABORATEURS_DEMO, AUJOURD_HUI)
    expect(alertes.length).toBeGreaterThan(0)
    expect(alertes.length).toBeLessThan(40)
  })

  it('signale la fin du CDD de novembre et les habilitations qui expirent', () => {
    const alertes = calculerAlertes(COLLABORATEURS_DEMO, AUJOURD_HUI)
    expect(alertes.some((alerte) => alerte.categorie === 'fin-contrat')).toBe(true)
    expect(alertes.some((alerte) => alerte.categorie === 'habilitation')).toBe(true)
  })

  it('signale les rayons qui ne tiennent qu a une personne', () => {
    const alertes = calculerAlertes(COLLABORATEURS_DEMO, AUJOURD_HUI)
    const dependances = alertes.filter((alerte) => alerte.categorie === 'competence-unique')
    expect(dependances.length).toBeGreaterThan(0)
    // La maree et la boulangerie ne reposent que sur une personne autonome.
    expect(dependances.some((alerte) => alerte.titre.includes('marée'))).toBe(true)
  })

  it('n expose aucun nom de famille complet', () => {
    for (const alerte of calculerAlertes(COLLABORATEURS_DEMO, AUJOURD_HUI)) {
      // Une initiale est une lettre majuscule suivie d'un point.
      expect(alerte.titre).not.toMatch(/[A-ZÉÈ][a-zéèêàç]{3,}\s[A-Z][a-zéèêàç]{3,}/)
    }
  })
})

describe('alertes centralisees', () => {
  const date = '2026-10-01'

  it('reunit contrats, entretiens et securite en une seule liste triee', () => {
    const alertes = alertesCentralisees(
      {
        collaborateurs: [personne({ finContrat: '2026-10-20' })],
        entretiens: [],
        actionsSecurite: [
          {
            id: 'at-1',
            type: 'accident',
            titre: 'Coupure',
            date: '2026-09-30',
            collaborateurId: 'demo-1',
            echeance: null,
            faite: false,
          },
        ],
      },
      date,
    )
    const categories = new Set(alertes.map((alerte) => alerte.categorie))
    expect(categories.has('fin-contrat')).toBe(true)
    expect(categories.has('securite')).toBe(true)
    expect(categories.has('entretien')).toBe(true)
    // Le plus urgent d'abord : l'accident a declarer passe avant la fin de
    // contrat, moins pressante.
    const rang = (categorie: string) => alertes.findIndex((alerte) => alerte.categorie === categorie)
    expect(alertes[0]?.gravite).toBe('urgent')
    expect(rang('securite')).toBeLessThan(rang('fin-contrat'))
  })

  it('ne compte jamais deux fois la meme alerte', () => {
    const alertes = alertesCentralisees(
      { collaborateurs: [personne()], entretiens: [], actionsSecurite: [] },
      date,
    )
    const ids = alertes.map((alerte) => alerte.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ignore une action de securite deja faite', () => {
    const alertes = alertesCentralisees(
      {
        collaborateurs: [],
        entretiens: [],
        actionsSecurite: [
          {
            id: 'at-2',
            type: 'accident',
            titre: 'Chute',
            date: '2026-09-30',
            collaborateurId: null,
            echeance: null,
            faite: true,
          },
        ],
      },
      date,
    )
    expect(alertes).toHaveLength(0)
  })
})
