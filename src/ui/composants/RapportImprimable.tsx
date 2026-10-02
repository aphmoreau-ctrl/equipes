import { dateEnTexte, nomDuMois, semaineDe } from '../../domaine/calendrier'
import type { ActionProposee, TableauDeBord } from '../../moteurs/indicateurs/pilotage'
import { eurosEnTexte, heuresEnTexte, nombreEnTexte } from '../../domaine/nombres'

/**
 * Rapport destine au patron (cahier des charges §14 et §15).
 *
 * Regle absolue, appliquee ici : ni statut de suivi, ni remarques, ni
 * historique, ni note personnelle, ni reglage technique. Uniquement des
 * indicateurs utiles et un plan d'actions.
 */

export type TypeRapport = 'hebdomadaire' | 'mensuel'

export function RapportImprimable({
  type,
  tableau,
  actions,
  nomDuService,
  edite,
}: {
  readonly type: TypeRapport
  readonly tableau: TableauDeBord
  readonly actions: readonly ActionProposee[]
  readonly nomDuService: string
  readonly edite: string
}) {
  const jours = semaineDe(tableau.semaine)
  const periode =
    type === 'hebdomadaire'
      ? `du ${dateEnTexte(tableau.semaine)} au ${dateEnTexte(jours[6] ?? tableau.semaine)}`
      : `${nomDuMois(Number(tableau.semaine.slice(5, 7)))} ${tableau.semaine.slice(0, 4)}`

  const pourcent = (valeur: number) => `${Math.round(valeur * 100)} %`
  const heures = (valeur: number) => `${heuresEnTexte(valeur)}`

  return (
    <div className="document">
      <header className="document__entete">
        <h1 className="document__titre">
          {type === 'hebdomadaire' ? 'Rapport hebdomadaire' : 'Bilan mensuel'}
        </h1>
        <p className="document__sous-titre">
          Service {nomDuService} — {periode}
        </p>
        <p className="document__reperes">Édité le {dateEnTexte(edite)}</p>
      </header>

      <section className="document__rayon">
        <h2 className="document__rayon-titre">Indicateurs</h2>
        <table className="document__tableau">
          <tbody>
            <tr>
              <th scope="row">Effectif</th>
              <td>{tableau.effectif} personnes</td>
              <th scope="row">Heures prévues</th>
              <td>{heures(tableau.heuresPrevues)}</td>
            </tr>
            <tr>
              <th scope="row">Budget</th>
              <td>{heures(tableau.heuresBudget)}</td>
              <th scope="row">Écart au budget</th>
              <td>
                {tableau.ecartAuBudget > 0 ? '+' : ''}
                {heures(tableau.ecartAuBudget)}
              </td>
            </tr>
            <tr>
              <th scope="row">Couverture du besoin</th>
              <td>{pourcent(tableau.couverture)}</td>
              <th scope="row">Heures supplémentaires</th>
              <td>{heures(tableau.heuresSupplementaires)}</td>
            </tr>
            {tableau.heuresRenforts > 0 && (
              <tr>
                <th scope="row">Renforts extérieurs</th>
                <td>{heures(tableau.heuresRenforts)}</td>
                <th scope="row">Coût des renforts</th>
                <td>{eurosEnTexte(tableau.coutRenforts, 0)}</td>
              </tr>
            )}
            <tr>
              <th scope="row">Absentéisme</th>
              <td>{pourcent(tableau.absenteisme)}</td>
              <th scope="row">Conformité</th>
              <td>
                {tableau.reglesEnfreintes === 0
                  ? 'Aucune règle enfreinte'
                  : `${tableau.reglesEnfreintes} règle${tableau.reglesEnfreintes > 1 ? 's' : ''} enfreinte${tableau.reglesEnfreintes > 1 ? 's' : ''}`}
              </td>
            </tr>
            <tr>
              <th scope="row">Polyvalence moyenne</th>
              <td>{nombreEnTexte(tableau.polyvalenceMoyenne)} postes par personne</td>
              <th scope="row">Postes fragiles</th>
              <td>{tableau.competencesFragiles}</td>
            </tr>
            {tableau.chiffreAffaires !== null && (
              <tr>
                <th scope="row">Chiffre d’affaires</th>
                <td>{eurosEnTexte(tableau.chiffreAffaires, 0)}</td>
                <th scope="row">Productivité</th>
                <td>
                  {tableau.productivite === null
                    ? '—'
                    : `${eurosEnTexte(tableau.productivite, 0)} par heure`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="document__rayon">
        <h2 className="document__rayon-titre">Plan d’actions</h2>
        {actions.length === 0 ? (
          <p className="document__vide">
            Aucun point d’attention sur la période. Les indicateurs sont dans les clous.
          </p>
        ) : (
          <table className="document__tableau">
            <thead>
              <tr>
                <th scope="col">Priorité</th>
                <th scope="col">Point d’attention</th>
                <th scope="col">Action proposée</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.titre}>
                  <td>{action.priorite}</td>
                  <th scope="row">{action.titre}</th>
                  <td>{action.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="document__pied">
        {nomDuService} — {periode}
      </footer>
    </div>
  )
}
