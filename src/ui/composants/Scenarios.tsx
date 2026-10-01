import { useMemo, useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import type { BesoinJour } from '../../moteurs/besoin'
import type { Vacation } from '../../moteurs/regles'
import {
  comparerLesScenarios,
  expliquerLaDifference,
  type Scenario,
} from '../../moteurs/planning/scenarios'
import { useDonnees } from '../DonneesProvider'
import { ChampTexte } from '../composants/Champ'

/**
 * Scenarios : plusieurs versions d'une meme semaine, comparees cote a cote
 * (cahier des charges §9.4).
 *
 * Le planning en cours est toujours compare, sous le nom « En cours » : c'est
 * la reference, et il n'a pas besoin d'etre enregistre pour figurer au
 * tableau.
 */
export function Scenarios({
  semaine,
  vacationsEnCours,
  besoins,
  onRetenir,
}: {
  readonly semaine: string
  readonly vacationsEnCours: readonly Vacation[]
  readonly besoins: readonly BesoinJour[]
  readonly onRetenir: (vacations: readonly Vacation[]) => void
}) {
  const { etat, modifier, historique } = useDonnees()
  const [nom, setNom] = useState('')

  const enregistres = etat.scenariosParSemaine[semaine] ?? []

  const comparaisons = useMemo(() => {
    const enCours: Scenario = {
      id: 'en-cours',
      nom: 'En cours',
      semaine,
      vacations: vacationsEnCours,
      creeLe: aujourdhui(),
    }
    return comparerLesScenarios({
      scenarios: [enCours, ...enregistres],
      besoins,
      collaborateurs: etat.collaborateurs,
      parametres: etat.reglesParametres,
      vacationsAnterieures: historique(semaine),
    })
  }, [semaine, vacationsEnCours, enregistres, besoins, etat.collaborateurs, etat.reglesParametres, historique])

  function enregistrer(): void {
    const intitule = nom.trim() === '' ? `Version du ${dateEnTexte(aujourdhui())}` : nom.trim()
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      scenariosParSemaine: {
        ...precedent.scenariosParSemaine,
        [semaine]: [
          ...(precedent.scenariosParSemaine[semaine] ?? []),
          {
            id: `sc-${Date.now()}`,
            nom: intitule,
            semaine,
            vacations: vacationsEnCours,
            creeLe: aujourdhui(),
          },
        ],
      },
    }))
    setNom('')
  }

  function retirer(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      scenariosParSemaine: {
        ...precedent.scenariosParSemaine,
        [semaine]: (precedent.scenariosParSemaine[semaine] ?? []).filter(
          (scenario) => scenario.id !== identifiant,
        ),
      },
    }))
  }

  const reference = comparaisons.find((comparaison) => comparaison.scenarioId === 'en-cours')
  const meilleur = comparaisons[0]

  return (
    <section className="carte">
      <h2>Scénarios</h2>
      <p>
        Gardez plusieurs versions d’une même semaine et comparez-les sur les mêmes indicateurs :
        avec un intérimaire, sans ouverture du dimanche, avec des horaires décalés.
      </p>

      <div className="champs">
        <ChampTexte
          libelle="Nom du scénario"
          valeur={nom}
          onChange={setNom}
          placeholder="Avec un intérimaire le samedi…"
        />
      </div>
      <button
        type="button"
        className="bouton"
        disabled={vacationsEnCours.length === 0}
        onClick={enregistrer}
      >
        Enregistrer le planning actuel comme scénario
      </button>
      {vacationsEnCours.length === 0 && (
        <p className="champ__aide">
          Construisez d’abord un planning, ou demandez une proposition automatique.
        </p>
      )}

      {enregistres.length > 0 && (
        <>
          <div className="grille-cadre">
            <table className="grille grille--compacte">
              <thead>
                <tr>
                  <th scope="col" className="grille__personne">
                    Scénario
                  </th>
                  <th scope="col">Couverture</th>
                  <th scope="col">Heures</th>
                  <th scope="col">Manque</th>
                  <th scope="col">Sureffectif</th>
                  <th scope="col">Règles</th>
                  <th scope="col">Écart contrats</th>
                  <th scope="col">Renforts</th>
                </tr>
              </thead>
              <tbody>
                {comparaisons.map((comparaison) => (
                  <tr key={comparaison.scenarioId}>
                    <th scope="row" className="grille__personne">
                      {comparaison.nom}
                      {comparaison.scenarioId === meilleur?.scenarioId && (
                        <span className="grille__contrat">le mieux placé</span>
                      )}
                    </th>
                    <td>{Math.round(comparaison.couverture * 100)} %</td>
                    <td>{comparaison.heuresPrevues.toFixed(1)}</td>
                    <td>{comparaison.heuresManquantes.toFixed(1)}</td>
                    <td>{comparaison.heuresSureffectif.toFixed(1)}</td>
                    <td
                      className={
                        comparaison.reglesEnfreintes > 0 ? 'grille__anomalie' : undefined
                      }
                    >
                      {comparaison.reglesEnfreintes}
                    </td>
                    <td>{comparaison.ecartMoyenAuContrat.toFixed(1)}</td>
                    <td>{comparaison.renforts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="champ__aide">
            Couverture, heures et écarts en heures. « Règles » compte les règles légales
            enfreintes : un scénario qui en compte une est classé en dernier, quels que soient ses
            autres chiffres.
          </p>

          <ul className="liste-simple">
            {enregistres.map((scenario) => {
              const comparaison = comparaisons.find((c) => c.scenarioId === scenario.id)
              const differences =
                reference === undefined || comparaison === undefined
                  ? []
                  : expliquerLaDifference(reference, comparaison)

              return (
                <li key={scenario.id}>
                  <p>
                    <strong>{scenario.nom}</strong>{' '}
                    <span className="champ__aide">
                      enregistré le {dateEnTexte(scenario.creeLe)}, {scenario.vacations.length}{' '}
                      vacations
                    </span>
                  </p>
                  <p className="alerte__detail">
                    {differences.length === 0
                      ? 'Identique au planning en cours sur les indicateurs suivis.'
                      : `Par rapport au planning en cours : ${differences.join(' · ')}.`}
                  </p>
                  <p>
                    <button
                      type="button"
                      className="bouton"
                      onClick={() => onRetenir(scenario.vacations)}
                    >
                      Retenir ce scénario
                    </button>{' '}
                    <button
                      type="button"
                      className="bouton bouton--discret"
                      onClick={() => retirer(scenario.id)}
                    >
                      Supprimer
                    </button>
                  </p>
                </li>
              )
            })}
          </ul>

          <p className="avis avis--attention">
            « Retenir » <strong>remplace</strong> le planning de la semaine par celui du scénario.
            Enregistrez d’abord le planning en cours si vous voulez pouvoir y revenir.
          </p>
        </>
      )}
    </section>
  )
}
