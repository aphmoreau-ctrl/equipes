import { useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import { LIBELLES_DOCUMENT, type CategorieDocument } from '../../domaine/faits'
import { useDonnees } from '../DonneesProvider'
import { ChampTexte, Depliant, Interrupteur } from '../composants/Champ'

const CATEGORIES: readonly CategorieDocument[] = ['modele', 'procedure', 'affichage']

export function Documents() {
  const { etat, modifier } = useDonnees()
  const [titre, setTitre] = useState('')
  const [categorie, setCategorie] = useState<CategorieDocument>('procedure')

  function ajouter(): void {
    if (titre.trim() === '') return
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      documents: [
        ...precedent.documents,
        {
          id: `doc-${Date.now()}`,
          titre: titre.trim(),
          categorie,
          contenu: '',
          misAJourLe: aujourdhui(),
          obligatoire: categorie === 'affichage',
        },
      ],
    }))
    setTitre('')
  }

  function modifierDocument(identifiant: string, changement: Record<string, unknown>): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      documents: precedent.documents.map((document) =>
        document.id === identifiant
          ? { ...document, ...changement, misAJourLe: aujourdhui() }
          : document,
      ),
    }))
  }

  function retirer(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      documents: precedent.documents.filter((document) => document.id !== identifiant),
    }))
  }

  return (
    <>
      <header className="entete">
        <h1>Documents</h1>
        <p>Modèles, procédures et affichages obligatoires.</p>
      </header>

      <section className="carte">
        <h2>Nouveau document</h2>
        <div className="champs">
          <ChampTexte
            libelle="Titre"
            valeur={titre}
            onChange={setTitre}
            placeholder="Procédure de réception…"
          />
          <label className="champ champ--etroit">
            <span className="champ__libelle">Catégorie</span>
            <select
              className="champ__saisie"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as CategorieDocument)}
            >
              {CATEGORIES.map((valeur) => (
                <option key={valeur} value={valeur}>
                  {LIBELLES_DOCUMENT[valeur]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="bouton bouton--principal"
          disabled={titre.trim() === ''}
          onClick={ajouter}
        >
          Ajouter
        </button>

        <p className="avis avis--attention">
          Les documents sont enregistrés <strong>sur cet appareil</strong>, en texte. Le stockage de
          fichiers (PDF, photos) viendra avec Firebase.
        </p>
      </section>

      {CATEGORIES.map((valeur) => {
        const deLaCategorie = etat.documents.filter((document) => document.categorie === valeur)
        if (deLaCategorie.length === 0) return null

        return (
          <section key={valeur} className="carte">
            <h2>{LIBELLES_DOCUMENT[valeur]}s</h2>
            {deLaCategorie.map((document) => (
              <Depliant
                key={document.id}
                titre={document.titre}
                resume={`mis à jour le ${dateEnTexte(document.misAJourLe)}${document.obligatoire ? ' · obligatoire' : ''}`}
              >
                <div className="champs">
                  <ChampTexte
                    libelle="Titre"
                    valeur={document.titre}
                    onChange={(nouveau) => modifierDocument(document.id, { titre: nouveau })}
                  />
                </div>
                <label className="champ">
                  <span className="champ__libelle">Contenu</span>
                  <textarea
                    className="champ__saisie champ__saisie--texte"
                    rows={5}
                    value={document.contenu}
                    onChange={(evenement) =>
                      modifierDocument(document.id, { contenu: evenement.target.value })
                    }
                  />
                </label>
                <p className="champ__libelle">Caractère obligatoire</p>
                <Interrupteur
                  libelle={document.obligatoire ? 'Affichage obligatoire' : 'Document interne'}
                  actif={document.obligatoire}
                  onChange={(obligatoire) => modifierDocument(document.id, { obligatoire })}
                />
                <p>
                  <button
                    type="button"
                    className="bouton bouton--discret"
                    onClick={() => retirer(document.id)}
                  >
                    Supprimer ce document
                  </button>
                </p>
              </Depliant>
            ))}
          </section>
        )
      })}

      {etat.documents.length === 0 && (
        <section className="carte">
          <h2>Aucun document</h2>
          <p>
            Commencez par vos procédures de rayon et les affichages obligatoires : horaires,
            coordonnées de la médecine du travail, consignes de sécurité.
          </p>
        </section>
      )}
    </>
  )
}
