import { useMemo } from 'react'
import { useDonnees } from '../DonneesProvider'
import { controlerAvantValidation, peutSortir } from '../../moteurs/planning/controles'
import type { BesoinJour } from '../../moteurs/besoin'
import type { Infraction, Vacation } from '../../moteurs/regles'

/**
 * Controles avant validation (§9.10).
 *
 * Ce qu'on verifie avant de soumettre, puis avant de publier. Un seul controle
 * bloque : une regle legale enfreinte. Les autres alertent — un ecart au
 * contrat peut etre assume, pas une duree de travail illegale.
 */

interface Proprietes {
  readonly besoins: readonly BesoinJour[]
  readonly vacations: readonly Vacation[]
  readonly infractions: readonly Infraction[]
}

export function ControlesValidation({ besoins, vacations, infractions }: Proprietes) {
  const { etat } = useDonnees()

  const controles = useMemo(
    () =>
      controlerAvantValidation({
        besoins,
        vacations,
        collaborateurs: etat.collaborateurs,
        infractions,
      }),
    [besoins, vacations, etat.collaborateurs, infractions],
  )

  const sortieAutorisee = peutSortir(controles)

  return (
    <section className="carte">
      <h2>Contrôles avant validation</h2>

      {sortieAutorisee ? (
        <p className="avis avis--succes">
          Aucune règle légale enfreinte : ce planning peut être soumis et publié.
        </p>
      ) : (
        <p className="avis avis--attention">
          <strong>Ce planning ne doit pas sortir en l’état.</strong> Une règle légale est
          enfreinte ; la publication à l’équipe est bloquée tant qu’elle n’est pas corrigée.
        </p>
      )}

      <ul className="controles">
        {controles.map((controle) => (
          <li key={controle.id} className={`controle controle--${controle.resultat}`}>
            <span className="controle__marque" aria-hidden="true">
              {controle.resultat === 'bon' ? '✓' : controle.resultat === 'alerte' ? '!' : '✕'}
            </span>
            <span className="controle__corps">
              <span className="controle__titre">{controle.titre}</span>
              <span className="controle__detail">{controle.detail}</span>
              {controle.conseil !== undefined && (
                <span className="controle__conseil">{controle.conseil}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="champ__aide">
        Seules les règles légales bloquent. Les autres lignes signalent ce qui mérite un
        arbitrage : elles n’empêchent rien.
      </p>
    </section>
  )
}
