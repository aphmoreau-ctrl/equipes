import { useCallback, useEffect, useRef, useState } from 'react'
import {
  genererLePlanning,
  type EntreesGeneration,
  type ResultatGeneration,
} from '../moteurs/planning/generateur'

/**
 * Lance la generation dans un fil separe, pour que l'ecran reste vivant.
 *
 * Si le navigateur ne sait pas creer de fil — ou si la creation echoue — le
 * calcul se fait dans le fil principal : mieux vaut un ecran fige quelques
 * secondes qu'un bouton qui ne fait rien.
 */

export type EtatGeneration = 'au-repos' | 'en-cours'

interface Reponse {
  readonly ok: boolean
  readonly resultat?: ResultatGeneration
  readonly message?: string
}

export function useGenerateur() {
  const [etat, setEtat] = useState<EtatGeneration>('au-repos')
  const [erreur, setErreur] = useState<string | null>(null)
  const fil = useRef<Worker | null>(null)

  useEffect(() => {
    return () => {
      fil.current?.terminate()
      fil.current = null
    }
  }, [])

  const generer = useCallback(
    (entrees: EntreesGeneration, surResultat: (resultat: ResultatGeneration) => void): void => {
      setErreur(null)
      setEtat('en-cours')

      const auFilPrincipal = (): void => {
        try {
          surResultat(genererLePlanning(entrees))
        } catch (echec) {
          setErreur(echec instanceof Error ? echec.message : 'Le calcul a échoué.')
        } finally {
          setEtat('au-repos')
        }
      }

      if (typeof Worker === 'undefined') {
        auFilPrincipal()
        return
      }

      try {
        fil.current?.terminate()
        const ouvrier = new Worker(
          new URL('../moteurs/planning/generateur.worker.ts', import.meta.url),
          { type: 'module' },
        )
        fil.current = ouvrier

        ouvrier.onmessage = (evenement: MessageEvent<Reponse>) => {
          const reponse = evenement.data
          if (reponse.ok && reponse.resultat !== undefined) surResultat(reponse.resultat)
          else setErreur(reponse.message ?? 'Le calcul a échoué.')
          setEtat('au-repos')
          ouvrier.terminate()
          if (fil.current === ouvrier) fil.current = null
        }

        ouvrier.onerror = () => {
          ouvrier.terminate()
          if (fil.current === ouvrier) fil.current = null
          // Le fil separe a echoue : on recalcule ici plutot que de ne rien faire.
          auFilPrincipal()
        }

        ouvrier.postMessage(entrees)
      } catch {
        auFilPrincipal()
      }
    },
    [],
  )

  return { etat, erreur, generer }
}
