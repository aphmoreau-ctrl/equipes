import { TRANCHE_MINUTES, enTexte } from '../../domaine/temps'
import type { BesoinJour, Bloc } from '../../moteurs/besoin'

/**
 * Courbe de besoin d'une journee, par tranche de 30 minutes.
 *
 * Tout est exprime dans la MEME unite : la personne.
 * - la hauteur des barres empilees, c'est le travail a faire, converti en
 *   personnes (30 minutes de travail = une personne pendant la tranche) ;
 * - chaque couleur est un bloc, pour voir d'ou vient la charge ;
 * - la marche d'escalier, c'est le nombre de personnes finalement retenu,
 *   une fois la tolerance et la presence minimum appliquees.
 */

const COULEURS = [
  '#2f6f4e',
  '#6aa84f',
  '#3f7cac',
  '#d9822b',
  '#a2559c',
  '#c1453b',
  '#5a7d8c',
  '#8a6d3b',
  '#4b9b9b',
  '#9c6644',
  '#7b68a6',
  '#b08900',
] as const

export function couleurDuBloc(index: number): string {
  return COULEURS[index % COULEURS.length] ?? COULEURS[0]
}

const LARGEUR_TRANCHE = 17
const HAUTEUR = 230
const MARGE_GAUCHE = 30
const MARGE_DROITE = 8
const MARGE_HAUT = 12
const MARGE_BAS = 26

interface Proprietes {
  readonly besoin: BesoinJour
  readonly blocs: readonly Bloc[]
}

export function CourbeBesoin({ besoin, blocs }: Proprietes) {
  // On n'affiche que la partie utile de la journee, avec une tranche de marge.
  const occupees = besoin.tranches
    .filter((tranche) => tranche.minutesTotal > 0 || tranche.personnes > 0)
    .map((tranche) => tranche.index)

  const premiere = Math.max(0, Math.min(...occupees, 47) - 1)
  const derniere = Math.min(47, Math.max(...occupees, 0) + 1)
  const visibles = besoin.tranches.filter(
    (tranche) => tranche.index >= premiere && tranche.index <= derniere,
  )

  if (occupees.length === 0) {
    return <p className="courbe__vide">Aucun travail prévu ce jour-là pour ce rayon.</p>
  }

  const maximum = Math.max(
    1,
    ...visibles.map((tranche) =>
      Math.max(tranche.personnes, tranche.minutesTotal / TRANCHE_MINUTES),
    ),
  )
  const echelle = Math.ceil(maximum)

  const largeurTrace = visibles.length * LARGEUR_TRANCHE
  const largeur = MARGE_GAUCHE + largeurTrace + MARGE_DROITE
  const hauteurTrace = HAUTEUR - MARGE_HAUT - MARGE_BAS

  const y = (valeur: number) => MARGE_HAUT + hauteurTrace * (1 - valeur / echelle)
  const x = (position: number) => MARGE_GAUCHE + position * LARGEUR_TRANCHE

  // Marche d'escalier du nombre de personnes retenu.
  const marche: string[] = []
  visibles.forEach((tranche, position) => {
    const gauche = x(position)
    const droite = gauche + LARGEUR_TRANCHE
    const hauteur = y(tranche.personnes)
    marche.push(`${position === 0 ? 'M' : 'L'}${gauche} ${hauteur}`, `L${droite} ${hauteur}`)
  })

  const graduations = Array.from({ length: echelle + 1 }, (_, valeur) => valeur)

  return (
    <div className="courbe">
      <svg
        viewBox={`0 0 ${largeur} ${HAUTEUR}`}
        className="courbe__dessin"
        role="img"
        aria-label={
          `Besoin du rayon par tranche de 30 minutes. ` +
          `Pointe à ${Math.max(...visibles.map((t) => t.personnes))} personnes. ` +
          `${besoin.heuresTotal.toFixed(1)} heures de travail au total.`
        }
      >
        {/* Graduations horizontales */}
        {graduations.map((valeur) => (
          <g key={valeur}>
            <line
              x1={MARGE_GAUCHE}
              x2={largeur - MARGE_DROITE}
              y1={y(valeur)}
              y2={y(valeur)}
              className="courbe__graduation"
            />
            <text x={MARGE_GAUCHE - 6} y={y(valeur) + 4} className="courbe__graduation-texte">
              {valeur}
            </text>
          </g>
        ))}

        {/* Barres empilees, un segment par bloc */}
        {visibles.map((tranche, position) => {
          let cumul = 0
          return (
            <g key={tranche.index}>
              {blocs.map((bloc, indexBloc) => {
                const minutes = tranche.minutesParBloc[bloc.id] ?? 0
                if (minutes <= 0) return null
                const valeur = minutes / TRANCHE_MINUTES
                const bas = y(cumul)
                cumul += valeur
                const haut = y(cumul)
                return (
                  <rect
                    key={bloc.id}
                    x={x(position) + 1}
                    y={haut}
                    width={LARGEUR_TRANCHE - 2}
                    height={Math.max(0, bas - haut)}
                    fill={couleurDuBloc(indexBloc)}
                    opacity={0.85}
                  >
                    <title>
                      {`${enTexte(tranche.debutMinutes)} — ${bloc.nom} : ${Math.round(minutes)} min`}
                    </title>
                  </rect>
                )
              })}
            </g>
          )
        })}

        {/* Marche d'escalier : personnes retenues */}
        <path d={marche.join(' ')} className="courbe__marche" />

        {/* Heures en bas */}
        {visibles.map((tranche, position) =>
          tranche.debutMinutes % 120 === 0 ? (
            <text
              key={tranche.index}
              x={x(position)}
              y={HAUTEUR - 8}
              className="courbe__heure"
            >
              {enTexte(tranche.debutMinutes)}
            </text>
          ) : null,
        )}
      </svg>

      <ul className="courbe__legende">
        {blocs.map((bloc, index) => {
          const minutes = besoin.tranches.reduce(
            (somme, tranche) => somme + (tranche.minutesParBloc[bloc.id] ?? 0),
            0,
          )
          if (minutes <= 0) return null
          return (
            <li key={bloc.id} className="courbe__legende-element">
              <span
                className="courbe__pastille"
                style={{ background: couleurDuBloc(index) }}
                aria-hidden="true"
              />
              <span className="courbe__legende-nom">{bloc.nom}</span>
              <span className="courbe__legende-valeur">{(minutes / 60).toFixed(1)} h</span>
            </li>
          )
        })}
        <li className="courbe__legende-element">
          <span className="courbe__pastille courbe__pastille--marche" aria-hidden="true" />
          <span className="courbe__legende-nom">Personnes retenues</span>
          <span className="courbe__legende-valeur">{besoin.heuresPresence.toFixed(1)} h</span>
        </li>
      </ul>
    </div>
  )
}
