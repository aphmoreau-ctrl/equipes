import { describe, expect, it } from 'vitest'
import type { Collaborateur } from '../../domaine/collaborateur'
import { PARAMETRES_PAR_DEFAUT } from './parametres'
import { dureeTravailEffectif, grouperParJournee } from './regroupement'
import { joursOuvresEntre, minutesDeNuit } from './reperes'
import {
  REGLES_IMPLEMENTEES,
  contexteDeVerification,
  infractionsDe,
  resumerInfractions,
  verifier,
  verifierLesContrats,
} from './verifier'
import type { IdentifiantRegle, ParametresRegles, Vacation } from './types'

/**
 * Batterie de tests des regles legales et conventionnelles.
 * Donnees FICTIVES uniquement (cahier des charges §3).
 */

const P = PARAMETRES_PAR_DEFAUT

function vacation(partiel: Partial<Vacation> & Pick<Vacation, 'debut' | 'fin'>): Vacation {
  return {
    id: `v-${partiel.jour ?? '2026-11-02'}-${partiel.debut}`,
    collaborateurId: 'demo-1',
    rayonId: 'fruits-legumes',
    jour: '2026-11-02',
    pauseMinutes: 20,
    ...partiel,
  }
}

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
    compteursEquite: { samedisTravailles: 0, dimanchesTravailles: 0, fermetures: 0, feriesTravailles: 0 },
    periodesFormation: [],
    trancheAge: 'majeur',
    contactAutorise: false,
    actif: true,
    ...modifications,
  }
}

function controler(
  vacations: readonly Vacation[],
  complements: Parameters<typeof contexteDeVerification>[2] = {},
  parametres: ParametresRegles = P,
) {
  return verifier(
    contexteDeVerification(vacations, parametres, {
      collaborateurs: [personne()],
      ...complements,
    }),
  )
}

/** Constats fermes : on laisse de cote ce qui reste « a confirmer ». */
function constats(
  vacations: readonly Vacation[],
  complements: Parameters<typeof contexteDeVerification>[2] = {},
  parametres: ParametresRegles = P,
) {
  return controler(vacations, complements, parametres).filter(
    (infraction) => infraction.severite !== 'a-confirmer',
  )
}

function regles(vacations: readonly Vacation[], complements = {}): IdentifiantRegle[] {
  return [...new Set(constats(vacations, complements).map((infraction) => infraction.regle))].sort()
}

/** Semaine type : cinq jours de 7 h, sans aucun probleme. */
const SEMAINE_SAINE: Vacation[] = [
  vacation({ jour: '2026-11-02', debut: '06:00', fin: '13:20' }),
  vacation({ jour: '2026-11-03', debut: '06:00', fin: '13:20' }),
  vacation({ jour: '2026-11-04', debut: '06:00', fin: '13:20' }),
  vacation({ jour: '2026-11-05', debut: '06:00', fin: '13:20' }),
  vacation({ jour: '2026-11-06', debut: '06:00', fin: '13:20' }),
]

// ---------------------------------------------------------------- Socle

describe('outils de base', () => {
  it('deduit la pause de l amplitude', () => {
    expect(dureeTravailEffectif(vacation({ debut: '05:30', fin: '12:30' }))).toBe(400)
  })

  it('compte une vacation de nuit qui passe minuit', () => {
    expect(dureeTravailEffectif(vacation({ debut: '22:00', fin: '05:00', pauseMinutes: 0 }))).toBe(420)
  })

  it('refuse une pause plus longue que la vacation', () => {
    expect(() =>
      dureeTravailEffectif(vacation({ debut: '08:00', fin: '09:00', pauseMinutes: 90 })),
    ).toThrow(/pause.*depasse/)
  })

  it('regroupe par personne et par jour, dans un ordre stable', () => {
    const journees = grouperParJournee([
      vacation({ jour: '2026-11-03', debut: '06:00', fin: '10:00', collaborateurId: 'b' }),
      vacation({ jour: '2026-11-02', debut: '06:00', fin: '10:00', collaborateurId: 'a' }),
    ])
    expect(journees.map((j) => `${j.collaborateurId} ${j.jour}`)).toEqual([
      'a 2026-11-02',
      'b 2026-11-03',
    ])
  })

  it('compte les jours ouvres sans les dimanches', () => {
    // Du lundi 2 au lundi 9 novembre : 6 jours ouvres (le dimanche ne compte pas).
    expect(joursOuvresEntre('2026-11-02', '2026-11-09')).toBe(6)
    expect(joursOuvresEntre('2026-11-02', '2026-11-02')).toBe(0)
  })

  it('mesure les minutes de nuit, meme a cheval sur minuit', () => {
    expect(minutesDeNuit(vacation({ debut: '22:00', fin: '05:00' }), '21:00', '05:00')).toBe(420)
    expect(minutesDeNuit(vacation({ debut: '20:00', fin: '23:00' }), '21:00', '05:00')).toBe(120)
    expect(minutesDeNuit(vacation({ debut: '08:00', fin: '16:00' }), '21:00', '05:00')).toBe(0)
    expect(minutesDeNuit(vacation({ debut: '04:00', fin: '12:00' }), '21:00', '05:00')).toBe(60)
  })
})

