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
import { changerEtat, datePublication, type EtatSuivi } from '../../domaine/planning'
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
import { GrillePlanning } from '../composants/GrillePlanning'
import { SuiviPlanning } from '../composants/SuiviPlanning'

export function Planning() {
  const { etat, planning, modifierPlanning, historique, besoinDuJour } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)

  const [semaine, setSemaine] = useState(() => lundiDeLaSemaine(aujourdhui()))
  const [filtreRayon, setFiltreRayon] = useState('tous')
  const [caseChoisie, setCaseChoisie] = useState<{ collaborateurId: string; jour: string } | null>(
    null,
  )

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
          </dd>

          <dt>Couverture du besoin</dt>
          <dd>
            {Math.round(tauxGlobal * 100)} % — {besoinTotal.toFixed(1)} h nécessaires,{' '}
            {presenceTotale.toFixed(1)} h prévues
          </dd>
        </dl>
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
    <li className={infraction.severite === 'bloquante' ? 'alerte alerte--urgent' : 'alerte alerte--attention'}>
      <p className="alerte__titre">
        {nom} — {infraction.libelle}
      </p>
      <p className="alerte__detail">{infraction.explication}</p>
    </li>
  )
}
