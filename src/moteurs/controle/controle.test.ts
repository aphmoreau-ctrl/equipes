import { describe, expect, it } from 'vitest'
import { construireEtatReel } from '../../donnees/import-equipe'
import { RAYON } from '../../donnees/modele-la-vaugine'
import { calculerBesoin } from '../besoin'
import type { Vacation } from '../regles'
import { controlerLaSemaine, type EntreesControleSemaine } from './index'

/** Equipe et planning ENTIEREMENT FICTIFS, pieges expres. */

const LUNDI = '2026-11-02'
const MARDI = '2026-11-03'

const etat = construireEtatReel([
  { prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
  { prenom: 'Basile', statut: 'manager', heures: 36.75, principaux: [RAYON.boucherieTrad], fonctions: ['responsable'] },
  { prenom: 'Cyril', statut: 'employe', heures: 36.75, principaux: [RAYON.preparationTraiteur] },
  { prenom: 'Gaspard', statut: 'employe', heures: 36.75, principaux: [RAYON.charcuterieFromage], depannage: [RAYON.boucherieTrad] },
])
const [abel, basile, cyril, gaspard] = etat.collaborateurs as [
  (typeof etat.collaborateurs)[0],
  (typeof etat.collaborateurs)[0],
  (typeof etat.collaborateurs)[0],
  (typeof etat.collaborateurs)[0],
]

function v(id: string, collaborateurId: string, rayonId: string, jour: string, debut: string, fin: string, pauseMinutes = 0, pauseDebut?: string): Vacation {
  return { id, collaborateurId, rayonId, jour, debut, fin, pauseMinutes, ...(pauseDebut === undefined ? {} : { pauseDebut }) }
}

function besoin(rayonId: string, date: string) {
  const configuration = etat.configurations.find((c) => c.rayonId === rayonId)!
  return calculerBesoin(configuration, {
    date,
    clientsParTranche: new Array<number>(96).fill(0),
    tranchesOuvertes: new Set(),
    meteo: 'normal',
    coefficientEvenements: 1,
    enPromotion: false,
    saisiesQualite: [],
  })
}

function controler(vacations: Vacation[], modifications: Partial<EntreesControleSemaine> = {}) {
  return controlerLaSemaine({
    semaine: LUNDI,
    vacations,
    infractions: [],
    besoins: [besoin(RAYON.maree, LUNDI)],
    rayons: etat.magasin.rayons,
    collaborateurs: etat.collaborateurs,
    absences: [],
    organisation: etat.organisation,
    ...modifications,
  })
}

const libelles = (constats: ReturnType<typeof controler>) => constats.map((c) => c.libelle)

describe('contrôle de la semaine', () => {
  it('reprend les règles légales, bloquantes en tête', () => {
    const constats = controler([], {
      infractions: [
        { regle: 'repos-quotidien', severite: 'bloquante', collaborateurId: abel.id, jour: LUNDI, libelle: 'Repos quotidien insuffisant', explication: 'x' },
      ],
    })
    expect(constats[0]).toMatchObject({ gravite: 'bloquant', categorie: 'Règle légale' })
  })

  it('signale une pause hors plage, pendant l’affluence, ou trop courte', () => {
    const l = libelles(controler([v('p', abel.id, RAYON.maree, LUNDI, '07:00', '15:00', 10, '12:00')]))
    expect(l).toContain('Abel — pause à 12:00, hors des plages prévues')
    expect(l).toContain('Abel — pause à 12:00, pendant l’affluence')
    expect(l).toContain('Abel — pause de 10 min, 24 min prévues')
  })

  it('signale une journée de moins de 3 h', () => {
    expect(libelles(controler([v('c', abel.id, RAYON.maree, LUNDI, '07:00', '09:00')]))).toContain(
      'Abel — 2,00 h de présence le lundi 2 novembre',
    )
  })

  it('compte les jours d’affilée d’une semaine sur l’autre', () => {
    const anterieures = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((jour, i) =>
      v(`a${i}`, abel.id, RAYON.maree, jour, '07:00', '14:00', 21, '10:00'),
    )
    const constats = controler([v('l', abel.id, RAYON.maree, LUNDI, '07:00', '14:00', 21, '10:00')], { vacationsAnterieures: anterieures })
    expect(constats.some((c) => c.categorie === 'Jours d’affilée' && c.jour === LUNDI)).toBe(true)
  })

  it('signale un poste hors horaires, hors rayon, ou en dépannage trop long', () => {
    const l = libelles(
      controler([
        v('h', abel.id, RAYON.maree, LUNDI, '19:30', '22:30'),
        v('r', cyril.id, RAYON.maree, MARDI, '07:00', '14:00', 21, '10:00'),
        v('d', gaspard.id, RAYON.boucherieTrad, MARDI, '06:00', '10:00'),
      ]),
    )
    expect(l).toContain('Abel — 19:30–22:30 hors des horaires de Marée')
    expect(l.some((x) => x.startsWith('Cyril — placé en Marée'))).toBe(true)
    expect(l).toContain('Gaspard — dépannage en Boucherie Trad, 4,00 h (au plus 2,00 h)')
  })

  it('signale le minimum non tenu, avec ses heures', () => {
    const l = libelles(controler([v('m', abel.id, RAYON.maree, LUNDI, '07:00', '14:00', 21, '10:00')]))
    expect(l.some((x) => x.startsWith('Marée, lundi 2 novembre — minimum non tenu') && x.includes('14:00–20:00'))).toBe(true)
  })

  it('compare les heures au contrat, congé déduit', () => {
    const constats = controler([v('k', abel.id, RAYON.maree, LUNDI, '07:00', '14:00', 21, '10:00')], {
      absences: [{ id: 'cp', collaborateurId: abel.id, debut: MARDI, fin: MARDI, type: 'conge-paye', prevue: true }],
    })
    const contrat = constats.find((c) => c.categorie === 'Contrat' && c.collaborateurId === abel.id)
    // 36 h 75 x 5/6 = 30 h 62 a faire.
    expect(contrat?.libelle).toBe('Abel — 7,00 h planifiées pour 30,63 h')
  })

  it('bloque une rôtisserie restée plus de 5 h au chaud', () => {
    const rotisserie = etat.organisation.rotisserie!
    const constats = controler([], {
      organisation: {
        ...etat.organisation,
        rotisserie: { ...rotisserie, jours: { ...rotisserie.jours, 1: { vente: { debut: '08:30', fin: '20:00' }, cuissons: ['08:30', '15:00'] } } },
      },
    })
    const chaud = constats.filter((c) => c.categorie === 'Rôtisserie' && c.gravite === 'bloquant')
    expect(chaud.map((c) => c.libelle)).toContain('Rôtisserie, lundi 2 novembre — 6,50 h au chaud après la cuisson de 08:30')
  })

  it('signale une cuisson sans boucher formé, et pas quand il est là', () => {
    const sans = controler([])
    expect(sans.some((c) => c.libelle === 'Rôtisserie, lundi 2 novembre — personne pour la cuisson de 08:30')).toBe(true)
    const avec = controler([v('b', basile.id, RAYON.boucherieTrad, LUNDI, '06:00', '14:00', 24, '10:00')])
    expect(avec.some((c) => c.libelle === 'Rôtisserie, lundi 2 novembre — personne pour la cuisson de 08:30')).toBe(false)
  })

  it('vérifie la réunion managers du lundi', () => {
    const sans = controler([])
    expect(sans.some((c) => c.libelle.startsWith('Réunion managers, lundi 2 novembre'))).toBe(true)
    const avec = controler([v('b', basile.id, RAYON.boucherieTrad, LUNDI, '10:00', '17:00', 21, '15:00')])
    expect(avec.some((c) => c.libelle.startsWith('Réunion managers, lundi 2 novembre'))).toBe(false)
  })

  it('donne des identifiants stables et uniques', () => {
    const vacations = [v('p', abel.id, RAYON.maree, LUNDI, '07:00', '15:00', 10, '12:00')]
    const a = controler(vacations).map((c) => c.id)
    const b = controler(vacations).map((c) => c.id)
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(a.length)
  })
})

describe('repos autour du dimanche', () => {
  const jours = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']
  it('bloque une semaine sans jour libre après un dimanche travaillé sans repos la semaine d’avant', () => {
    // Semaine d'avant : conge le lundi 26, travail du mardi au dimanche 1er.
    const avant = ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map((j, i) =>
      v(`a${i}`, abel.id, RAYON.maree, j, '07:00', '13:00'),
    )
    const cetteSemaine = jours.map((j, i) => v(`c${i}`, abel.id, RAYON.maree, j, '07:00', '13:00'))
    const constats = controler(cetteSemaine, {
      vacationsAnterieures: avant,
      absences: [{ id: 'cp', collaborateurId: abel.id, debut: '2026-10-26', fin: '2026-10-26', type: 'conge-paye', prevue: true }],
    })
    const dimanche = constats.find((c) => c.categorie === 'Repos du dimanche')
    expect(dimanche).toMatchObject({ gravite: 'bloquant', jour: '2026-11-01' })
    // Un jour libre cette semaine suffit.
    expect(
      controler(cetteSemaine.slice(1), {
        vacationsAnterieures: avant,
        absences: [{ id: 'cp', collaborateurId: abel.id, debut: '2026-10-26', fin: '2026-10-26', type: 'conge-paye', prevue: true }],
      }).some((c) => c.categorie === 'Repos du dimanche'),
    ).toBe(false)
  })

  it('un dimanche travaillé cette semaine, sans jour libre : repos à prévoir la semaine suivante', () => {
    const vacations = [...jours.slice(1), '2026-11-08'].map((j, i) => v(`d${i}`, abel.id, RAYON.maree, j, '07:00', '12:45'))
    const constats = controler(vacations, {
      absences: [{ id: 'cp', collaborateurId: abel.id, debut: '2026-11-02', fin: '2026-11-02', type: 'conge-paye', prevue: true }],
    })
    const dimanche = constats.find((c) => c.categorie === 'Repos du dimanche')
    expect(dimanche?.aConfirmer).toBe(true)
    expect(dimanche?.libelle).toMatch(/à prévoir la semaine suivante/)
  })

  it('se règle : désactivée, elle ne signale rien', () => {
    const vacations = [...jours.slice(1), '2026-11-08'].map((j, i) => v(`d${i}`, abel.id, RAYON.maree, j, '07:00', '12:45'))
    const constats = controler(vacations, {
      absences: [{ id: 'cp', collaborateurId: abel.id, debut: '2026-11-02', fin: '2026-11-02', type: 'conge-paye', prevue: true }],
      organisation: { ...etat.organisation, reglesInternes: { ...etat.organisation.reglesInternes, reposCompletAutourDuDimanche: false } },
    })
    expect(constats.some((c) => c.categorie === 'Repos du dimanche')).toBe(false)
  })
})
