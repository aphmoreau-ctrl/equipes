import { useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import {
  EXPLICATIONS_ETAT,
  LIBELLES_ETAT,
  etatsSuivants,
  remarquesDuPatron,
  type EtatSuivi,
  type Suivi,
} from '../../domaine/suivi'

/**
 * Circuit de suivi (cahier des charges §9.6).
 *
 * L'application ne soumet rien et ne valide rien : elle garde la trace d'un
 * circuit qu'Arnaud renseigne lui-meme. Tout reste visible UNIQUEMENT ici :
 * ni le statut ni les remarques ne figurent sur un PDF.
 */
/**
 * Le circuit est le meme pour tous les documents soumis au patron : plannings,
 * conges, puis recrutements. Ce composant sert a tous.
 */
export function SuiviPlanning({
  planning,
  titre = 'Suivi',
  onChanger,
}: {
  readonly planning: Suivi
  readonly titre?: string
  readonly onChanger: (etat: EtatSuivi, date: string, remarques: string) => void
}) {
  const [etatChoisi, setEtatChoisi] = useState<EtatSuivi | null>(null)
  const [date, setDate] = useState(aujourdhui)
  const [remarques, setRemarques] = useState('')

  const suivants = etatsSuivants(planning.etat)
  const remarquesPassees = remarquesDuPatron(planning)

  function valider(): void {
    if (etatChoisi === null) return
    onChanger(etatChoisi, date, remarques.trim())
    setEtatChoisi(null)
    setRemarques('')
  }

  return (
    <section className="carte">
      <h2>{titre}</h2>
      <p>
        <span className={`etat etat--${planning.etat}`}>{LIBELLES_ETAT[planning.etat]}</span>{' '}
        <span className="champ__aide">version {planning.version}</span>
      </p>
      <p>{EXPLICATIONS_ETAT[planning.etat]}</p>

      <p className="avis">
        Ce suivi est visible <strong>uniquement dans l’application</strong>. Ni le statut, ni les
        remarques, ni l’historique ne figurent sur les documents imprimés.
      </p>

      <p className="champ__libelle">Étape suivante</p>
      <div className="groupe-boutons">
        {suivants.map((etat) => (
          <button
            key={etat}
            type="button"
            className={etatChoisi === etat ? 'bouton bouton--principal' : 'bouton'}
            onClick={() => setEtatChoisi(etatChoisi === etat ? null : etat)}
          >
            {LIBELLES_ETAT[etat]}
          </button>
        ))}
      </div>

      {etatChoisi !== null && (
        <>
          <div className="champs">
            <label className="champ champ--etroit">
              <span className="champ__libelle">Date</span>
              <input
                type="date"
                className="champ__saisie"
                value={date}
                onChange={(evenement) => setDate(evenement.target.value)}
              />
            </label>
          </div>

          {etatChoisi === 'a-corriger' && (
            <label className="champ">
              <span className="champ__libelle">Remarques du patron</span>
              <textarea
                className="champ__saisie champ__saisie--texte"
                rows={3}
                value={remarques}
                placeholder="Ce qu’il vous a demandé de revoir…"
                onChange={(evenement) => setRemarques(evenement.target.value)}
              />
              <span className="champ__aide">
                Note de travail interne. Sur l’organisation du travail seulement, jamais sur une
                personne.
              </span>
            </label>
          )}

          <p>
            <button type="button" className="bouton bouton--principal" onClick={valider}>
              Enregistrer « {LIBELLES_ETAT[etatChoisi]} »
            </button>{' '}
            <button type="button" className="bouton" onClick={() => setEtatChoisi(null)}>
              Annuler
            </button>
          </p>
        </>
      )}

      {remarquesPassees.length > 0 && (
        <>
          <p className="champ__libelle">Remarques du patron</p>
          <ul className="liste-simple">
            {remarquesPassees.map((evenement) => (
              <li key={evenement.id}>
                <strong>{dateEnTexte(evenement.date)}</strong> (version {evenement.version}) —{' '}
                {evenement.remarques}
              </li>
            ))}
          </ul>
        </>
      )}

      {planning.historique.length > 0 && (
        <>
          <p className="champ__libelle">Historique</p>
          <ul className="liste-simple">
            {[...planning.historique].reverse().map((evenement) => (
              <li key={evenement.id}>
                {LIBELLES_ETAT[evenement.etat]} — {dateEnTexte(evenement.date)} (version{' '}
                {evenement.version})
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
