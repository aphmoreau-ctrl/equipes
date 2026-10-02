import { useEffect, useId, useRef, useState } from 'react'
import { JOURS_SEMAINE, aujourdhui, nomDuJour } from '../../../domaine/calendrier'
import type { JourSemaine } from '../../../domaine/calendrier'
import { LIBELLES_CONTRAT, type TypeContrat } from '../../../domaine/collaborateur'
import type { Rayon } from '../../../domaine/magasin'

/**
 * Fenetre « Nouveau collaborateur ».
 *
 * Elle remplace l'ancien comportement, qui creait aussitot une fiche
 * « Nouveau X. » a corriger ensuite : on saisissait a l'aveugle, et une fiche
 * incomplete restait dans l'effectif si l'on changeait d'avis.
 *
 * Sur iPad et Mac : fenetre centree, fond assombri. Sur iPhone : panneau qui
 * monte du bas. La bascule se fait en CSS, a la meme taille d'ecran que le
 * menu lateral.
 *
 * RGPD : prenom et INITIALE du nom, rien d'autre. Aucune appreciation, aucune
 * situation personnelle. Les competences se reglent ensuite dans la fiche.
 */

/** Contrats a duree determinee : eux seuls ont des dates de debut et de fin. */
const CONTRATS_DATES: readonly TypeContrat[] = ['cdd', 'interim', 'apprenti']

const CONTRATS: readonly TypeContrat[] = ['cdi', 'cdd', 'interim', 'apprenti', 'etudiant']

export interface BrouillonCollaborateur {
  readonly prenom: string
  readonly initiale: string
  readonly rayonPrincipal: string
  readonly rayonsSecondaires: readonly string[]
  readonly contrat: TypeContrat
  readonly heuresHebdomadaires: number
  readonly dateEntree: string
  readonly finContrat: string | null
  readonly reposFixes: readonly JourSemaine[]
}

interface Proprietes {
  readonly rayons: readonly Rayon[]
  /** Rayon preselectionne : celui que l'ecran Equipe filtre, s'il y en a un. */
  readonly rayonParDefaut: string
  readonly onEnregistrer: (brouillon: BrouillonCollaborateur) => void
  readonly onFermer: () => void
}

function brouillonVide(rayonParDefaut: string): BrouillonCollaborateur {
  return {
    prenom: '',
    initiale: '',
    rayonPrincipal: rayonParDefaut,
    rayonsSecondaires: [],
    contrat: 'cdi',
    heuresHebdomadaires: 35,
    dateEntree: aujourdhui(),
    finContrat: null,
    reposFixes: [],
  }
}

/** Le minimum pour qu'une fiche ait un sens : un prenom et un rayon. */
function estComplet(brouillon: BrouillonCollaborateur): boolean {
  return brouillon.prenom.trim() !== '' && brouillon.rayonPrincipal !== ''
}

