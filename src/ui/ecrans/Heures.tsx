import { useMemo, useState } from 'react'
import { aujourdhui, dateEnTexte, nomDuMois } from '../../domaine/calendrier'
import { dureeEnTexte } from '../../domaine/temps'
import {
  calculerLesElementsVariables,
  exporterEnCsv,
  minutesRealisees,
  totaliser,
} from '../../moteurs/heures'
import { toutesLesVacations } from '../../donnees/etat'
import { useDonnees } from '../DonneesProvider'
import { ChampNombre } from '../composants/Champ'
import { ecartEnTexte, heuresEnTexte, nombreEnTexte } from '../../domaine/nombres'

export function Heures() {
  const { etat, modifier } = useDonnees()
  const [mois, setMois] = useState(() => aujourdhui().slice(0, 7))
  const [detaille, setDetaille] = useState<string | null>(null)

  const vacations = useMemo(() => toutesLesVacations(etat), [etat])

  const elements = useMemo(
    () =>
      calculerLesElementsVariables(
        mois,
        vacations,
        etat.saisiesHeures,
        etat.collaborateurs,
        etat.reglesParametres,
        etat.parametresHeures,
      ),
    [mois, vacations, etat.saisiesHeures, etat.collaborateurs, etat.reglesParametres, etat.parametresHeures],
  )

  const totaux = totaliser(elements)

  function enregistrerLeRealise(collaborateurId: string, jour: string, heures: number): void {
    modifier((precedent) => {
      const autres = precedent.saisiesHeures.filter(
        (saisie) => !(saisie.collaborateurId === collaborateurId && saisie.jour === jour),
      )
      return {
        ...precedent,
        demonstration: false,
        saisiesHeures: [
          ...autres,
          {
            id: `h-${collaborateurId}-${jour}`,
            collaborateurId,
            jour,
            minutesRealisees: Math.round(heures * 60),
          },
        ],
      }
    })
  }

  function telecharger(): void {
    const contenu = exporterEnCsv(elements)
    // Le BOM permet a un tableur francais d'ouvrir le fichier sans fausser les accents.
    const fichier = new Blob([`﻿${contenu}`], { type: 'text/csv;charset=utf-8;' })
    const adresse = URL.createObjectURL(fichier)
    const lien = document.createElement('a')
    lien.href = adresse
    lien.download = `elements-variables-${mois}.csv`
    lien.click()
    URL.revokeObjectURL(adresse)
  }

  const joursDuMois = [
    ...new Set(
      vacations
        .filter((vacation) => vacation.jour.slice(0, 7) === mois)
        .map((vacation) => vacation.jour),
    ),
  ].sort()

  return (
    <>
      <header className="entete">
        <h1>Heures</h1>
        <p>
          Heures prévues et réalisées, majorations, compteurs, export des éléments variables de paie.
        </p>
      </header>

      <section className="carte">
        <div className="champs">
          <label className="champ champ--etroit">
            <span className="champ__libelle">Mois</span>
            <input
              type="month"
              className="champ__saisie"
              value={mois}
              onChange={(evenement) => setMois(evenement.target.value)}
            />
          </label>
        </div>
        <p className="champ__aide">
          {nomDuMois(Number(mois.slice(5, 7)))} {mois.slice(0, 4)}
        </p>

        <dl className="liste-faits">
          <dt>Heures prévues</dt>
          <dd>{heuresEnTexte(totaux.heuresPrevues)}</dd>
          <dt>Heures réalisées</dt>
          <dd>{heuresEnTexte(totaux.heuresRealisees)}</dd>
          <dt>Heures supplémentaires</dt>
          <dd>{heuresEnTexte(totaux.heuresSupplementaires)}</dd>
          <dt>Heures complémentaires</dt>
          <dd>{heuresEnTexte(totaux.heuresComplementaires)}</dd>
          <dt>Heures de nuit</dt>
          <dd>{heuresEnTexte(totaux.heuresDeNuit)}</dd>
        </dl>
      </section>

      <section className="carte">
        <h2>Éléments variables de paie</h2>
        {elements.length === 0 ? (
          <p>Aucune heure enregistrée ce mois-ci. Construisez d’abord un planning.</p>
        ) : (
          <>
            <div className="grille-cadre">
              <table className="grille grille--compacte">
                <thead>
                  <tr>
                    <th scope="col" className="grille__personne">
                      Collaborateur
                    </th>
                    <th scope="col">Prévu</th>
                    <th scope="col">Réalisé</th>
                    <th scope="col">Écart</th>
                    <th scope="col">Sup. 25 %</th>
                    <th scope="col">Sup. 50 %</th>
                    <th scope="col">Compl.</th>
                    <th scope="col">Nuit</th>
                    <th scope="col">Dim.</th>
                    <th scope="col">Fériés</th>
                  </tr>
                </thead>
                <tbody>
                  {elements.map((element) => (
                    <tr key={element.collaborateurId}>
                      <th scope="row" className="grille__personne">
                        <button
                          type="button"
                          className="bouton bouton--discret"
                          onClick={() =>
                            setDetaille(
                              detaille === element.collaborateurId ? null : element.collaborateurId,
                            )
                          }
                        >
                          {element.nom}
                        </button>
                      </th>
                      <td>{nombreEnTexte(element.heuresPrevues)}</td>
                      <td>{nombreEnTexte(element.heuresRealisees)}</td>
                      <td className={element.ecart < 0 ? 'grille__ecart--haut' : undefined}>
                        {ecartEnTexte(element.ecart)}
                      </td>
                      <td>{nombreEnTexte(element.heuresSupplementaires25)}</td>
                      <td>{nombreEnTexte(element.heuresSupplementaires50)}</td>
                      <td>{nombreEnTexte(element.heuresComplementaires)}</td>
                      <td>{nombreEnTexte(element.heuresDeNuit)}</td>
                      <td>{element.dimanchesTravailles}</td>
                      <td>{element.joursFeriesTravailles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="avis">
              Ces chiffres préparent la paie, ils ne la remplacent pas. <strong>Le bulletin de
              paie fait foi.</strong>
            </p>

            <button type="button" className="bouton bouton--principal" onClick={telecharger}>
              Exporter en CSV
            </button>
            <p className="champ__aide">
              Le fichier s’ouvre dans un tableur. Sur iPad, il est enregistré dans Fichiers.
            </p>
          </>
        )}
      </section>

      {detaille !== null && (
        <section className="carte">
          <h2>
            {elements.find((element) => element.collaborateurId === detaille)?.nom ?? detaille}
          </h2>
          <p>
            Heures réalisées, jour par jour. Par défaut, le réalisé reprend le prévu : ne saisissez
            que les écarts.
          </p>
          <ul className="liste-simple">
            {joursDuMois
              .filter((jour) =>
                vacations.some(
                  (vacation) => vacation.collaborateurId === detaille && vacation.jour === jour,
                ),
              )
              .map((jour) => {
                const prevues =
                  vacations
                    .filter((v) => v.collaborateurId === detaille && v.jour === jour)
                    .reduce((somme, v) => somme + (v.pauseMinutes >= 0 ? 0 : 0), 0) || 0
                const realisees = minutesRealisees(vacations, etat.saisiesHeures, detaille, jour)
                return (
                  <li key={jour} className="ligne-saisie">
                    <span>
                      <strong>{dateEnTexte(jour)}</strong>{' '}
                      <span className="champ__aide">
                        réalisé {dureeEnTexte(Math.round(realisees))}
                        {prevues > 0 && ` (prévu ${dureeEnTexte(prevues)})`}
                      </span>
                    </span>
                    <ChampNombre
                      libelle="Heures"
                      valeur={Number((realisees / 60).toFixed(2))}
                      pas={0.25}
                      onChange={(heures) => enregistrerLeRealise(detaille, jour, heures)}
                    />
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      <section className="carte">
        <h2>Réglages des majorations</h2>
        <div className="champs">
          <ChampNombre
            libelle="Heures sup. jusqu’au seuil"
            suffixe="%"
            valeur={etat.parametresHeures.majorationHeuresSup25}
            onChange={(valeur) =>
              modifier((precedent) => ({
                ...precedent,
                parametresHeures: { ...precedent.parametresHeures, majorationHeuresSup25: valeur },
              }))
            }
          />
          <ChampNombre
            libelle="Heures sup. au-delà"
            suffixe="%"
            valeur={etat.parametresHeures.majorationHeuresSup50}
            onChange={(valeur) =>
              modifier((precedent) => ({
                ...precedent,
                parametresHeures: { ...precedent.parametresHeures, majorationHeuresSup50: valeur },
              }))
            }
          />
          <ChampNombre
            libelle="Seuil"
            suffixe="h / semaine"
            valeur={etat.parametresHeures.seuilMajorationSuperieure}
            onChange={(valeur) =>
              modifier((precedent) => ({
                ...precedent,
                parametresHeures: {
                  ...precedent.parametresHeures,
                  seuilMajorationSuperieure: valeur,
                },
              }))
            }
          />
        </div>
        <p className="avis avis--attention">
          Valeurs de départ à vérifier avec votre convention et les accords du magasin.
        </p>
      </section>
    </>
  )
}
