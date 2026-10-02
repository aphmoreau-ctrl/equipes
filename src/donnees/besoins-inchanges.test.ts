import { describe, expect, it } from 'vitest'
import { calculerBesoin } from '../moteurs/besoin'
import type { ContexteJour } from '../moteurs/besoin'
import {
  clientsParTranche,
  coefficientEvenements,
  tranchesOuvertes,
} from '../domaine/magasin'
import { semaineDe } from '../domaine/calendrier'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from './demo'

/**
 * GARDE-FOU : le besoin des rayons existants ne doit pas bouger.
 *
 * Arnaud a des plannings deja saisis. Ajouter des rayons, des niveaux de
 * competence ou reorganiser le catalogue ne doit RIEN changer a la charge
 * calculee pour les rayons qui existaient avant. Les valeurs ci-dessous ont
 * ete relevees le 2 octobre 2026, avant le lot 1a.
 *
 * Si un de ces chiffres change, ce n'est pas le test qu'il faut corriger :
 * c'est que la charge d'un rayon existant a ete modifiee sans le vouloir.
 */
const HEURES_ATTENDUES: Readonly<Record<string, number>> = {
  'fruits-legumes': 128.752,
  boucherie: 97.517,
  maree: 49.768,
  cremerie: 52.858,
  'charcuterie-traiteur': 81.007,
  fromage: 52.49,
  boulangerie: 58.267,
}

/** Semaine de reference, en conditions neutres : ni meteo, ni promotion. */
const SEMAINE = semaineDe('2026-09-28')

function heuresDeLaSemaine(rayonId: string): number {
  const configuration = CONFIGURATIONS_DEMO.find((c) => c.rayonId === rayonId)
  if (configuration === undefined) throw new Error(`Rayon « ${rayonId} » introuvable.`)

  let total = 0
  for (const date of SEMAINE) {
    const contexte: ContexteJour = {
      date,
      clientsParTranche: clientsParTranche(MAGASIN_DEMO, date),
      tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, date, rayonId),
      meteo: 'normal',
      coefficientEvenements: coefficientEvenements(MAGASIN_DEMO, date, rayonId),
      enPromotion: false,
      saisiesQualite: [],
    }
    total += calculerBesoin(configuration, contexte).heuresTotal
  }
  return total
}

describe('les rayons existants ne bougent pas', () => {
  for (const [rayonId, attendu] of Object.entries(HEURES_ATTENDUES)) {
    it(`garde la même charge pour « ${rayonId} »`, () => {
      expect(heuresDeLaSemaine(rayonId)).toBeCloseTo(attendu, 2)
    })
  }
})