describe('une semaine correcte ne declenche rien', () => {
  it('ne signale aucune infraction', () => {
    expect(constats(SEMAINE_SAINE)).toEqual([])
  })

  it('ne signale rien sur un planning vide', () => {
    expect(controler([])).toEqual([])
  })
})

describe('données incomplètes : « à confirmer », ni alerte ni validation', () => {
  it('ne valide pas un repos hebdomadaire qu’il ne peut pas mesurer', () => {
    const constat = controler(SEMAINE_SAINE).find(
      (infraction) => infraction.regle === 'repos-hebdomadaire',
    )
    expect(constat?.severite).toBe('a-confirmer')
    expect(constat?.libelle).toContain('à confirmer')
  })

  it('ne compte pas « à confirmer » parmi les règles enfreintes', () => {
    const resume = resumerInfractions(controler(SEMAINE_SAINE))
    expect(resume.bloquantes).toBe(0)
    expect(resume.avertissements).toBe(0)
    expect(resume.aConfirmer).toBeGreaterThan(0)
  })

  it('se prononce dès que la semaine suivante est connue', () => {
    // C'est la semaine SUIVANTE qui permet de mesurer le repos : tant que le
    // travail ne reprend nulle part, la durée du dernier repos est inconnue.
    const semaineSuivante = ['2026-11-09', '2026-11-10'].map((jour) =>
      vacation({ jour, debut: '06:00', fin: '13:20' }),
    )
    const indetermines = controler([...SEMAINE_SAINE, ...semaineSuivante])
      .filter((i) => i.regle === 'repos-hebdomadaire' && i.severite === 'a-confirmer')
      .map((i) => i.jour)

    expect(indetermines).not.toContain('2026-11-02')
    // La dernière semaine, elle, reste à confirmer.
    expect(indetermines).toContain('2026-11-09')
  })
})

// -------------------------------------------------------------- Durees

describe('durée maximale par jour', () => {
  it('accepte exactement 10 h', () => {
    expect(regles([vacation({ debut: '05:00', fin: '15:20' })])).toEqual([])
  })

  it('signale un dépassement, même d’une minute', () => {
    const infractions = constats([vacation({ debut: '05:00', fin: '15:21' })])
    expect(infractions).toHaveLength(1)
    expect(infractions[0]?.regle).toBe('duree-maximale-quotidienne')
    expect(infractions[0]?.severite).toBe('bloquante')
  })

  it('additionne les vacations coupées du même jour', () => {
    const infractions = controler([
      vacation({ id: 'matin', debut: '05:00', fin: '11:00', pauseMinutes: 0 }),
      vacation({ id: 'soir', debut: '14:00', fin: '19:30', pauseMinutes: 0 }),
    ])
    expect(infractions.some((i) => i.regle === 'duree-maximale-quotidienne')).toBe(true)
  })

  it('applique le plafond de dérogation quand le jour est marqué', () => {
    const longue = vacation({ debut: '05:00', fin: '16:20' })
    expect(regles([longue])).toContain('duree-maximale-quotidienne')
    expect(regles([{ ...longue, derogation: true }])).not.toContain('duree-maximale-quotidienne')
  })

  it('applique 8 h aux moins de 18 ans', () => {
    const neufHeures = [vacation({ debut: '06:00', fin: '15:20' })]
    expect(regles(neufHeures)).toEqual([])
    const infractions = controler(neufHeures, { collaborateurs: [personne({ trancheAge: '16-17' })] })
    expect(infractions.some((i) => i.regle === 'duree-maximale-quotidienne')).toBe(true)
    expect(infractions[0]?.explication).toContain('moins de 18 ans')
  })

  it('suit un plafond modifié par l’utilisateur', () => {
    const journee = [vacation({ debut: '05:00', fin: '14:30' })]
    expect(regles(journee)).toEqual([])
    expect(
      controler(journee, {}, { ...P, dureeMaximaleQuotidienneMinutes: 8 * 60 }).map((i) => i.regle),
    ).toContain('duree-maximale-quotidienne')
  })
})

