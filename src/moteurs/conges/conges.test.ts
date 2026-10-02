import { describe, expect, it } from 'vitest'
import type { Collaborateur } from '../../domaine/collaborateur'
import {
  dansLaPeriodeLegale,
  demandeVide,
  estAccordee,
  joursOuvrables,
  PARAMETRES_CONGES_PAR_DEFAUT,
  soldeDisponible,
  type DemandeConge,
  type SoldeConges,
} from '../../domaine/conge'
import { changerEtatSuivi } from '../../domaine/suivi'
import {
  controlerLaDemande,
  joursAccordes,
  joursDeFractionnement,
  ordreDesDeparts,
  resumerLaDemande,
} from './index'

/** Donnees FICTIVES uniquement. */

const P = PARAMETRES_CONGES_PAR_DEFAUT

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

function demande(modifications: Partial<DemandeConge> = {}): DemandeConge {
  return { ...demandeVide('d1', 'c-01', '2027-07-05', '2027-07-17', '2027-03-01'), ...modifications }
}

function accordee(base: DemandeConge): DemandeConge {
  return { ...base, ...changerEtatSuivi(base, 'valide', '2027-03-15') }
}

const SOLDE: SoldeConges = { collaborateurId: 'c-01', acquis: 30, pris: 0, ajustement: 0 }

describe('décompte des jours', () => {
  it('compte les jours ouvrables, samedi compris, dimanche exclu', () => {
    // Du lundi 5 au samedi 17 juillet 2027 : 13 jours moins 1 dimanche = 12.
    expect(joursOuvrables('2027-07-05', '2027-07-17')).toBe(12)
  })

  it('compte une journée isolée', () => {
    expect(joursOuvrables('2027-07-05', '2027-07-05')).toBe(1)
  })

  it('ne compte pas un dimanche isolé', () => {
    expect(joursOuvrables('2027-07-11', '2027-07-11')).toBe(0)
  })
})

describe('période légale', () => {
  it('reconnaît le 1er mai au 31 octobre', () => {
    expect(dansLaPeriodeLegale('2027-05-01', P)).toBe(true)
    expect(dansLaPeriodeLegale('2027-08-15', P)).toBe(true)
    expect(dansLaPeriodeLegale('2027-10-31', P)).toBe(true)
  })

  it('exclut le reste de l’année', () => {
    expect(dansLaPeriodeLegale('2027-04-30', P)).toBe(false)
    expect(dansLaPeriodeLegale('2027-11-01', P)).toBe(false)
    expect(dansLaPeriodeLegale('2027-02-10', P)).toBe(false)
  })
})

describe('soldes', () => {
  it('tient compte du recalage sur le bulletin de paie', () => {
    expect(soldeDisponible({ collaborateurId: 'c', acquis: 30, pris: 10, ajustement: -2 })).toBe(18)
  })

  it('additionne les congés accordés', () => {
    const accordees = [accordee(demande()), accordee(demande({ id: 'd2', debut: '2027-08-02', fin: '2027-08-07' }))]
    expect(joursAccordes(accordees, 'c-01')).toBe(12 + 6)
  })

  it('ne compte pas les demandes non validées', () => {
    expect(joursAccordes([demande()], 'c-01')).toBe(0)
    expect(estAccordee(demande())).toBe(false)
    expect(estAccordee(accordee(demande()))).toBe(true)
  })
})

