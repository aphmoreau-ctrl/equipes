import { nomAffiche, type Collaborateur } from '../../domaine/collaborateur'
import { jourDeLaSemaine, nomDuJour } from '../../domaine/calendrier'
import { dureeTravailEffectif, type Vacation } from '../../moteurs/regles'
import type { Rayon } from '../../domaine/magasin'
import { ecartEnTexte, heuresEnTexte } from '../../domaine/nombres'

/**
 * Grille du planning : une ligne par personne, une colonne par jour.
 *
 * Conception iPad : on touche une case pour la remplir ou la vider.
 * Le glisser-deposer viendra plus tard ; le toucher est plus sur au doigt et
 * fonctionne aussi a la souris sur Mac.
 */
export function GrillePlanning({
  collaborateurs,
  jours,
  vacations,
  rayons,
  caseSelectionnee,
  infractionsParPersonne,
  renforts,
  casesVerrouillees,
  onChoisirCase,
  onBasculerVerrou,
}: {
  readonly collaborateurs: readonly Collaborateur[]
  readonly jours: readonly string[]
  readonly vacations: readonly Vacation[]
  readonly rayons: readonly Rayon[]
  readonly caseSelectionnee: { collaborateurId: string; jour: string } | null
  readonly infractionsParPersonne: Readonly<Record<string, number>>
  /**
   * Renforts exterieurs en mission cette semaine : interimaires, etudiants,
   * extras. Ils sont affiches pour qu'on voie qui est reellement la, mais
   * leurs cases ne se modifient pas ici — une mission se gere depuis l'ecran
   * du jour, et leur conformite legale releve de leur employeur.
   */
  readonly renforts: readonly {
    readonly id: string
    readonly nom: string
    readonly origine: string
    readonly vacations: readonly Vacation[]
  }[]
  /** Cases que l'utilisateur a verrouillees : « collaborateurId|jour ». */
  readonly casesVerrouillees: ReadonlySet<string>
  readonly onChoisirCase: (collaborateurId: string, jour: string) => void
  readonly onBasculerVerrou: (collaborateurId: string, jour: string) => void
}) {
  function vacationsDe(collaborateurId: string, jour: string): Vacation[] {
    return vacations.filter(
      (vacation) => vacation.collaborateurId === collaborateurId && vacation.jour === jour,
    )
  }

  function heuresDe(collaborateurId: string): number {
    return (
      vacations
        .filter((vacation) => vacation.collaborateurId === collaborateurId)
        .reduce((somme, vacation) => somme + dureeTravailEffectif(vacation), 0) / 60
    )
  }

  function nomDuRayon(rayonId: string): string {
    return rayons.find((rayon) => rayon.id === rayonId)?.nom ?? rayonId
  }

  return (
    <div className="grille-cadre">
      <table className="grille">
        <thead>
          <tr>
            <th scope="col" className="grille__personne">
              Collaborateur
            </th>
            {jours.map((jour) => (
              <th key={jour} scope="col">
                <span className="grille__jour">{nomDuJour(jourDeLaSemaine(jour)).slice(0, 3)}</span>
                <span className="grille__date">{jour.slice(8)}</span>
              </th>
            ))}
            <th scope="col" className="grille__total">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {collaborateurs.map((collaborateur) => {
            const heures = heuresDe(collaborateur.id)
            const ecart = heures - collaborateur.heuresHebdomadaires
            const infractions = infractionsParPersonne[collaborateur.id] ?? 0

            return (
              <tr key={collaborateur.id}>
                <th scope="row" className="grille__personne">
                  <span className="grille__nom">{nomAffiche(collaborateur)}</span>
                  <span className="grille__contrat">
                    {collaborateur.heuresHebdomadaires} h
                    {infractions > 0 && (
                      <span className="grille__anomalie" title="Règles non respectées">
                        {' '}
                        ⚠ {infractions}
                      </span>
                    )}
                  </span>
                </th>

                {jours.map((jour) => {
                  const dedans = vacationsDe(collaborateur.id, jour)
                  const choisie =
                    caseSelectionnee?.collaborateurId === collaborateur.id &&
                    caseSelectionnee.jour === jour

                  const verrouillee = casesVerrouillees.has(`${collaborateur.id}|${jour}`)
                  const classes = ['case']
                  if (choisie) classes.push('case--choisie')
                  if (verrouillee) classes.push('case--verrouillee')

                  return (
                    <td key={jour} className="case__boite">
                      <button
                        type="button"
                        className={classes.join(' ')}
                        aria-label={`${nomAffiche(collaborateur)}, ${nomDuJour(jourDeLaSemaine(jour))} ${jour}`}
                        onClick={() => onChoisirCase(collaborateur.id, jour)}
                      >
                        {dedans.length === 0 ? (
                          <span className="case__repos">—</span>
                        ) : (
                          dedans.map((vacation) => (
                            <span key={vacation.id} className="case__vacation">
                              <span className="case__heures">
                                {vacation.debut}–{vacation.fin}
                              </span>
                              <span className="case__rayon">{nomDuRayon(vacation.rayonId)}</span>
                            </span>
                          ))
                        )}
                      </button>
                      {dedans.length > 0 && (
                        <button
                          type="button"
                          className={
                            verrouillee ? 'verrou verrou--ferme' : 'verrou'
                          }
                          aria-pressed={verrouillee}
                          aria-label={
                            verrouillee
                              ? `Déverrouiller ${nomAffiche(collaborateur)}, ${nomDuJour(jourDeLaSemaine(jour))}`
                              : `Verrouiller ${nomAffiche(collaborateur)}, ${nomDuJour(jourDeLaSemaine(jour))}`
                          }
                          onClick={() => onBasculerVerrou(collaborateur.id, jour)}
                        >
                          {verrouillee ? '🔒' : '🔓'}
                        </button>
                      )}
                    </td>
                  )
                })}

                <td className="grille__total">
                  <span className="grille__heures">{heuresEnTexte(heures)}</span>
                  {Math.abs(ecart) >= 0.5 && (
                    <span className={ecart > 0 ? 'grille__ecart grille__ecart--haut' : 'grille__ecart'}>
                      {ecartEnTexte(ecart)}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>

        {renforts.length > 0 && (
          <tbody className="grille__renforts">
            <tr>
              <th scope="row" colSpan={jours.length + 2} className="grille__intertitre">
                Renforts extérieurs
              </th>
            </tr>

            {renforts.map((renfort) => {
              const heures =
                renfort.vacations.reduce(
                  (somme, vacation) => somme + dureeTravailEffectif(vacation),
                  0,
                ) / 60

              return (
                <tr key={renfort.id}>
                  <th scope="row" className="grille__personne">
                    <span className="grille__nom">{renfort.nom}</span>
                    <span className="grille__contrat">{renfort.origine}</span>
                  </th>

                  {jours.map((jour) => {
                    const duJour = renfort.vacations.filter((vacation) => vacation.jour === jour)
                    return (
                      <td key={jour}>
                        <span className="case case--renfort">
                          {duJour.length === 0 ? (
                            <span className="case__repos">—</span>
                          ) : (
                            duJour.map((vacation) => (
                              <span key={vacation.id} className="case__vacation">
                                <span className="case__heures">
                                  {vacation.debut}–{vacation.fin}
                                </span>
                                <span className="case__rayon">{nomDuRayon(vacation.rayonId)}</span>
                              </span>
                            ))
                          )}
                        </span>
                      </td>
                    )
                  })}

                  <td className="grille__total">
                    <span className="grille__heures">{heuresEnTexte(heures)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        )}
      </table>

      {renforts.length > 0 && (
        <p className="champ__aide">
          Les renforts extérieurs comptent dans la couverture du besoin, mais pas dans le contrôle
          des règles légales : leur temps de travail relève de leur employeur. Leurs missions se
          gèrent depuis l’écran « Aujourd’hui ».
        </p>
      )}
    </div>
  )
}
