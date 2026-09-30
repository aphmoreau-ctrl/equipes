import { useEffect, useState } from 'react'

/**
 * Deux dispositions possibles :
 * - « colonne » : menu lateral a gauche avec tous les modules (iPad, Mac) ;
 * - « onglets » : barre fixe en bas a cinq onglets (iPhone).
 */
export type Disposition = 'colonne' | 'onglets'

/**
 * La hauteur compte autant que la largeur : un iPhone couche est large
 * (plus de 800 points) mais tres bas. Sans la condition de hauteur, il
 * recevrait le menu lateral, inutilisable sur 400 points de haut.
 *
 * iPad portrait 768 x 1024 : colonne. iPad paysage 1024 x 768 : colonne.
 * iPhone debout 390 x 844 : onglets. iPhone couche 844 x 390 : onglets.
 */
export const REQUETE_COLONNE = '(min-width: 768px) and (min-height: 600px)'

function mesurer(): Disposition {
  if (typeof window.matchMedia !== 'function') return 'onglets'
  return window.matchMedia(REQUETE_COLONNE).matches ? 'colonne' : 'onglets'
}

/** Suit la taille de l'ecran, y compris quand l'iPad est pivote. */
export function useDisposition(): Disposition {
  const [disposition, setDisposition] = useState<Disposition>(mesurer)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const requete = window.matchMedia(REQUETE_COLONNE)
    const surChangement = (): void => {
      setDisposition(requete.matches ? 'colonne' : 'onglets')
    }
    surChangement()
    requete.addEventListener('change', surChangement)
    return () => requete.removeEventListener('change', surChangement)
  }, [])

  return disposition
}