describe('contrôle d’une demande', () => {
  it('ne signale rien sur une demande normale', () => {
    expect(controlerLaDemande(demande(), personne(), [], [SOLDE], [personne()], P)).toEqual([])
  })

  it('refuse des dates incohérentes', () => {
    const inversee = demande({ debut: '2027-07-17', fin: '2027-07-05' })
    const constats = controlerLaDemande(inversee, personne(), [], [SOLDE], [personne()], P)
    expect(constats[0]?.gravite).toBe('bloquant')
    expect(constats[0]?.libelle).toBe('Dates incohérentes')
  })

  it('signale un solde insuffisant', () => {
    const petitSolde: SoldeConges = { collaborateurId: 'c-01', acquis: 5, pris: 0, ajustement: 0 }
    const constats = controlerLaDemande(demande(), personne(), [], [petitSolde], [personne()], P)
    expect(constats.some((c) => c.libelle.includes('Solde insuffisant'))).toBe(true)
    expect(constats[0]?.gravite).toBe('bloquant')
  })

  it('tient compte des congés déjà accordés dans le solde', () => {
    const dejaPris = accordee(demande({ id: 'ancienne', debut: '2027-06-01', fin: '2027-06-26' }))
    const constats = controlerLaDemande(demande(), personne(), [dejaPris], [SOLDE], [personne()], P)
    expect(constats.some((c) => c.libelle.includes('Solde insuffisant'))).toBe(true)
  })

  it('signale un congé de plus de 24 jours d’un seul tenant', () => {
    const longue = demande({ debut: '2027-07-05', fin: '2027-08-14' })
    const grandSolde: SoldeConges = { collaborateurId: 'c-01', acquis: 60, pris: 0, ajustement: 0 }
    const constats = controlerLaDemande(longue, personne(), [], [grandSolde], [personne()], P)
    expect(constats.some((c) => c.libelle.includes('d’un seul tenant'))).toBe(true)
  })

  it('signale les jours pris hors période légale', () => {
    const hiver = demande({ debut: '2027-02-01', fin: '2027-02-16' })
    const constats = controlerLaDemande(hiver, personne(), [], [SOLDE], [personne()], P)
    expect(constats.some((c) => c.libelle.includes('hors période légale'))).toBe(true)
    expect(constats.find((c) => c.libelle.includes('hors période'))?.gravite).toBe('information')
  })

  it('signale deux personnes absentes en même temps dans le rayon', () => {
    const collegue = personne({ id: 'c-02', prenom: 'Mathieu', initiale: 'R.' })
    const sienne = accordee(demande({ id: 'd2', collaborateurId: 'c-02' }))
    const constats = controlerLaDemande(
      demande(),
      personne(),
      [sienne],
      [SOLDE],
      [personne(), collegue],
      P,
    )
    expect(constats.some((c) => c.libelle.includes('en même temps'))).toBe(true)
    expect(constats.find((c) => c.libelle.includes('en même temps'))?.explication).toContain(
      'Mathieu R.',
    )
  })

  it('ne compte pas un collègue d’un autre rayon', () => {
    const boucher = personne({ id: 'c-02', rayonPrincipal: 'boucherie' })
    const sienne = accordee(demande({ id: 'd2', collaborateurId: 'c-02' }))
    const constats = controlerLaDemande(
      demande(),
      personne(),
      [sienne],
      [SOLDE],
      [personne(), boucher],
      P,
    )
    expect(constats.some((c) => c.libelle.includes('en même temps'))).toBe(false)
  })
})

describe('jours de fractionnement', () => {
  it('n’en donne aucun quand tout est pris dans la période légale', () => {
    expect(joursDeFractionnement([accordee(demande())], 'c-01', P)).toBe(0)
  })

  it('donne un jour pour 3 à 5 jours hors période', () => {
    const hiver = accordee(demande({ debut: '2027-02-01', fin: '2027-02-04' }))
    expect(joursDeFractionnement([hiver], 'c-01', P)).toBe(1)
  })

  it('donne deux jours dès 6 jours hors période', () => {
    const hiver = accordee(demande({ debut: '2027-02-01', fin: '2027-02-10' }))
    expect(joursDeFractionnement([hiver], 'c-01', P)).toBe(2)
  })
})

describe('ordre des départs', () => {
  it('classe par ancienneté, puis par date de demande', () => {
    const ancienne = personne({ id: 'ancienne', dateEntree: '2012-01-09' })
    const recente = personne({ id: 'recente', dateEntree: '2023-05-02' })
    const rangs = ordreDesDeparts(
      [
        demande({ id: 'd1', collaborateurId: 'recente', demandeeLe: '2027-01-10' }),
        demande({ id: 'd2', collaborateurId: 'ancienne', demandeeLe: '2027-02-20' }),
      ],
      [ancienne, recente],
    )
    expect(rangs[0]?.collaborateurId).toBe('ancienne')
    expect(rangs[0]?.rang).toBe(1)
  })

  it('n’utilise aucune donnée de situation familiale', () => {
    const rangs = ordreDesDeparts([demande()], [personne()])
    expect(Object.keys(rangs[0] ?? {}).sort()).toEqual([
      'anciennete',
      'collaborateurId',
      'demandeeLe',
      'rang',
    ])
  })
})

describe('affichage', () => {
  it('résume une demande en une phrase', () => {
    expect(resumerLaDemande(demande(), personne())).toContain('Camille D.')
    expect(resumerLaDemande(demande(), personne())).toContain('12 jours ouvrables')
  })
})
