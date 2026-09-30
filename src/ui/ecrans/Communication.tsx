import { useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import {
  LIBELLES_IMPORTANCE,
  LIBELLES_NOTE,
  type ImportanceNote,
  type TypeNote,
} from '../../domaine/faits'
import { rayonsActifs } from '../../domaine/magasin'
import { useDonnees } from '../DonneesProvider'
import { ChampTexte } from '../composants/Champ'

const TYPES: readonly TypeNote[] = ['consigne', 'brief', 'compte-rendu', 'note']
const IMPORTANCES: readonly ImportanceNote[] = ['information', 'importante', 'urgente']

export function Communication() {
  const { etat, modifier } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)

  const [titre, setTitre] = useState('')
  const [contenu, setContenu] = useState('')
  const [type, setType] = useState<TypeNote>('consigne')
  const [importance, setImportance] = useState<ImportanceNote>('information')
  const [rayonId, setRayonId] = useState('')

  function ajouter(): void {
    if (titre.trim() === '') return
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      notes: [
        ...precedent.notes,
        {
          id: `n-${Date.now()}`,
          date: aujourdhui(),
          titre: titre.trim(),
          contenu: contenu.trim(),
          importance,
          type,
          rayonId: rayonId === '' ? null : rayonId,
        },
      ],
    }))
    setTitre('')
    setContenu('')
  }

  function retirer(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      notes: precedent.notes.filter((note) => note.id !== identifiant),
    }))
  }

  const notes = [...etat.notes].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  return (
    <>
      <header className="entete">
        <h1>Communication</h1>
        <p>Consignes, briefs, comptes rendus de réunion et notes datées.</p>
      </header>

      <section className="carte">
        <h2>Nouvelle note</h2>
        <p className="avis">
          <strong>Des faits et des consignes de travail.</strong> Jamais d’appréciation sur une
          personne, jamais de motif médical, jamais de commentaire sur la vie privée.
        </p>

        <div className="champs">
          <ChampTexte libelle="Titre" valeur={titre} onChange={setTitre} placeholder="Mise en place du catalogue…" />
          <label className="champ champ--etroit">
            <span className="champ__libelle">Type</span>
            <select className="champ__saisie" value={type} onChange={(e) => setType(e.target.value as TypeNote)}>
              {TYPES.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {LIBELLES_NOTE[valeur]}
                </option>
              ))}
            </select>
          </label>
          <label className="champ champ--etroit">
            <span className="champ__libelle">Rayon</span>
            <select className="champ__saisie" value={rayonId} onChange={(e) => setRayonId(e.target.value)}>
              <option value="">Tout le service</option>
              {rayons.map((rayon) => (
                <option key={rayon.id} value={rayon.id}>
                  {rayon.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="champ">
          <span className="champ__libelle">Contenu</span>
          <textarea
            className="champ__saisie champ__saisie--texte"
            rows={3}
            value={contenu}
            onChange={(evenement) => setContenu(evenement.target.value)}
          />
        </label>

        <p className="champ__libelle">Importance</p>
        <div className="groupe-boutons">
          {IMPORTANCES.map((valeur) => (
            <button
              key={valeur}
              type="button"
              className={importance === valeur ? 'bouton bouton--principal' : 'bouton'}
              onClick={() => setImportance(valeur)}
            >
              {LIBELLES_IMPORTANCE[valeur]}
            </button>
          ))}
        </div>

        <p>
          <button type="button" className="bouton bouton--principal" disabled={titre.trim() === ''} onClick={ajouter}>
            Enregistrer
          </button>
        </p>
      </section>

      <section className="carte">
        <h2>Notes</h2>
        {notes.length === 0 ? (
          <p>Aucune note enregistrée.</p>
        ) : (
          <ul className="liste-alertes">
            {notes.map((note) => (
              <li
                key={note.id}
                className={
                  note.importance === 'urgente'
                    ? 'alerte alerte--urgent'
                    : note.importance === 'importante'
                      ? 'alerte alerte--attention'
                      : 'alerte alerte--information'
                }
              >
                <p className="alerte__titre">{note.titre}</p>
                <p className="alerte__detail">
                  {LIBELLES_NOTE[note.type]} · {dateEnTexte(note.date)}
                  {note.rayonId !== null &&
                    ` · ${rayons.find((rayon) => rayon.id === note.rayonId)?.nom ?? note.rayonId}`}
                </p>
                {note.contenu !== '' && <p className="alerte__detail">{note.contenu}</p>}
                <p>
                  <button type="button" className="bouton bouton--discret" onClick={() => retirer(note.id)}>
                    Supprimer
                  </button>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
