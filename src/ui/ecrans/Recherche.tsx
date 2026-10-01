import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LIBELLES_RESULTAT,
  LONGUEUR_MINIMALE,
  RESULTATS_MAXIMUM,
  rechercher,
} from '../../moteurs/recherche'
import { useDonnees } from '../DonneesProvider'

/** Recherche globale (§15) : une personne, un rayon, une note, un document… */
export function Recherche() {
  const { etat } = useDonnees()
  const [texte, setTexte] = useState('')

  const resultats = useMemo(
    () =>
      rechercher(
        {
          collaborateurs: etat.collaborateurs,
          rayons: etat.magasin.rayons,
          notes: etat.notes,
          documents: etat.documents,
          formations: etat.formations,
          besoinsRecrutement: etat.besoinsRecrutement,
        },
        texte,
      ),
    [etat, texte],
  )
  const tropCourt = texte.trim().length < LONGUEUR_MINIMALE

  return (
    <>
      <header className="entete">
        <h1>Rechercher</h1>
        <p>Un collaborateur, un rayon, une compétence, une note, un document, une formation.</p>
      </header>

      <section className="carte">
        <label htmlFor="recherche-globale" className="visuellement-cache">
          Texte à rechercher
        </label>
        <input
          id="recherche-globale"
          className="champ-recherche"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Ex. : Camille, marée, découpe, inventaire…"
          value={texte}
          onChange={(evenement) => setTexte(evenement.target.value)}
        />
        <p className="avis">Majuscules et accents sont ignorés. Chaque mot tapé doit apparaître.</p>
      </section>

      {!tropCourt && (
        <section className="carte" aria-live="polite">
          <h2>
            {resultats.length === 0
              ? 'Aucun résultat'
              : `${resultats.length}${resultats.length === RESULTATS_MAXIMUM ? ' premiers' : ''} résultat${resultats.length > 1 ? 's' : ''}`}
          </h2>
          {resultats.length > 0 && (
            <ul className="resultats-recherche">
              {resultats.map((resultat) => (
                <li key={resultat.id}>
                  <Link to={resultat.chemin} className="resultat-recherche">
                    <span className="resultat-recherche__titre">
                      {resultat.titre}{' '}
                      <span className="etiquette">{LIBELLES_RESULTAT[resultat.type]}</span>
                    </span>
                    <span className="resultat-recherche__detail">{resultat.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