export function NouveauCollaborateur({
  rayons,
  rayonParDefaut,
  onEnregistrer,
  onFermer,
}: Proprietes) {
  const [brouillon, setBrouillon] = useState(() => brouillonVide(rayonParDefaut))
  const [commence, setCommence] = useState(false)
  const [etape, setEtape] = useState<'saisie' | 'confirmer-abandon' | 'enregistre'>('saisie')
  const champPrenom = useRef<HTMLInputElement>(null)
  const titre = useId()

  // Le curseur se place dans le prenom : c'est toujours par la qu'on commence.
  useEffect(() => {
    champPrenom.current?.focus()
  }, [etape])

  function changer(changement: Partial<BrouillonCollaborateur>): void {
    setCommence(true)
    setBrouillon((precedent) => ({ ...precedent, ...changement }))
  }

  /** Fermer : on ne jette jamais une saisie commencee sans demander. */
  function demanderFermeture(): void {
    if (etape === 'enregistre' || !commence) {
      onFermer()
      return
    }
    setEtape('confirmer-abandon')
  }

  function enregistrer(): void {
    if (!estComplet(brouillon)) return
    onEnregistrer({
      ...brouillon,
      prenom: brouillon.prenom.trim(),
      initiale: brouillon.initiale.trim(),
      finContrat: CONTRATS_DATES.includes(brouillon.contrat) ? brouillon.finContrat : null,
    })
    setEtape('enregistre')
  }

  function recommencer(): void {
    setBrouillon(brouillonVide(rayonParDefaut))
    setCommence(false)
    setEtape('saisie')
  }

  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent): void => {
      if (evenement.key === 'Escape') demanderFermeture()
    }
    window.addEventListener('keydown', surTouche)
    return () => window.removeEventListener('keydown', surTouche)
  })

  const complet = estComplet(brouillon)
  const avecDates = CONTRATS_DATES.includes(brouillon.contrat)

  return (
    <>
      <button
        type="button"
        className="voile voile--fenetre"
        aria-label="Fermer en touchant à côté"
        onClick={demanderFermeture}
      />

      <div className="fenetre" role="dialog" aria-modal="true" aria-labelledby={titre}>
        <div className="fenetre__entete">
          <h2 className="fenetre__titre" id={titre}>
            Nouveau collaborateur
          </h2>
          <button
            type="button"
            className="bouton bouton--discret fenetre__fermer"
            aria-label="Fermer la fenêtre"
            onClick={demanderFermeture}
          >
            ✕
          </button>
        </div>

        {etape === 'enregistre' && (
          <div className="fenetre__corps">
            <p className="avis avis--succes">Collaborateur ajouté.</p>
            <p className="champ__aide">
              Ses compétences et ses disponibilités se règlent dans sa fiche, dans la liste de
              l’équipe.
            </p>
            <div className="fenetre__actions">
              <button type="button" className="bouton" onClick={onFermer}>
                Fermer
              </button>
              <button type="button" className="bouton bouton--principal" onClick={recommencer}>
                Ajouter un autre
              </button>
            </div>
          </div>
        )}

        {etape === 'confirmer-abandon' && (
          <div className="fenetre__corps">
            <p className="avis avis--attention">
              <strong>Abandonner la saisie ?</strong> Ce que vous avez commencé à remplir sera
              perdu.
            </p>
            {/* Le bouton vert est celui qui ne detruit rien. */}
            <div className="fenetre__actions">
              <button
                type="button"
                className="bouton bouton--principal"
                onClick={() => setEtape('saisie')}
              >
                Continuer la saisie
              </button>
              <button type="button" className="bouton" onClick={onFermer}>
                Abandonner
              </button>
            </div>
          </div>
        )}

        {etape === 'saisie' && (
          <>
            <div className="fenetre__corps">
              <div className="fenetre__identite">
                <label className="champ">
                  <span className="champ__libelle">Prénom</span>
                  <input
                    ref={champPrenom}
                    type="text"
                    className="champ__saisie"
                    value={brouillon.prenom}
                    onChange={(evenement) => changer({ prenom: evenement.target.value })}
                  />
                </label>
                <label className="champ champ--etroit">
                  <span className="champ__libelle">Initiale du nom</span>
                  <input
                    type="text"
                    className="champ__saisie"
                    maxLength={2}
                    value={brouillon.initiale}
                    onChange={(evenement) => changer({ initiale: evenement.target.value })}
                  />
                </label>
              </div>
              <p className="champ__aide">
                Prénom et initiale uniquement : « Camille D. ». Jamais le nom entier.
              </p>

              <p className="champ__libelle" id="titre-rayon-principal">
                Rayon principal
              </p>
              <div className="choix" role="group" aria-labelledby="titre-rayon-principal">
                {rayons.map((rayon) => (
                  <button
                    key={rayon.id}
                    type="button"
                    className={
                      brouillon.rayonPrincipal === rayon.id
                        ? 'bouton bouton--principal'
                        : 'bouton'
                    }
                    aria-pressed={brouillon.rayonPrincipal === rayon.id}
                    onClick={() =>
                      changer({
                        rayonPrincipal: rayon.id,
                        rayonsSecondaires: brouillon.rayonsSecondaires.filter(
                          (autre) => autre !== rayon.id,
                        ),
                      })
                    }
                  >
                    {rayon.nom}
                  </button>
                ))}
              </div>

              <p className="champ__libelle" id="titre-rayons-appui">
                Rayons où il peut aider
              </p>
              <div className="choix" role="group" aria-labelledby="titre-rayons-appui">
                {rayons
                  .filter((rayon) => rayon.id !== brouillon.rayonPrincipal)
                  .map((rayon) => {
                    const retenu = brouillon.rayonsSecondaires.includes(rayon.id)
                    return (
                      <button
                        key={rayon.id}
                        type="button"
                        className={retenu ? 'bouton bouton--principal' : 'bouton'}
                        aria-pressed={retenu}
                        onClick={() =>
                          changer({
                            rayonsSecondaires: retenu
                              ? brouillon.rayonsSecondaires.filter((autre) => autre !== rayon.id)
                              : [...brouillon.rayonsSecondaires, rayon.id],
                          })
                        }
                      >
                        {rayon.nom}
                      </button>
                    )
                  })}
              </div>

              <p className="champ__libelle" id="titre-contrat">
                Type de contrat
              </p>
              <div className="choix" role="group" aria-labelledby="titre-contrat">
                {CONTRATS.map((contrat) => (
                  <button
                    key={contrat}
                    type="button"
                    className={
                      brouillon.contrat === contrat ? 'bouton bouton--principal' : 'bouton'
                    }
                    aria-pressed={brouillon.contrat === contrat}
                    onClick={() => changer({ contrat })}
                  >
                    {LIBELLES_CONTRAT[contrat]}
                  </button>
                ))}
              </div>

              <label className="champ champ--etroit">
                <span className="champ__libelle">Heures par semaine au contrat</span>
                <input
                  type="number"
                  className="champ__saisie"
                  inputMode="decimal"
                  min={0}
                  max={48}
                  step={0.5}
                  value={brouillon.heuresHebdomadaires}
                  onChange={(evenement) =>
                    changer({ heuresHebdomadaires: Number(evenement.target.value) })
                  }
                />
              </label>

              {avecDates && (
                <div className="fenetre__dates">
                  <label className="champ champ--etroit">
                    <span className="champ__libelle">Début du contrat</span>
                    <input
                      type="date"
                      className="champ__saisie"
                      value={brouillon.dateEntree}
                      onChange={(evenement) => changer({ dateEntree: evenement.target.value })}
                    />
                  </label>
                  <label className="champ champ--etroit">
                    <span className="champ__libelle">Fin du contrat</span>
                    <input
                      type="date"
                      className="champ__saisie"
                      value={brouillon.finContrat ?? ''}
                      onChange={(evenement) =>
                        changer({
                          finContrat: evenement.target.value === '' ? null : evenement.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              )}

              <p className="champ__libelle" id="titre-repos">
                Jours de repos fixes
              </p>
              <div className="jours" role="group" aria-labelledby="titre-repos">
                {JOURS_SEMAINE.map((jour) => {
                  const repos = brouillon.reposFixes.includes(jour)
                  return (
                    <button
                      key={jour}
                      type="button"
                      className={
                        repos ? 'bouton bouton--principal bouton--jour' : 'bouton bouton--jour'
                      }
                      aria-pressed={repos}
                      aria-label={nomDuJour(jour)}
                      onClick={() =>
                        changer({
                          reposFixes: repos
                            ? brouillon.reposFixes.filter((autre) => autre !== jour)
                            : [...brouillon.reposFixes, jour],
                        })
                      }
                    >
                      {nomDuJour(jour).slice(0, 1).toUpperCase()}
                    </button>
                  )
                })}
              </div>
              <p className="champ__aide">
                Les compétences se règlent ensuite dans la fiche du collaborateur.
              </p>
            </div>

            <div className="fenetre__pied">
              <button type="button" className="bouton" onClick={demanderFermeture}>
                Annuler
              </button>
              <button
                type="button"
                className="bouton bouton--principal"
                disabled={!complet}
                onClick={enregistrer}
              >
                Enregistrer
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