describe('durée maximale par semaine', () => {
  it('accepte une semaine de 48 h', () => {
    // Six jours de 8 h de travail effectif.
    const semaine = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '14:20' }),
    )
    expect(regles(semaine)).not.toContain('duree-maximale-hebdomadaire')
  })

  it('signale une semaine de plus de 48 h', () => {
    const semaine = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '15:00' }),
    )
    expect(regles(semaine)).toContain('duree-maximale-hebdomadaire')
  })

  it('ne mélange pas deux semaines différentes', () => {
    const deuxSemaines = [
      ...[2, 3, 4, 5, 6].map((j) => vacation({ jour: `2026-11-0${j}`, debut: '06:00', fin: '14:20' })),
      ...[9, 10, 11, 12, 13].map((j) => vacation({ jour: `2026-11-${String(j).padStart(2, '0')}`, debut: '06:00', fin: '14:20' })),
    ]
    expect(regles(deuxSemaines)).not.toContain('duree-maximale-hebdomadaire')
  })
})

describe('moyenne sur douze semaines', () => {
  function semaineDe(lundi: string, finService: string): Vacation[] {
    const jours = [0, 1, 2, 3, 4, 5].map((decalage) => {
      const date = new Date(`${lundi}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() + decalage)
      return date.toISOString().slice(0, 10)
    })
    return jours.map((jour) => vacation({ jour, debut: '06:00', fin: finService }))
  }

  const LUNDIS = [
    '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21',
    '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26',
  ]

  it('ne se prononce pas sans douze semaines d historique', () => {
    expect(regles(SEMAINE_SAINE)).not.toContain('duree-moyenne-12-semaines')
  })

  it('accepte douze semaines à 44 h de moyenne', () => {
    // 6 jours x 7 h 20 = 44 h par semaine.
    const anterieures = LUNDIS.flatMap((lundi) => semaineDe(lundi, '13:40'))
    expect(regles(semaineDe('2026-11-02', '13:40'), { vacationsAnterieures: anterieures }))
      .not.toContain('duree-moyenne-12-semaines')
  })

  it('signale douze semaines au-delà de 44 h de moyenne', () => {
    const anterieures = LUNDIS.flatMap((lundi) => semaineDe(lundi, '14:20'))
    expect(regles(semaineDe('2026-11-02', '14:20'), { vacationsAnterieures: anterieures }))
      .toContain('duree-moyenne-12-semaines')
  })
})

// --------------------------------------------------------------- Repos

describe('repos quotidien', () => {
  it('accepte 11 h entre deux journées', () => {
    expect(
      regles([
        vacation({ jour: '2026-11-02', debut: '12:00', fin: '20:00' }),
        vacation({ jour: '2026-11-03', debut: '07:00', fin: '14:00' }),
      ]),
    ).not.toContain('repos-quotidien')
  })

  it('signale un repos trop court', () => {
    const infractions = controler([
      vacation({ jour: '2026-11-02', debut: '12:00', fin: '20:30' }),
      vacation({ jour: '2026-11-03', debut: '06:00', fin: '13:00' }),
    ])
    const repos = infractions.find((i) => i.regle === 'repos-quotidien')
    expect(repos).toBeDefined()
    expect(repos?.explication).toContain('9 h 30')
    // Les dates se lisent en francais, jamais « 2026-11-02 ».
    expect(repos?.explication).toContain('lundi 2 novembre')
    expect(repos?.explication).toContain('mardi 3 novembre')
    expect(repos?.explication).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('exige 12 h pour un salarié de moins de 18 ans', () => {
    const journees = [
      vacation({ jour: '2026-11-02', debut: '12:00', fin: '20:00' }),
      vacation({ jour: '2026-11-03', debut: '07:00', fin: '14:00' }),
    ]
    expect(regles(journees)).not.toContain('repos-quotidien')
    expect(
      controler(journees, { collaborateurs: [personne({ trancheAge: '16-17' })] }).map((i) => i.regle),
    ).toContain('repos-quotidien')
  })

  it('ne prend pas une coupure du même jour pour un repos quotidien', () => {
    expect(
      regles([
        vacation({ id: 'a', jour: '2026-11-02', debut: '06:00', fin: '10:00', pauseMinutes: 0 }),
        vacation({ id: 'b', jour: '2026-11-02', debut: '16:00', fin: '20:00', pauseMinutes: 0 }),
      ]),
    ).not.toContain('repos-quotidien')
  })
})

describe('repos hebdomadaire : 35 heures consécutives, strictement', () => {
  it('accepte un repos réel de 35 h ou plus', () => {
    // Fin samedi 13:20, reprise lundi 06:00 : 40 h 40.
    const semaine = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '13:20' }),
    )
    const suivante = [vacation({ jour: '2026-11-09', debut: '06:00', fin: '13:20' })]
    expect(regles([...semaine, ...suivante])).not.toContain('repos-hebdomadaire')
  })

  it('signale 33 h de repos : fin samedi 20h30, reprise lundi 5h30', () => {
    const semaine = [2, 3, 4, 5, 6].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '13:00', fin: '20:30' }),
    )
    semaine.push(vacation({ id: 'samedi', jour: '2026-11-07', debut: '13:00', fin: '20:30' }))
    const lundiSuivant = vacation({ id: 'lundi-suivant', jour: '2026-11-09', debut: '05:30', fin: '12:50' })

    const infractions = controler([...semaine, lundiSuivant])
    const repos = infractions.find(
      (infraction) => infraction.regle === 'repos-hebdomadaire' && infraction.jour === '2026-11-02',
    )
    expect(repos).toBeDefined()
    expect(repos?.severite).toBe('bloquante')
    expect(repos?.libelle).toContain('33 h')
  })

  it('refuse 34 h 40 : un dimanche entier ne suffit pas toujours', () => {
    // Fin samedi 14:00, reprise lundi 00:40 : 34 h 40, sous les 35 h.
    const semaine = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '14:00' }),
    )
    const suivante = vacation({ id: 'nuit', jour: '2026-11-09', debut: '00:40', fin: '05:00', pauseMinutes: 0 })
    expect(regles([...semaine, suivante])).toContain('repos-hebdomadaire')
  })

  it('exige 48 h consécutives pour un salarié de moins de 18 ans', () => {
    // Fin samedi 13:20, reprise lundi 06:00 : 40 h 40.
    // Suffisant pour un majeur (35 h), insuffisant pour un mineur (48 h).
    const semaine = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '12:00', pauseMinutes: 30 }),
    )
    const suivante = vacation({ id: 'suite', jour: '2026-11-09', debut: '06:00', fin: '12:00', pauseMinutes: 30 })
    const planning = [...semaine, suivante]

    const majeur = constats(planning).filter((i) => i.regle === 'repos-hebdomadaire')
    expect(majeur).toEqual([])

    const mineur = constats(planning, { collaborateurs: [personne({ trancheAge: '16-17' })] })
    expect(mineur.map((i) => i.regle)).toContain('repos-hebdomadaire')
  })
})

describe('six jours par semaine au maximum', () => {
  it('accepte six jours travaillés', () => {
    const six = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '13:20' }),
    )
    expect(regles(six)).not.toContain('jours-maximum-par-semaine')
  })

  it('signale sept jours travaillés d’affilée', () => {
    const sept = [2, 3, 4, 5, 6, 7, 8].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '08:00', fin: '15:20' }),
    )
    const infractions = constats(sept)
    expect(infractions.map((i) => i.regle)).toContain('jours-maximum-par-semaine')
    expect(infractions.find((i) => i.regle === 'jours-maximum-par-semaine')?.severite).toBe(
      'bloquante',
    )
  })

  it('ne compte qu’une fois un jour comportant deux vacations', () => {
    const avecCoupures = [2, 3, 4, 5, 6, 7].flatMap((jour) => [
      vacation({ id: `m${jour}`, jour: `2026-11-0${jour}`, debut: '06:00', fin: '10:00', pauseMinutes: 0 }),
      vacation({ id: `s${jour}`, jour: `2026-11-0${jour}`, debut: '11:30', fin: '15:00', pauseMinutes: 0 }),
    ])
    expect(regles(avecCoupures)).not.toContain('jours-maximum-par-semaine')
  })

  it('limite les moins de 18 ans à cinq jours', () => {
    const six = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '12:00', pauseMinutes: 30 }),
    )
    expect(regles(six)).not.toContain('jours-maximum-par-semaine')
    expect(
      constats(six, { collaborateurs: [personne({ trancheAge: '16-17' })] }).map((i) => i.regle),
    ).toContain('jours-maximum-par-semaine')
  })
})

// --------------------------------------------------------------- Pause

describe('pause obligatoire', () => {
  it('n’exige rien en dessous de six heures', () => {
    expect(regles([vacation({ debut: '06:00', fin: '11:50', pauseMinutes: 0 })])).toEqual([])
  })

  it('exige 20 minutes dès six heures de travail', () => {
    expect(regles([vacation({ debut: '06:00', fin: '12:00', pauseMinutes: 0 })])).toContain(
      'pause-obligatoire',
    )
  })

  it('accepte une pause suffisante', () => {
    expect(regles([vacation({ debut: '06:00', fin: '13:00', pauseMinutes: 20 })])).toEqual([])
  })

  it('compte le travail de la JOURNÉE, pas de chaque vacation', () => {
    // Deux vacations de 3 h 30 : aucune n'atteint six heures, mais la journée si.
    const coupee = [
      vacation({ id: 'a', debut: '06:00', fin: '09:30', pauseMinutes: 0 }),
      vacation({ id: 'b', debut: '11:30', fin: '15:00', pauseMinutes: 0 }),
    ]
    expect(regles(coupee)).toContain('pause-obligatoire')
  })

  it('ne compte pas la coupure comme une pause', () => {
    const coupee = [
      vacation({ id: 'a', debut: '06:00', fin: '09:30', pauseMinutes: 0 }),
      vacation({ id: 'b', debut: '13:00', fin: '16:30', pauseMinutes: 0 }),
    ]
    expect(regles(coupee)).toContain('pause-obligatoire')
  })

  it('exige 30 min dès 4 h 30 pour un salarié de moins de 18 ans', () => {
    const journee = [vacation({ debut: '06:00', fin: '11:00', pauseMinutes: 20 })]
    expect(regles(journee)).not.toContain('pause-obligatoire')
    expect(
      constats(journee, { collaborateurs: [personne({ trancheAge: '16-17' })] }).map((i) => i.regle),
    ).toContain('pause-obligatoire')
  })

  it('signale une pause trop courte', () => {
    expect(regles([vacation({ debut: '06:00', fin: '13:00', pauseMinutes: 10 })])).toContain(
      'pause-obligatoire',
    )
  })
})

// -------------------------------------------------------- Temps partiel

describe('temps partiel', () => {
  const partiel = personne({ heuresHebdomadaires: 24, tempsPlein: false })

  it('ne s’applique pas à un temps plein', () => {
    expect(
      regles([
        vacation({ id: 'a', debut: '06:00', fin: '10:00', pauseMinutes: 0 }),
        vacation({ id: 'b', debut: '15:00', fin: '19:00', pauseMinutes: 0 }),
      ]),
    ).not.toContain('temps-partiel-coupures')
  })

  it('accepte une seule coupure courte', () => {
    const infractions = controler(
      [
        vacation({ id: 'a', debut: '08:00', fin: '12:00', pauseMinutes: 0 }),
        vacation({ id: 'b', debut: '13:30', fin: '17:00', pauseMinutes: 0 }),
      ],
      { collaborateurs: [partiel] },
    )
    expect(infractions.filter((i) => i.regle === 'temps-partiel-coupures')).toEqual([])
  })

  it('signale une coupure trop longue', () => {
    const infractions = controler(
      [
        vacation({ id: 'a', debut: '07:00', fin: '11:00', pauseMinutes: 0 }),
        vacation({ id: 'b', debut: '16:00', fin: '19:00', pauseMinutes: 0 }),
      ],
      { collaborateurs: [partiel] },
    )
    expect(infractions.some((i) => i.libelle.includes('Coupure trop longue'))).toBe(true)
  })

  it('signale deux coupures dans la même journée', () => {
    const infractions = controler(
      [
        vacation({ id: 'a', debut: '07:00', fin: '09:00', pauseMinutes: 0 }),
        vacation({ id: 'b', debut: '10:00', fin: '12:00', pauseMinutes: 0 }),
        vacation({ id: 'c', debut: '13:00', fin: '15:00', pauseMinutes: 0 }),
      ],
      { collaborateurs: [partiel] },
    )
    expect(infractions.some((i) => i.libelle.includes('2 coupures'))).toBe(true)
  })

  it('signale un dépassement des heures complémentaires', () => {
    // Contrat de 24 h, plafond 26 h 24. Cinq jours de 6 h = 30 h.
    const semaine = [2, 3, 4, 5, 6].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '08:00', fin: '14:00', pauseMinutes: 0 }),
    )
    expect(regles(semaine, { collaborateurs: [partiel] })).toContain('heures-complementaires')
  })

  it('accepte de rester dans le plafond', () => {
    const semaine = [2, 3, 4, 5].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '08:00', fin: '14:00', pauseMinutes: 0 }),
    )
    expect(regles(semaine, { collaborateurs: [partiel] })).not.toContain('heures-complementaires')
  })

  it('signale un contrat sous la durée minimale', () => {
    const infractions = verifierLesContrats([personne({ heuresHebdomadaires: 20, tempsPlein: false })], P)
    expect(infractions).toHaveLength(1)
    expect(infractions[0]?.libelle).toContain('sous la durée minimale')
  })

  it('signale aussi les étudiants, en rappelant que la dérogation doit être écrite', () => {
    const infractions = verifierLesContrats(
      [personne({ heuresHebdomadaires: 12, tempsPlein: false, contrat: 'etudiant' })],
      P,
    )
    expect(infractions).toHaveLength(1)
    expect(infractions[0]?.explication).toContain('par écrit')
  })

  it('refuse qu’un temps partiel atteigne la durée légale', () => {
    const partiel28 = personne({ heuresHebdomadaires: 28, tempsPlein: false })
    // Cinq jours de 7 h = 35 h : la durée légale est atteinte.
    const semaine = [2, 3, 4, 5, 6].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '13:20' }),
    )
    const infractions = constats(semaine, { collaborateurs: [partiel28] })
    expect(infractions.some((i) => i.libelle.includes('durée légale'))).toBe(true)
  })
})

// ------------------------------------------------------- Prévenance

describe('délai de prévenance', () => {
  it('ne dit rien tant que le planning n’est pas publié', () => {
    expect(regles(SEMAINE_SAINE)).not.toContain('delai-de-prevenance')
  })

  it('accepte une publication faite assez tôt', () => {
    expect(
      regles(SEMAINE_SAINE, { datePublication: '2026-10-20' }),
    ).not.toContain('delai-de-prevenance')
  })

  it('signale une publication trop tardive', () => {
    expect(regles(SEMAINE_SAINE, { datePublication: '2026-10-30' })).toContain(
      'delai-de-prevenance',
    )
  })

  it('ne signale qu’une fois par personne et par jour', () => {
    const infractions = controler(
      [
        vacation({ id: 'a', debut: '06:00', fin: '10:00', pauseMinutes: 0 }),
        vacation({ id: 'b', debut: '15:00', fin: '19:00', pauseMinutes: 0 }),
      ],
      { datePublication: '2026-11-01' },
    )
    expect(infractions.filter((i) => i.regle === 'delai-de-prevenance')).toHaveLength(1)
  })
})

// ------------------------------------------- Heures supplémentaires

describe('contingent d’heures supplémentaires', () => {
  it('ne dit rien dans les clous', () => {
    expect(regles(SEMAINE_SAINE, { heuresSupplementairesAnnuelles: { 'demo-1': 100 } }))
      .not.toContain('contingent-heures-supplementaires')
  })

  it('signale le dépassement du contingent annuel', () => {
    const semaine = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '14:20' }),
    )
    expect(regles(semaine, { heuresSupplementairesAnnuelles: { 'demo-1': 179 } })).toContain(
      'contingent-heures-supplementaires',
    )
  })

  it('ne s’applique pas aux temps partiels', () => {
    const semaine = [2, 3, 4, 5, 6, 7].map((jour) =>
      vacation({ jour: `2026-11-0${jour}`, debut: '06:00', fin: '14:20' }),
    )
    expect(
      regles(semaine, {
        collaborateurs: [personne({ heuresHebdomadaires: 24, tempsPlein: false })],
        heuresSupplementairesAnnuelles: { 'demo-1': 179 },
      }),
    ).not.toContain('contingent-heures-supplementaires')
  })
})

// --------------------------------------------------------------- Nuit

describe('travail de nuit', () => {
  it('ne dit rien pour quelques nuits', () => {
    expect(regles([vacation({ debut: '04:00', fin: '11:20' })])).not.toContain('travail-de-nuit')
  })

  it('signale le franchissement du seuil annuel', () => {
    // 60 nuits de 5 h entre 21 h et 5 h = 300 h, au-delà des 270 h.
    const nuits = Array.from({ length: 60 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1))
      date.setUTCDate(date.getUTCDate() + index * 3)
      return vacation({
        id: `n-${index}`,
        jour: date.toISOString().slice(0, 10),
        debut: '00:00',
        fin: '05:00',
        pauseMinutes: 0,
      })
    })
    expect(regles(nuits)).toContain('travail-de-nuit')
  })

  it('reste un avertissement, pas un blocage', () => {
    const nuits = Array.from({ length: 60 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1))
      date.setUTCDate(date.getUTCDate() + index * 3)
      return vacation({ id: `n-${index}`, jour: date.toISOString().slice(0, 10), debut: '00:00', fin: '05:00', pauseMinutes: 0 })
    })
    const infraction = controler(nuits).find((i) => i.regle === 'travail-de-nuit')
    expect(infraction?.severite).toBe('avertissement')
  })
})

// ------------------------------------------------------------- Jeunes

describe('moins de 18 ans', () => {
  const jeune = personne({ trancheAge: '16-17' })

  it('accepte une journée dans les horaires autorisés', () => {
    expect(regles([vacation({ debut: '06:00', fin: '13:20' })], { collaborateurs: [jeune] }))
      .not.toContain('jeune-travailleur')
  })

  it('interdit le travail avant six heures', () => {
    const infractions = controler([vacation({ debut: '05:00', fin: '12:20' })], {
      collaborateurs: [jeune],
    })
    expect(infractions.some((i) => i.regle === 'jeune-travailleur')).toBe(true)
  })

  it('interdit le travail après vingt-deux heures', () => {
    expect(
      regles([vacation({ debut: '15:00', fin: '23:00' })], { collaborateurs: [jeune] }),
    ).toContain('jeune-travailleur')
  })

  it('n’applique rien à un majeur', () => {
    expect(regles([vacation({ debut: '05:00', fin: '12:20' })])).not.toContain('jeune-travailleur')
  })
})

// ------------------------------------------------------- Vue d’ensemble

describe('cohérence de l’ensemble', () => {
  it('implémente les dix-sept règles prévues', () => {
    expect(REGLES_IMPLEMENTEES).toHaveLength(17)
  })

  it('donne une sévérité, un nom et une référence à chaque règle', () => {
    for (const regle of REGLES_IMPLEMENTEES) {
      expect(P.severites[regle.id]).toBeDefined()
      expect(regle.nom.length).toBeGreaterThan(0)
      expect(regle.reference.length).toBeGreaterThan(0)
    }
  })

  it('n’utilise aucun identifiant de règle en double', () => {
    const identifiants = REGLES_IMPLEMENTEES.map((regle) => regle.id)
    expect(new Set(identifiants).size).toBe(identifiants.length)
  })

  it('rend le même résultat quel que soit l’ordre des vacations', () => {
    const desordre = [...SEMAINE_SAINE].reverse()
    expect(controler(desordre)).toEqual(controler(SEMAINE_SAINE))
  })

  it('compte les manquements par sévérité', () => {
    const infractions = controler([vacation({ debut: '05:00', fin: '17:00', pauseMinutes: 0 })])
    const resume = resumerInfractions(infractions)
    expect(resume.bloquantes).toBeGreaterThan(0)
  })

  it('retrouve les infractions d’une personne', () => {
    const infractions = constats(
      [
        vacation({ collaborateurId: 'a', debut: '05:00', fin: '17:00' }),
        vacation({ collaborateurId: 'b', debut: '06:00', fin: '13:20' }),
      ],
      { collaborateurs: [personne({ id: 'a' }), personne({ id: 'b' })] },
    )
    expect(infractionsDe(infractions, 'a').length).toBeGreaterThan(0)
    expect(
      infractionsDe(infractions, 'b').filter((i) => i.severite !== 'a-confirmer'),
    ).toEqual([])
  })

  it('suit la sévérité choisie par l’utilisateur', () => {
    const trop = [vacation({ debut: '05:00', fin: '16:00' })]
    const enAvertissement: ParametresRegles = {
      ...P,
      severites: { ...P.severites, 'duree-maximale-quotidienne': 'avertissement' },
    }
    expect(controler(trop)[0]?.severite).toBe('bloquante')
    expect(controler(trop, {}, enAvertissement)[0]?.severite).toBe('avertissement')
  })

  it('cumule plusieurs infractions sur une même journée impossible', () => {
    // Journée de 12 h sans pause, publiée la veille : trois règles touchées.
    const infractions = controler(
      [vacation({ debut: '06:00', fin: '18:00', pauseMinutes: 0 })],
      { datePublication: '2026-11-01' },
    )
    const touchees = new Set(infractions.map((i) => i.regle))
    expect(touchees.has('duree-maximale-quotidienne')).toBe(true)
    expect(touchees.has('pause-obligatoire')).toBe(true)
    expect(touchees.has('delai-de-prevenance')).toBe(true)
  })

  it('explique chaque infraction en français, sans jargon', () => {
    for (const infraction of controler([vacation({ debut: '05:00', fin: '18:00', pauseMinutes: 0 })])) {
      expect(infraction.libelle.length).toBeGreaterThan(5)
      expect(infraction.explication.length).toBeGreaterThan(20)
      expect(infraction.explication).not.toMatch(/undefined|NaN|\[object/)
    }
  })
})

describe('formation en centre : l’apprenti n’est pas en magasin', () => {
  const apprenti = {
    ...personne(),
    id: 'app',
    contrat: 'apprenti' as const,
    trancheAge: '16-17' as const,
    periodesFormation: [
      { id: 'f1', debut: '2026-11-02', fin: '2026-11-06', intitule: 'CFA' },
    ],
  }

  it('refuse une vacation posée pendant la semaine de cours', () => {
    const infractions = controler(
      [vacation({ id: 'v', collaborateurId: 'app', jour: '2026-11-03', debut: '08:00', fin: '15:00' })],
      { collaborateurs: [apprenti] },
    )
    const formation = infractions.find((i) => i.regle === 'formation-en-centre')
    expect(formation).toBeDefined()
    expect(formation?.severite).toBe('bloquante')
    expect(formation?.explication).toContain('temps de travail')
  })

  it('accepte une vacation la semaine suivante', () => {
    const infractions = controler(
      [vacation({ id: 'v', collaborateurId: 'app', jour: '2026-11-09', debut: '08:00', fin: '15:00' })],
      { collaborateurs: [apprenti] },
    )
    expect(infractions.map((i) => i.regle)).not.toContain('formation-en-centre')
  })

  it('ne concerne que les personnes qui ont des périodes de formation', () => {
    const infractions = controler([
      vacation({ jour: '2026-11-03', debut: '08:00', fin: '15:00' }),
    ])
    expect(infractions.map((i) => i.regle)).not.toContain('formation-en-centre')
  })
})

describe('travail de nuit des mineurs : deux tranches d’âge', () => {
  it('interdit le travail après 22 h à un salarié de 16 ou 17 ans', () => {
    const jeune = { ...personne(), id: 'j', trancheAge: '16-17' as const }
    const infractions = controler(
      [vacation({ id: 'v', collaborateurId: 'j', jour: '2026-11-02', debut: '15:00', fin: '23:00' })],
      { collaborateurs: [jeune] },
    )
    const nuit = infractions.find((i) => i.regle === 'jeune-travailleur')
    expect(nuit?.explication).toContain('16 ou 17 ans')
    expect(nuit?.libelle).toContain('1 h')
  })

  it('arrête le travail dès 20 h avant 16 ans', () => {
    const enfant = { ...personne(), id: 'e', trancheAge: 'moins-de-16' as const }
    const infractions = controler(
      [vacation({ id: 'v', collaborateurId: 'e', jour: '2026-11-02', debut: '15:00', fin: '21:00' })],
      { collaborateurs: [enfant] },
    )
    const nuit = infractions.find((i) => i.regle === 'jeune-travailleur')
    expect(nuit).toBeDefined()
    expect(nuit?.explication).toContain('moins de 16 ans')
    expect(nuit?.explication).toContain('20:00')

    // La meme vacation ne pose aucun probleme a 16 ou 17 ans.
    const plusAge = { ...personne(), id: 'e', trancheAge: '16-17' as const }
    const autres = controler(
      [vacation({ id: 'v', collaborateurId: 'e', jour: '2026-11-02', debut: '15:00', fin: '21:00' })],
      { collaborateurs: [plusAge] },
    )
    expect(autres.map((i) => i.regle)).not.toContain('jeune-travailleur')
  })

  it('ne dit rien pour un salarié majeur', () => {
    const infractions = controler([
      vacation({ jour: '2026-11-02', debut: '15:00', fin: '22:30' }),
    ])
    expect(infractions.map((i) => i.regle)).not.toContain('jeune-travailleur')
  })
})

describe('règles de présence : la personne n’est pas là', () => {
  it('refuse une vacation un jour de repos fixe', () => {
    const avecRepos = {
      ...personne(),
      disponibilites: [{ jour: 3 as const, disponible: false, plage: null }],
    }
    // 2026-11-04 est un mercredi.
    const infractions = controler(
      [vacation({ jour: '2026-11-04', debut: '08:00', fin: '15:00' })],
      { collaborateurs: [avecRepos] },
    )
    const repos = infractions.find((i) => i.regle === 'repos-fixe')
    expect(repos?.severite).toBe('bloquante')
    expect(repos?.explication).toContain('non disponible')
  })

  it('refuse une vacation pendant une absence, sans jamais dire le motif', () => {
    const infractions = controler([vacation({ jour: '2026-11-03', debut: '08:00', fin: '15:00' })], {
      absences: [
        {
          id: 'a1',
          collaborateurId: 'demo-1',
          debut: '2026-11-02',
          fin: '2026-11-06',
          type: 'maladie',
          prevue: false,
        },
      ],
    })
    const absence = infractions.find((i) => i.regle === 'absence-en-cours')
    expect(absence?.severite).toBe('bloquante')
    expect(absence?.libelle).toBe('Absent : Maladie')
    expect(absence?.explication).toContain('la remplacer')
  })

  it('refuse une vacation avant l’entrée et après la fin du contrat', () => {
    const enCdd = { ...personne(), dateEntree: '2026-11-03', finContrat: '2026-11-06' }

    const avant = controler([vacation({ jour: '2026-11-02', debut: '08:00', fin: '15:00' })], {
      collaborateurs: [enCdd],
    })
    expect(avant.find((i) => i.regle === 'dates-de-contrat')?.libelle).toBe('Avant son entrée')

    const apres = controler([vacation({ jour: '2026-11-09', debut: '08:00', fin: '15:00' })], {
      collaborateurs: [enCdd],
    })
    expect(apres.find((i) => i.regle === 'dates-de-contrat')?.libelle).toBe(
      'Après la fin de son contrat',
    )

    const pendant = controler([vacation({ jour: '2026-11-04', debut: '08:00', fin: '15:00' })], {
      collaborateurs: [enCdd],
    })
    expect(pendant.map((i) => i.regle)).not.toContain('dates-de-contrat')
  })
})
