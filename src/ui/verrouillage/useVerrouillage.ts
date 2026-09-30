import { useCallback, useEffect, useState } from 'react'
import { codeCorrespond, creerVerrou } from './code'
import { creerCleAcces, faceIdDisponible, verifierCleAcces, type ResultatFaceId } from './faceId'
import {
  effacerCleAcces,
  effacerVerrou,
  enregistrerCleAcces,
  enregistrerVerrou,
  lireCleAcces,
  lireVerrou,
} from './stockage'

export type EtatVerrouillage =
  | 'chargement'
  | 'a-definir'
  | 'proposer-face-id'
  | 'verrouille'
  | 'ouvert'

/**
 * Pilote le verrouillage : premier lancement, ouverture, Face ID, changement
 * de code. Le code est toujours defini en premier : il reste le secours quand
 * Face ID echoue ou n'est pas disponible.
 */
export function useVerrouillage() {
  const [etat, setEtat] = useState<EtatVerrouillage>('chargement')
  const [faceIdPossible, setFaceIdPossible] = useState(false)
  const [faceIdEnregistre, setFaceIdEnregistre] = useState(false)

  useEffect(() => {
    let encoreMonte = true
    setFaceIdEnregistre(lireCleAcces() !== null)
    setEtat(lireVerrou() === null ? 'a-definir' : 'verrouille')

    void faceIdDisponible().then((possible) => {
      if (encoreMonte) setFaceIdPossible(possible)
    })

    return () => {
      encoreMonte = false
    }
  }, [])

  const definirCode = useCallback(
    async (code: string): Promise<void> => {
      enregistrerVerrou(await creerVerrou(code))
      // Juste apres avoir choisi son code, on propose Face ID - une seule fois.
      setEtat(faceIdPossible && lireCleAcces() === null ? 'proposer-face-id' : 'ouvert')
    },
    [faceIdPossible],
  )

  const essayerCode = useCallback(async (code: string): Promise<boolean> => {
    const verrou = lireVerrou()
    if (verrou === null) {
      setEtat('a-definir')
      return false
    }
    const correspond = await codeCorrespond(code, verrou)
    if (correspond) setEtat('ouvert')
    return correspond
  }, [])

  const essayerFaceId = useCallback(async (): Promise<ResultatFaceId> => {
    const cle = lireCleAcces()
    if (cle === null) return 'echec'
    const resultat = await verifierCleAcces(cle)
    if (resultat === 'reussi') setEtat('ouvert')
    return resultat
  }, [])

  const activerFaceId = useCallback(async (): Promise<void> => {
    enregistrerCleAcces(await creerCleAcces())
    setFaceIdEnregistre(true)
    setEtat('ouvert')
  }, [])

  const ignorerFaceId = useCallback((): void => {
    setEtat('ouvert')
  }, [])

  const desactiverFaceId = useCallback((): void => {
    effacerCleAcces()
    setFaceIdEnregistre(false)
  }, [])

  const changerDeCode = useCallback((): void => {
    effacerVerrou()
    setEtat('a-definir')
  }, [])

  return {
    etat,
    faceIdPossible,
    faceIdEnregistre,
    definirCode,
    essayerCode,
    essayerFaceId,
    activerFaceId,
    ignorerFaceId,
    desactiverFaceId,
    changerDeCode,
  }
}
