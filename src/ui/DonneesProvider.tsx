import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clientsParTranche, tranchesOuvertes } from '../domaine/magasin'
import { calculerBesoin, type BesoinJour, type ContexteJour } from '../moteurs/besoin'
import { coefficientEvenements } from '../domaine/magasin'
import {
  configurationDeRayon,
  effacerEtat,
  enPromotion,
  enregistrerEtat,
  etatInitial,
  lireEtat,
  meteoDuJour,
  saisiesDuJour,
  type EtatApplication,
} from '../donnees/etat'

interface ValeurDonnees {
  readonly etat: EtatApplication
  /** Modifie l'etat et l'enregistre aussitot. */
  readonly modifier: (transformation: (etat: EtatApplication) => EtatApplication) => void
  /** Revient aux donnees de demonstration. */
  readonly reinitialiser: () => void
  /** Calcule le besoin d'un rayon pour une date, ou null si le rayon n'a pas de modele. */
  readonly besoinDuJour: (date: string, rayonId: string) => BesoinJour | null
}

const Contexte = createContext<ValeurDonnees | null>(null)

export function DonneesProvider({ children }: { readonly children: ReactNode }) {
  const [etat, setEtat] = useState<EtatApplication>(etatInitial)

  useEffect(() => {
    setEtat(lireEtat())
  }, [])

  const modifier = useCallback(
    (transformation: (precedent: EtatApplication) => EtatApplication) => {
      setEtat((precedent) => {
        const suivant = transformation(precedent)
        enregistrerEtat(suivant)
        return suivant
      })
    },
    [],
  )

  const reinitialiser = useCallback(() => {
    effacerEtat()
    setEtat(etatInitial())
  }, [])

  const besoinDuJour = useCallback(
    (date: string, rayonId: string): BesoinJour | null => {
      const configuration = configurationDeRayon(etat, rayonId)
      if (configuration === undefined) return null

      const contexte: ContexteJour = {
        date,
        clientsParTranche: clientsParTranche(etat.magasin, date),
        tranchesOuvertes: tranchesOuvertes(etat.magasin, date, rayonId),
        meteo: meteoDuJour(etat, date),
        coefficientEvenements: coefficientEvenements(etat.magasin, date, rayonId),
        enPromotion: enPromotion(etat, date, rayonId),
        saisiesQualite: saisiesDuJour(etat, date, rayonId),
      }
      return calculerBesoin(configuration, contexte)
    },
    [etat],
  )

  const valeur = useMemo<ValeurDonnees>(
    () => ({ etat, modifier, reinitialiser, besoinDuJour }),
    [etat, modifier, reinitialiser, besoinDuJour],
  )

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useDonnees(): ValeurDonnees {
  const valeur = useContext(Contexte)
  if (valeur === null) {
    throw new Error('useDonnees doit être utilisé à l’intérieur de DonneesProvider.')
  }
  return valeur
}
