import { useMemo, useState } from 'react'
import {
  ajouterJours,
  aujourdhui,
  dateEnTexte,
  jourDeLaSemaine,
  lundiDeLaSemaine,
  nomDuJour,
  semaineDe,
} from '../../domaine/calendrier'
import { estDisponible, nomAffiche, peutTravaillerDans } from '../../domaine/collaborateur'
import { rayonsActifs } from '../../domaine/magasin'
import {
  afficheEquipeImprimable,
  changerEtat,
  datePublication,
  type EtatSuivi,
} from '../../domaine/planning'
import { enTexte } from '../../domaine/temps'
import {
  contexteDeVerification,
  verifier,
  type Infraction,
  type Vacation,
} from '../../moteurs/regles'
import {
  calculerCouverture,
  expliquerLeTrou,
  regrouperLesTrous,
} from '../../moteurs/indicateurs'
import { useDonnees } from '../DonneesProvider'
import { genererLePlanning } from '../../moteurs/planning/generateur'
import type { ResultatGeneration } from '../../moteurs/planning/generateur'
import { GrillePlanning } from '../composants/GrillePlanning'
import { SuiviPlanning } from '../composants/SuiviPlanning'
import { DocumentImprimable, type TypeDocument } from '../composants/DocumentImprimable'

export function Planning() {
  const { etat, planning, modifierPlanning, historique, besoinDuJour } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)

  const [semaine, setSemaine] = useState(() => lundiDeLaSemaine(aujourdhui()))
  const [filtreRayon, setFiltreRayon] = useState('tous')
  const [caseChoisie, setCaseChoisie] = useState<{ collaborateurId: string; jour: string } | null>(
    null,
  )
  const [documentAffiche, setDocumentAffiche] = useState<TypeDocument | null>(null)
  const [proposition, setProposition] = useState<ResultatGeneration | null>(null)
  const [confirmationGeneration, setConfirmationGeneration] = useState(false)

  const jours = useMemo(() => semaineDe(semaine), [semaine])
  const planningCourant = planning(semaine)

  const equipe = etat.collaborateurs
    .filter((collaborateur) => collaborateur.actif)
    .filter(
      (collaborateur) => filtreRayon === 'tous' || peutTravaillerDans(collaborateur, filtreRayon),
    )
    .sort((a, b) => nomAffiche(a).localeCompare(nomAffiche(b), 'fr'))

  // ------------------------------------------------- Contrôle des règles
  const infractions = useMemo(
    () =>
      verifier(
        contexteDeVerification(planningCourant.vacations, etat.reglesParametres, {
          collaborateurs: etat.collaborateurs,
          vacationsAnterieures: historique(semaine),
          datePublication: datePublication(planningCourant),
          heuresSupplementairesAnnuelles: etat.heuresSupplementairesAnnuelles,
        }),
      ),
    [planningCourant, etat.collaborateurs, etat.reglesParametres, etat.heuresSupplementairesAnnuelles, historique, semaine],
  )

  const infractionsParPersonne = useMemo(() => {
    const compte: Record<string, number> = {}
    for (const infraction of infractions) {
      compte[infraction.collaborateurId] = (compte[infraction.collaborateurId] ?? 0) + 1
    }
    return compte
  }, [infractions])

  const bloquantes = infractions.filter((infraction) => infraction.severite === 'bloquante')
  const avertissements = infractions.filter((infraction) => infraction.severite === 'avertissement')
  const aConfirmer = infractions.filter((infraction) => infraction.severite === 'a-confirmer')

  // ------------------------------------------------------- Couverture
  const couvertures = useMemo(() => {
    const resultats = []
    for (const rayon of rayons) {
      if (filtreRayon !== 'tous' && rayon.id !== filtreRayon) continue
      for (const jour of jours) {
        const besoin = besoinDuJour(jour, rayon.id)
        if (besoin === null) continue
        resultats.push({
          rayon,
          jour,
          couverture: calculerCouverture(besoin, planningCourant.vacations, etat.collaborateurs),
        })
      }
    }
    return resultats
  }, [rayons, filtreRayon, jours, besoinDuJour, planningCourant.vacations, etat.collaborateurs])

  const besoinTotal = couvertures.reduce((somme, c) => somme + c.couverture.heuresBesoin, 0)
  const presenceTotale = couvertures.reduce((somme, c) => somme + c.couverture.heuresPresence, 0)
  const manqueTotal = couvertures.reduce((somme, c) => somme + c.couverture.heuresManquantes, 0)
  const tauxGlobal = besoinTotal === 0 ? 1 : 1 - manqueTotal / besoinTotal

  // ------------------------------------------------------ Modifications
  function ajouterVacation(
    collaborateurId: string,
    jour: string,
    debut: string,
    fin: string,
    pauseMinutes: number,
    pauseDebut: string,
    rayonId: string,
  ): void {
    const vacation: Vacation = {
      id: `v-${collaborateurId}-${jour}-${debut}-${Date.now()}`,
      collaborateurId,
      rayonId,
      jour,
      debut,
      fin,
      pauseMinutes,
      pauseDebut,
    }
    modifierPlanning(semaine, (precedent) => ({
      ...precedent,
      vacations: [...precedent.vacations, vacation],
    }))
  }

  function viderLaCase(collaborateurId: string, jour: string): void {
    modifierPlanning(semaine, (precedent) => ({
      ...precedent,
      vacations: precedent.vacations.filter(
        (vacation) =>
          !(vacation.collaborateurId === collaborateurId && vacation.jour === jour),
      ),
    }))
  }

  function proposerUnPlanning(): void {
    const besoins = []
    for (const rayon of rayons) {
      for (const jour of jours) {
        const besoin = besoinDuJour(jour, rayon.id)
        if (besoin !== null) besoins.push(besoin)
      }
    }

    const resultat = genererLePlanning({
      semaine,
      rayons,
      besoins,
      collaborateurs: etat.collaborateurs,
      absences: etat.absences,
      horairesTypes: etat.magasin.horairesTypes,
      parametres: etat.reglesParametres,
      vacationsAnterieures: historique(semaine),
      planningPrecedent: planning(ajouterJours(semaine, -7)).vacations,
      dureeMaximaleMs: 5000,
    })

    modifierPlanning(semaine, (precedent) => ({ ...precedent, vacations: resultat.vacations }))
    setProposition(resultat)
    setConfirmationGeneration(false)
  }

  function changerLeSuivi(nouvelEtat: EtatSuivi, date: string, remarques: string): void {
    modifierPlanning(semaine, (precedent) => changerEtat(precedent, nouvelEtat, date, remarques))
  }

  const collaborateurChoisi = etat.collaborateurs.find(
    (collaborateur) => collaborateur.id === caseChoisie?.collaborateurId,
  )

  return (
    <>
      <header className="entete">
        <h1>Planning</h1>
        <p>
          Construction du planning, contrôle automatique des règles légales, couverture du besoin
          et circuit de suivi.
        </p>
      </header>

      <section className="carte">
        <div className="barre-semaine">
          <button
            type="button"
            className="bouton"
            aria-label="Semaine précédente"
            onClick={() => setSemaine(ajouterJours(semaine, -7))}
          >
            ←
          </button>
          <span className="barre-semaine__titre">
            Semaine du {dateEnTexte(semaine)}
          </span>
          <button
            type="button"
            className="bouton"
            aria-label="Semaine suivante"
            onClick={() => setSemaine(ajouterJours(semaine, 7))}
          >
            →
          </button>
        </div>

        <div className="champs">
          <label className="champ">
            <span className="champ__libelle">Rayon</span>
            <select
              className="champ__saisie"
              value={filtreRayon}
              onChange={(evenement) => setFiltreRayon(evenement.target.value)}
            >
              <option value="tous">Tous les rayons</option>
              {rayons.map((rayon) => (
                <option key={rayon.id} value={rayon.id}>
                  {rayon.nom}
                </option>
              ))}
            </select>
          </label>
        </div>

        <dl className="liste-faits">
          <dt>Conformité</dt>
          <dd>
            {bloquantes.length === 0 ? (
              <span className="verdict verdict--bon">Aucune règle enfreinte</span>
            ) : (
              <span className="verdict verdict--mauvais">
                {bloquantes.length} règle{bloquantes.length > 1 ? 's' : ''} enfreinte
                {bloquantes.length > 1 ? 's' : ''}
              </span>
            )}
            {avertissements.length > 0 && (
              <span className="verdict verdict--moyen">
                {avertissements.length} avertissement{avertissements.length > 1 ? 's' : ''}
              </span>
            )}
            {aConfirmer.length > 0 && (
              <span className="verdict verdict--discret">
                {aConfirmer.length} à confirmer
              </span>
            )}
          </dd>

          <dt>Couverture du besoin</dt>
          <dd>
            {Math.round(tauxGlobal * 100)} % — {besoinTotal.toFixed(1)} h nécessaires,{' '}
            {presenceTotale.toFixed(1)} h prévues
          </dd>
        </dl>
      </section>

      <section className="carte">
        <h2>Proposition automatique</h2>
        <p>
          L’application construit une proposition qui ne viole <strong>aucune</strong> règle
          légale, couvre le besoin au mieux et répartit équitablement les sujétions. Ce n’est
          qu’une proposition : vous la corrigez case par case ensuite.
        </p>

        {confirmationGeneration ? (
          <>
            <p className="avis avis--attention">
              <strong>Attention.</strong> La proposition <strong>remplacera</strong> les{' '}
              {planningCourant.vacations.length} vacations déjà saisies cette semaine. Cette action
              ne peut pas être annulée.
            </p>
            <p>
              <button type="button" className="bouton bouton--principal" onClick={proposerUnPlanning}>
                Oui, remplacer
              </button>{' '}
              <button
                type="button"
                className="bouton"
                onClick={() => setConfirmationGeneration(false)}
              >
                Annuler
              </button>
            </p>
          </>
        ) : (
          <button
            type="button"
            className="bouton bouton--principal"
            onClick={() =>
              planningCourant.vacations.length === 0
                ? proposerUnPlanning()
                : setConfirmationGeneration(true)
            }
          >
            Proposer un planning
          </button>
        )}

        {proposition !== null && (
          <>
            <dl className="liste-faits">
              <dt>Vacations placées</dt>
              <dd>{proposition.vacations.length}</dd>
              <dt>Temps de calcul</dt>
              <dd>{(proposition.dureeMs / 1000).toFixed(1)} s</dd>
              <dt>Échanges retenus</dt>
              <dd>{proposition.ameliorations}</dd>
            </dl>

            {proposition.restesAExpliquer.length === 0 ? (
              <p className="avis">Tout le besoin de la semaine est couvert.</p>
            ) : (
              <>
                <p className="champ__libelle">
                  Ce que la proposition n’a pas pu couvrir
                </p>
                <ul className="liste-alertes">
                  {proposition.restesAExpliquer.slice(0, 12).map((reste) => (
                    <li key={reste} className="alerte alerte--attention">
                      <p className="alerte__detail">{reste}</p>
                    </li>
                  ))}
                </ul>
                {proposition.restesAExpliquer.length > 12 && (
                  <p className="champ__aide">
                    … et {proposition.restesAExpliquer.length - 12} autres créneaux dans le même cas.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </section>

      <section className="carte">
        <h2>Grille de la semaine</h2>
        <p>Touchez une case pour placer ou retirer une vacation.</p>

        <GrillePlanning
          collaborateurs={equipe}
          jours={jours}
          vacations={planningCourant.vacations}
          rayons={rayons}
          caseSelectionnee={caseChoisie}
          infractionsParPersonne={infractionsParPersonne}
          onChoisirCase={(collaborateurId, jour) =>
            setCaseChoisie(
              caseChoisie?.collaborateurId === collaborateurId && caseChoisie.jour === jour
                ? null
                : { collaborateurId, jour },
            )
          }
        />

        {caseChoisie !== null && collaborateurChoisi !== undefined && (
          <div className="editeur-case">
            <p className="champ__libelle">
              {nomAffiche(collaborateurChoisi)} — {nomDuJour(jourDeLaSemaine(caseChoisie.jour))}{' '}
              {caseChoisie.jour.slice(8)}
            </p>

            {!estDisponible(collaborateurChoisi, jourDeLaSemaine(caseChoisie.jour)) && (
              <p className="avis avis--attention">
                {nomAffiche(collaborateurChoisi)} a déclaré ne pas être disponible ce jour-là.
              </p>
            )}

            <p className="champ__aide">Horaire type</p>
            <div className="groupe-boutons">
              {etat.magasin.horairesTypes.map((horaire) => (
                <button
                  key={horaire.id}
                  type="button"
                  className="bouton"
                  onClick={() => {
                    const rayonId =
                      filtreRayon === 'tous' ? collaborateurChoisi.rayonPrincipal : filtreRayon
                    viderLaCase(caseChoisie.collaborateurId, caseChoisie.jour)
                    ajouterVacation(
                      caseChoisie.collaborateurId,
                      caseChoisie.jour,
                      horaire.debut,
                      horaire.fin,
                      horaire.pauseMinutes,
                      horaire.pauseDebut,
                      rayonId,
                    )
                  }}
                >
                  {horaire.nom}
                  <span className="bouton__aide">
                    {horaire.debut}–{horaire.fin}
                  </span>
                </button>
              ))}

              <button
                type="button"
                className="bouton"
                onClick={() => viderLaCase(caseChoisie.collaborateurId, caseChoisie.jour)}
              >
                Repos
                <span className="bouton__aide">vider la case</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {bloquantes.length + avertissements.length > 0 && (
        <section className="carte">
          <h2>Contrôle des règles</h2>
          <ul className="liste-alertes">
            {infractions.map((infraction) => (
              <LigneInfraction
                key={`${infraction.regle}-${infraction.collaborateurId}-${infraction.jour}-${infraction.libelle}`}
                infraction={infraction}
                nom={
                  etat.collaborateurs.find((c) => c.id === infraction.collaborateurId) === undefined
                    ? infraction.collaborateurId
                    : nomAffiche(
                        etat.collaborateurs.find((c) => c.id === infraction.collaborateurId)!,
                      )
                }
              />
            ))}
          </ul>
        </section>
      )}

      <section className="carte">
        <h2>Couverture du besoin</h2>
        {couvertures.every((c) => c.couverture.trous.length === 0) ? (
          <p>Tous les besoins sont couverts cette semaine.</p>
        ) : (
          <ul className="liste-alertes">
            {couvertures
              .filter((c) => c.couverture.trous.length > 0)
              .map(({ rayon, jour, couverture }) => {
                const plages = regrouperLesTrous(couverture.trous)
                const disponibles = etat.collaborateurs.filter(
                  (collaborateur) =>
                    collaborateur.actif &&
                    peutTravaillerDans(collaborateur, rayon.id) &&
                    estDisponible(collaborateur, jourDeLaSemaine(jour)) &&
                    !planningCourant.vacations.some(
                      (vacation) =>
                        vacation.collaborateurId === collaborateur.id && vacation.jour === jour,
                    ),
                )

                return (
                  <li key={`${rayon.id}-${jour}`} className="alerte alerte--attention">
                    <p className="alerte__titre">
                      {rayon.nom} — {nomDuJour(jourDeLaSemaine(jour))} {jour.slice(8)}
                    </p>
                    <p className="alerte__detail">
                      {plages
                        .map(
                          (plage) =>
                            `${enTexte(plage.debutMinutes)}–${enTexte(plage.finMinutes % 1440)} : ` +
                            `manque ${plage.manqueMaximal}`,
                        )
                        .join(' · ')}
                    </p>
                    <p className="alerte__detail">
                      {expliquerLeTrou(
                        couverture.trous[0]!,
                        rayon.nom,
                        jour,
                        disponibles,
                      )}
                    </p>
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      <section className="carte">
        <h2>Documents</h2>
        <p>
          Ce que vous voyez à l’écran est exactement ce qui sera imprimé. Ni le statut de suivi,
          ni les remarques, ni l’historique n’y figurent.
        </p>

        <div className="groupe-boutons">
          <button
            type="button"
            className={documentAffiche === 'dossier-patron' ? 'bouton bouton--principal' : 'bouton'}
            onClick={() =>
              setDocumentAffiche(documentAffiche === 'dossier-patron' ? null : 'dossier-patron')
            }
          >
            Dossier à présenter
            <span className="bouton__aide">pour le patron</span>
          </button>

          <button
            type="button"
            className={documentAffiche === 'affichage-equipe' ? 'bouton bouton--principal' : 'bouton'}
            disabled={!afficheEquipeImprimable(planningCourant)}
            onClick={() =>
              setDocumentAffiche(documentAffiche === 'affichage-equipe' ? null : 'affichage-equipe')
            }
          >
            Affichage équipe
            <span className="bouton__aide">pour les salariés</span>
          </button>
        </div>

        {!afficheEquipeImprimable(planningCourant) && (
          <p className="avis avis--attention">
            L’affichage équipe ne peut être imprimé que lorsque le planning est au statut
            <strong> « Publié à l’équipe »</strong>. C’est la seule protection contre la diffusion
            d’un planning non validé.
          </p>
        )}

        {documentAffiche !== null && (
          <>
            <p>
              <button
                type="button"
                className="bouton bouton--principal"
                onClick={() => window.print()}
              >
                Imprimer ou enregistrer en PDF
              </button>
            </p>
            <p className="champ__aide">
              Sur iPad : le bouton ouvre la fenêtre d’impression. Choisissez « PDF » pour
              enregistrer le document.
            </p>

            <div className="apercu-document">
              <DocumentImprimable
                type={documentAffiche}
                planning={planningCourant}
                rayons={rayons}
                collaborateurs={etat.collaborateurs}
                couvertures={couvertures}
                budgetHeuresParRayon={etat.magasin.budgetHeuresParRayon}
                nomDuService={etat.magasin.services[0]?.nom ?? 'Frais'}
                edite={aujourdhui()}
              />
            </div>
          </>
        )}
      </section>

      <SuiviPlanning planning={planningCourant} onChanger={changerLeSuivi} />
    </>
  )
}

function LigneInfraction({
  infraction,
  nom,
}: {
  readonly infraction: Infraction
  readonly nom: string
}) {
  return (
    <li
      className={
        infraction.severite === 'bloquante'
          ? 'alerte alerte--urgent'
          : infraction.severite === 'a-confirmer'
            ? 'alerte alerte--discret'
            : 'alerte alerte--attention'
      }
    >
      <p className="alerte__titre">
        {nom} — {infraction.libelle}
      </p>
      <p className="alerte__detail">{infraction.explication}</p>
    </li>
  )
}
