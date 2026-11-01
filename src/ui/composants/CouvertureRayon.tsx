import { useState } from 'react'
import { jourDeLaSemaine, nomDuJour } from '../../domaine/calendrier'
import { nomAffiche, type Collaborateur } from '../../domaine/collaborateur'
import { TRANCHE_MINUTES, enMinutes, enTexte } from '../../domaine/temps'
import type { BesoinJour } from '../../moteurs/besoin'
import { couvreLaTranche } from '../../moteurs/indicateurs'
import type { Vacation } from '../../moteurs/regles'

/**
 * Couverture d'un rayon, heure par heure, pour la semaine.
 *
 * Une case par heure : le nombre de presents, et une couleur. Rouge si le
 * minimum n'est pas tenu sur au moins un quart d'heure de l'heure, orange si
 * la cible ne l'est pas, vert sinon, gris si le rayon ne demande personne.
 * Toucher une case donne le detail au quart d'heure, avec les pauses.
 */

type Etat = 'manque' | 'sous-cible' | 'bon' | 'vide'

interface Quart {
  readonly index: number
  readonly presents: number
  readonly minimum: number
  readonly cible: number
  readonly enPause: readonly string[]
}

interface Heure {
  readonly heure: number
  readonly etat: Etat
  /** Presents au quart d'heure le moins garni de l'heure. */
  readonly presents: number
  readonly quarts: readonly Quart[]
}

function etatDe(quarts: readonly Quart[]): Etat {
  if (quarts.every((q) => q.minimum === 0 && q.cible === 0)) return 'vide'
  if (quarts.some((q) => q.presents < q.minimum)) return 'manque'
  if (quarts.some((q) => q.presents < q.cible)) return 'sous-cible'
  return 'bon'
}

const LIBELLES: Readonly<Record<Etat, string>> = {
  manque: 'minimum non tenu',
  'sous-cible': 'minimum tenu, cible non atteinte',
  bon: 'cible atteinte',
  vide: 'personne n’est attendu',
}

export function heuresDuRayon(
  besoin: BesoinJour,
  vacations: readonly Vacation[],
  collaborateurs: readonly Collaborateur[],
): Heure[] {
  const duRayon = vacations.filter((v) => v.rayonId === besoin.rayonId && v.jour === besoin.date)
  const nom = (id: string) => {
    const c = collaborateurs.find((x) => x.id === id)
    return c === undefined ? id : nomAffiche(c)
  }
  const heures: Heure[] = []
  for (let heure = 0; heure < 24; heure += 1) {
    const quarts: Quart[] = []
    for (let q = 0; q < 60 / TRANCHE_MINUTES; q += 1) {
      const index = (heure * 60) / TRANCHE_MINUTES + q
      const tranche = besoin.tranches[index]
      const debutTranche = index * TRANCHE_MINUTES
      quarts.push({
        index,
        presents: duRayon.filter((v) => couvreLaTranche(v, index)).length,
        minimum: tranche?.personnes ?? 0,
        cible: tranche?.cible ?? tranche?.personnes ?? 0,
        enPause: duRayon
          .filter(
            (v) =>
              v.pauseDebut !== undefined &&
              enMinutes(v.pauseDebut) < debutTranche + TRANCHE_MINUTES &&
              enMinutes(v.pauseDebut) + v.pauseMinutes > debutTranche &&
              !couvreLaTranche(v, index),
          )
          .map((v) => nom(v.collaborateurId)),
      })
    }
    heures.push({
      heure,
      etat: etatDe(quarts),
      presents: Math.min(...quarts.map((q) => q.presents)),
      quarts,
    })
  }
  return heures
}

export function CouvertureRayon({
  besoins,
  vacations,
  collaborateurs,
}: {
  readonly besoins: readonly BesoinJour[]
  readonly vacations: readonly Vacation[]
  readonly collaborateurs: readonly Collaborateur[]
}) {
  const [choisie, setChoisie] = useState<{ date: string; heure: number } | null>(null)
  const parJour = besoins.map((besoin) => ({
    besoin,
    heures: heuresDuRayon(besoin, vacations, collaborateurs),
  }))

  // Les heures affichees : de la premiere a la derniere ou quelqu'un est attendu.
  const utiles = parJour.flatMap(({ heures }) =>
    heures.filter((h) => h.etat !== 'vide' || h.presents > 0).map((h) => h.heure),
  )
  if (utiles.length === 0) return null
  const premiere = Math.min(...utiles)
  const derniere = Math.max(...utiles)
  const colonnes = Array.from({ length: derniere - premiere + 1 }, (_, i) => premiere + i)

  const detail =
    choisie === null
      ? null
      : parJour.find((j) => j.besoin.date === choisie.date)?.heures[choisie.heure]

  return (
    <div className="couverture-rayon">
      <div className="grille-cadre">
        <table className="couverture-rayon__table">
          <thead>
            <tr>
              <th scope="col">Jour</th>
              {colonnes.map((heure) => (
                <th key={heure} scope="col">
                  {heure} h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parJour.map(({ besoin, heures }) => (
              <tr key={besoin.date}>
                <th scope="row">{nomDuJour(jourDeLaSemaine(besoin.date))}</th>
                {colonnes.map((heure) => {
                  const h = heures[heure] as Heure
                  return (
                    <td key={heure}>
                      <button
                        type="button"
                        className={`couverture-rayon__case couverture-rayon__case--${h.etat}`}
                        aria-label={`${nomDuJour(jourDeLaSemaine(besoin.date))} ${heure} h : ${h.presents} présent${h.presents > 1 ? 's' : ''}, ${LIBELLES[h.etat]}`}
                        aria-pressed={choisie?.date === besoin.date && choisie.heure === heure}
                        onClick={() =>
                          setChoisie(
                            choisie?.date === besoin.date && choisie.heure === heure
                              ? null
                              : { date: besoin.date, heure },
                          )
                        }
                      >
                        {h.etat === 'vide' && h.presents === 0 ? '' : h.presents}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="couverture-rayon__legende">
        <span className="couverture-rayon__puce couverture-rayon__case--manque" /> minimum non tenu
        <span className="couverture-rayon__puce couverture-rayon__case--sous-cible" /> cible non
        atteinte
        <span className="couverture-rayon__puce couverture-rayon__case--bon" /> cible atteinte ·
        chiffre = présents au quart d’heure le moins garni
      </p>

      {detail !== null && detail !== undefined && choisie !== null && (
        <div className="couverture-rayon__detail" role="status">
          <strong>
            {nomDuJour(jourDeLaSemaine(choisie.date))}, {choisie.heure} h – {choisie.heure + 1} h
          </strong>
          <ul className="liste-simple">
            {detail.quarts.map((q) => (
              <li key={q.index}>
                {enTexte(q.index * TRANCHE_MINUTES)} : {q.presents} présent
                {q.presents > 1 ? 's' : ''}, minimum {q.minimum}, cible {q.cible}
                {q.enPause.length > 0 && ` — en pause : ${q.enPause.join(', ')}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
