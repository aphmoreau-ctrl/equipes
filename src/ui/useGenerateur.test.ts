import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGenerateur } from './useGenerateur'
import { semaineDe } from '../domaine/calendrier'
import { clientsParTranche, tranchesOuvertes } from '../domaine/magasin'
import { COLLABORATEURS_DEMO } from '../donnees/collaborateurs-demo'
import { CONFIGURATIONS_DEMO, MAGASIN_DEMO } from '../donnees/demo'
import { calculerBesoin } from '../moteurs/besoin'
import { PARAMETRES_PAR_DEFAUT } from '../moteurs/regles'
import type { EntreesPlusieursSemaines } from '../moteurs/planning/plusieursSemaines'

/** Donnees FICTIVES uniquement. */

const SEMAINE = '2026-11-02'

function entrees(): EntreesPlusieursSemaines {
  const configuration = CONFIGURATIONS_DEMO.find((c) => c.rayonId === 'cave-vins')
  if (configuration === undefined) throw new Error('Rayon de test introuvable.')

  return {
    semaines: [
      {
        semaine: SEMAINE,
        besoins: semaineDe(SEMAINE).map((date) =>
          calculerBesoin(configuration, {
            date,
            clientsParTranche: clientsParTranche(MAGASIN_DEMO, date),
            tranchesOuvertes: tranchesOuvertes(MAGASIN_DEMO, date, 'cave-vins'),
            meteo: 'normal',
            coefficientEvenements: 1,
            enPromotion: false,
            saisiesQualite: [],
          }),
        ),
      },
    ],
    rayons: MAGASIN_DEMO.rayons.filter((rayon) => rayon.id === 'cave-vins'),
    collaborateurs: COLLABORATEURS_DEMO,
    absences: [],
    horairesTypes: MAGASIN_DEMO.horairesTypes,
    parametres: PARAMETRES_PAR_DEFAUT,
    dureeMaximaleMs: 4000,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lancement du calcul', () => {
  it('calcule dans le fil principal quand les fils séparés n’existent pas', async () => {
    vi.stubGlobal('Worker', undefined)
    const { result } = renderHook(() => useGenerateur())
    expect(result.current.etat).toBe('au-repos')

    let recu: unknown = null
    act(() => {
      result.current.generer(entrees(), (resultat) => {
        recu = resultat
      })
    })

    await waitFor(() => expect(result.current.etat).toBe('au-repos'))
    expect(recu).not.toBeNull()
    expect(result.current.erreur).toBeNull()
  })

  it('se rabat sur le fil principal si le fil séparé échoue à démarrer', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('fils indisponibles')
        }
      },
    )

    const { result } = renderHook(() => useGenerateur())
    let recu: unknown = null
    act(() => {
      result.current.generer(entrees(), (resultat) => {
        recu = resultat
      })
    })

    await waitFor(() => expect(result.current.etat).toBe('au-repos'))
    // Le bouton a bien produit un planning, malgre l'echec du fil separe.
    expect(recu).not.toBeNull()
    expect(result.current.erreur).toBeNull()
  })
})
