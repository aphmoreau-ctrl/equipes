/**
 * Mise en forme des nombres a la francaise.
 *
 * En francais, la virgule separe les decimales : « 794,5 h », jamais
 * « 794.5 h ». JavaScript, lui, ecrit a l'anglaise par defaut. Tout nombreEnTexte
 * affiche a l'ecran ou imprime passe donc par ce fichier.
 */

/** Un nombreEnTexte a virgule : nombreEnTexte(794.5) donne « 794,5 ». */
export function nombreEnTexte(valeur: number, decimales = 1): string {
  // -0 existe en JavaScript et s'ecrirait « -0,0 » : on le ramene a zero.
  const propre = Object.is(valeur, -0) ? 0 : valeur
  return propre.toFixed(decimales).replace('.', ',')
}

/** Une duree en heuresEnTexte : heuresEnTexte(794.5) donne « 794,5 h ». */
export function heuresEnTexte(valeur: number, decimales = 1): string {
  return `${nombreEnTexte(valeur, decimales)} h`
}

/**
 * Un ecartEnTexte, toujours signe : ecartEnTexte(2.5) donne « +2,5 », ecartEnTexte(-10) « −10,0 ».
 * Le signe negatif est le vrai signe moins (−), plus lisible que le trait
 * d'union a l'ecran comme a l'impression.
 */
export function ecartEnTexte(valeur: number, decimales = 1): string {
  if (Math.abs(valeur) < 0.5 / 10 ** decimales) return nombreEnTexte(0, decimales)
  const signe = valeur > 0 ? '+' : '−'
  return `${signe}${nombreEnTexte(Math.abs(valeur), decimales)}`
}

/** Une somme : eurosEnTexte(1234.5) donne « 1 234,50 € ». */
export function eurosEnTexte(valeur: number, decimales = 2): string {
  const arrondi = Number(valeur.toFixed(decimales))
  const texte = arrondi.toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
  // Selon les appareils, le separateur de milliers est une espace fine
  // insecable ou une espace insecable : on fixe l'espace insecable partout.
  return `${texte.replace(/[  \s]/g, ' ')} €`
}
