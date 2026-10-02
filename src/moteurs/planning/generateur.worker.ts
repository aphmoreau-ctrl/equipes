import { genererLePlanning, type EntreesGeneration, type ResultatGeneration } from './generateur'

/**
 * Calcul du planning dans un fil separe.
 *
 * Sur iPad, construire une proposition pour neuf rayons et une trentaine de
 * personnes occupe le processeur plusieurs secondes. Fait dans le fil
 * principal, l'ecran se fige : plus de defilement, plus de reponse au doigt,
 * et iOS finit par croire que l'application a plante.
 *
 * Ce fichier ne contient aucune logique : il recoit les entrees, appelle le
 * moteur — le meme que celui couvert par les tests — et renvoie le resultat.
 */

self.onmessage = (evenement: MessageEvent<EntreesGeneration>) => {
  try {
    const resultat: ResultatGeneration = genererLePlanning(evenement.data)
    self.postMessage({ ok: true, resultat })
  } catch (erreur) {
    self.postMessage({
      ok: false,
      message: erreur instanceof Error ? erreur.message : 'Erreur inconnue',
    })
  }
}
