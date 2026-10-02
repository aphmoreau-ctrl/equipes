import { useMemo } from 'react'
import { useDonnees } from '../DonneesProvider'
import { nomAffiche } from '../../domaine/collaborateur'
import { semainesObservees, mesurerLEquite, aSoulager } from '../../moteurs/planning/equite'
import { dateEnTexte } from '../../domaine/calendrier'
import { ecartEnTexte } from '../../domaine/nombres'
import type { Vacation } from '../../moteurs/regles'

/**
 * Equite des sujetions sur quatre semaines (§9.8).
 *
 * Les samedis, dimanches, ouvertures et fermetures ne se repartissent pas
 * tout seuls. Cet ecran dit qui en porte plus que sa part — sur les quatre
 * dernieres semaines, pas depuis toujours : c'est ce qui se discute.
 */

interface Proprietes {
  readonly semaine: string
  /** Toutes les vacations connues, toutes semaines confondues. */
  readonly toutesLesVacations: readonly Vacation[]
}

export function Equite({ semaine, toutesLesVacations }: Proprietes) {
  const { etat } = useDonnees()

  const equite = useMemo(
    () => mesurerLEquite(semaine, toutesLesVacations, etat.collaborateurs),
    [semaine, toutesLesVacations, etat.collaborateurs],
  )

  const surcharges = aSoulager(equite)
  const observees = semainesObservees(semaine)
  const premiere = observees[0] ?? semaine

  const nom = (identifiant: string): string => {
    const collaborateur = etat.collaborateurs.find((c) => c.id === identifiant)
    return collaborateur === undefined ? identifiant : nomAffiche(collaborateur)
  }

  /** On n'affiche que ceux qui ont effectivement travaille ces semaines-la. */
  const concernes = equite.filter((personne) => personne.total > 0)

  return (
    <section className="carte">
      <h2>Équité sur quatre semaines</h2>
      <p>
        Samedis, dimanches, ouvertures et fermetures depuis le {dateEnTexte(premiere)}. Les
        compteurs de la fiche comptent depuis toujours ; ici, seules les quatre dernières semaines
        comptent — c’est ce qui se discute dans un service.
      </p>

      {concernes.length === 0 ? (
        <p className="champ__aide">
          Aucune sujétion enregistrée sur ces quatre semaines.
        </p>
      ) : (
        <>
          {surcharges.length > 0 && (
            <p className="avis avis--attention">
              <strong>
                {surcharges.length === 1
                  ? 'Une personne porte'
                  : `${surcharges.length} personnes portent`}{' '}
                nettement plus que leur part
              </strong>{' '}
              : {surcharges.map((personne) => nom(personne.collaborateurId)).join(', ')}. À
              soulager en priorité la semaine prochaine.
            </p>
          )}

          <div className="grille-cadre">
            <table className="grille grille--compacte">
              <thead>
                <tr>
                  <th scope="col">Collaborateur</th>
                  <th scope="col">Samedis</th>
                  <th scope="col">Dimanches</th>
                  <th scope="col">Ouvertures</th>
                  <th scope="col">Fermetures</th>
                  <th scope="col">Écart à la moyenne</th>
                </tr>
              </thead>
              <tbody>
                {concernes.map((personne) => (
                  <tr key={personne.collaborateurId}>
                    <th scope="row">{nom(personne.collaborateurId)}</th>
                    <td>{personne.samedis}</td>
                    <td>{personne.dimanches}</td>
                    <td>{personne.ouvertures}</td>
                    <td>{personne.fermetures}</td>
                    <td className={personne.ecart >= 1.5 ? 'grille__anomalie' : undefined}>
                      {ecartEnTexte(personne.ecart)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="champ__aide">
            Un dimanche pèse une fois et demie un samedi, une fermeture trois quarts, une
            ouverture la moitié : toutes les sujétions ne se valent pas.
          </p>
        </>
      )}
    </section>
  )
}
