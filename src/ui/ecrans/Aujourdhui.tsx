import { useMemo, useState } from 'react'
import {
  LIBELLES_ABSENCE,
  absencesDuJour,
  estAbsent,
  type TypeAbsence,
} from '../../domaine/absence'
import { aujourdhui, dateEnTexte, jourDeLaSemaine, lundiDeLaSemaine } from '../../domaine/calendrier'
import { nomAffiche, type Collaborateur } from '../../domaine/collaborateur'
import { rayonsActifs } from '../../domaine/magasin'
import { duree, enMinutes, enTexte, tranchesCouvertes } from '../../domaine/temps'
import { calculerAlertes } from '../../moteurs/alertes'
import { calculerCouverture, regrouperLesTrous } from '../../moteurs/indicateurs'
import { chercherDesRemplacants } from '../../moteurs/planning/remplacants'
import type { Vacation } from '../../moteurs/regles'
import { absencesEffectives } from '../../donnees/etat'
import { useDonnees } from '../DonneesProvider'

const TYPES: readonly TypeAbsence[] = [
  'maladie',
  'conge-paye',
  'absence-autorisee',
  'rtt',
  'formation',
  'accident-travail',
  'autre',
]

export function Aujourdhui() {
  const { etat, modifier, planning, besoinDuJour } = useDonnees()
  const [date, setDate] = useState(aujourdhui)
  const [aRemplacer, setARemplacer] = useState<Vacation | null>(null)
  const [declaration, setDeclaration] = useState<string | null>(null)

  const rayons = rayonsActifs(etat.magasin)
  const semaine = lundiDeLaSemaine(date)
  const planningCourant = planning(semaine)
  const vacationsDuJour = planningCourant.vacations.filter((vacation) => vacation.jour === date)
  const toutesLesAbsences = absencesEffectives(etat)
  const absences = absencesDuJour(toutesLesAbsences, date)

  const presents = etat.collaborateurs.filter(
    (collaborateur) =>
      collaborateur.actif &&
      vacationsDuJour.some((vacation) => vacation.collaborateurId === collaborateur.id) &&
      !estAbsent(toutesLesAbsences, collaborateur.id, date),
  )

  const couvertures = useMemo(
    () =>
      rayons
        .map((rayon) => {
          const besoin = besoinDuJour(date, rayon.id)
          if (besoin === null) return null
          // Une personne absente ne couvre rien.
          const presentes = vacationsDuJour.filter(
            (vacation) => !estAbsent(toutesLesAbsences, vacation.collaborateurId, date),
          )
          return { rayon, couverture: calculerCouverture(besoin, presentes, etat.collaborateurs) }
        })
        .filter((element): element is NonNullable<typeof element> => element !== null),
    [rayons, date, besoinDuJour, vacationsDuJour, etat.absences, etat.collaborateurs],
  )

  const alertes = calculerAlertes(etat.collaborateurs, date, etat.reglagesAlertes).filter(
    (alerte) => alerte.gravite === 'urgent',
  )

  function declarerAbsence(collaborateurId: string, type: TypeAbsence): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      absences: [
        ...precedent.absences,
        {
          id: `abs-${Date.now()}`,
          collaborateurId,
          debut: date,
          fin: date,
          type,
          prevue: false,
        },
      ],
    }))
    setDeclaration(null)
  }

  function retirerAbsence(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      absences: precedent.absences.filter((absence) => absence.id !== identifiant),
    }))
  }

  function nom(collaborateurId: string): string {
    const collaborateur = etat.collaborateurs.find((c) => c.id === collaborateurId)
    return collaborateur === undefined ? collaborateurId : nomAffiche(collaborateur)
  }

  function remplacer(vacation: Vacation, remplacant: Collaborateur): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      plannings: {
        ...precedent.plannings,
        [semaine]: {
          ...planningCourant,
          vacations: planningCourant.vacations.map((autre) =>
            autre.id === vacation.id
              ? { ...autre, collaborateurId: remplacant.id, id: `${autre.id}-remp` }
              : autre,
          ),
        },
      },
    }))
    setARemplacer(null)
  }

  /** Vacations du jour dont le titulaire est absent. */
  const aCouvrir = vacationsDuJour.filter((vacation) =>
    estAbsent(toutesLesAbsences, vacation.collaborateurId, date),
  )

  const arrivees = [...vacationsDuJour]
    .filter((vacation) => !estAbsent(toutesLesAbsences, vacation.collaborateurId, date))
    .sort((a, b) => a.debut.localeCompare(b.debut))

  return (
    <>
      <header className="entete">
        <h1>Aujourd’hui</h1>
        <p>Qui est là, dans quel rayon, les trous de couverture et les alertes du jour.</p>
      </header>

      <section className="carte">
        <div className="champs">
          <label className="champ champ--etroit">
            <span className="champ__libelle">Jour</span>
            <input
              type="date"
              className="champ__saisie"
              value={date}
              onChange={(evenement) => setDate(evenement.target.value)}
            />
          </label>
        </div>
        <p className="champ__aide">{dateEnTexte(date)}</p>

        <dl className="liste-faits">
          <dt>Présents</dt>
          <dd>
            {presents.length} personne{presents.length > 1 ? 's' : ''}
          </dd>
          <dt>Absents</dt>
          <dd>
            {absences.length === 0
              ? 'Personne'
              : absences.map((absence) => nom(absence.collaborateurId)).join(', ')}
          </dd>
          <dt>Rayons en manque</dt>
          <dd>
            {couvertures.filter((c) => c.couverture.trous.length > 0).length} sur{' '}
            {couvertures.length}
          </dd>
        </dl>
      </section>

      {alertes.length > 0 && (
        <section className="carte">
          <h2>À traiter aujourd’hui</h2>
          <ul className="liste-alertes">
            {alertes.map((alerte) => (
              <li key={alerte.id} className="alerte alerte--urgent">
                <p className="alerte__titre">{alerte.titre}</p>
                <p className="alerte__detail">{alerte.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="carte">
        <h2>Absence imprévue</h2>
        <p>Déclarez l’absence : les rayons découverts apparaissent aussitôt.</p>

        {absences.length > 0 && (
          <ul className="liste-simple">
            {absences.map((absence) => (
              <li key={absence.id} className="ligne-saisie">
                <span>
                  <strong>{nom(absence.collaborateurId)}</strong> — {LIBELLES_ABSENCE[absence.type]}
                </span>
                <button
                  type="button"
                  className="bouton bouton--discret"
                  onClick={() => retirerAbsence(absence.id)}
                >
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        )}

        {declaration === null ? (
          <div className="champs">
            <label className="champ">
              <span className="champ__libelle">Qui est absent ?</span>
              <select
                className="champ__saisie"
                value=""
                onChange={(evenement) => setDeclaration(evenement.target.value)}
              >
                <option value="">Choisir une personne…</option>
                {etat.collaborateurs
                  .filter(
                    (collaborateur) =>
                      collaborateur.actif && !estAbsent(toutesLesAbsences, collaborateur.id, date),
                  )
                  .map((collaborateur) => (
                    <option key={collaborateur.id} value={collaborateur.id}>
                      {nomAffiche(collaborateur)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        ) : (
          <>
            <p className="champ__libelle">Type d’absence pour {nom(declaration)}</p>
            <p className="avis">
              Le <strong>type</strong> suffit. Ne notez jamais de motif médical ni de raison
              personnelle : cela ne regarde pas l’employeur.
            </p>
            <div className="groupe-boutons">
              {TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="bouton"
                  onClick={() => declarerAbsence(declaration, type)}
                >
                  {LIBELLES_ABSENCE[type]}
                </button>
              ))}
              <button type="button" className="bouton bouton--discret" onClick={() => setDeclaration(null)}>
                Annuler
              </button>
            </div>
          </>
        )}
      </section>

      {aCouvrir.length > 0 && (
        <section className="carte">
          <h2>Vacations à remplacer</h2>
          {(
            <ul className="liste-simple">
              {aCouvrir
                .map((vacation) => (
                  <li key={vacation.id} className="ligne-saisie">
                    <span>
                      <strong>{nom(vacation.collaborateurId)}</strong> — {vacation.debut}–
                      {vacation.fin},{' '}
                      {rayons.find((rayon) => rayon.id === vacation.rayonId)?.nom ?? vacation.rayonId}
                    </span>
                    <button
                      type="button"
                      className="bouton"
                      onClick={() => setARemplacer(aRemplacer?.id === vacation.id ? null : vacation)}
                    >
                      Trouver un remplaçant
                    </button>
                  </li>
                ))}
            </ul>
          )}

          {aRemplacer !== null && (
            <ListeRemplacants
              vacation={aRemplacer}
              onChoisir={(collaborateur) => remplacer(aRemplacer, collaborateur)}
            />
          )}
        </section>
      )}

      <section className="carte">
        <h2>Couverture par rayon</h2>
        {couvertures.map(({ rayon, couverture }) => {
          const plages = regrouperLesTrous(couverture.trous)
          return (
            <div key={rayon.id} className="ligne-rayon-jour">
              <span className="ligne-rayon-jour__nom">{rayon.nom}</span>
              {couverture.trous.length === 0 ? (
                <span className="verdict verdict--bon">Couvert</span>
              ) : (
                <span className="verdict verdict--mauvais">
                  {plages
                    .map(
                      (plage) =>
                        `${enTexte(plage.debutMinutes)}–${enTexte(plage.finMinutes % 1440)}`,
                    )
                    .join(', ')}
                </span>
              )}
            </div>
          )
        })}
      </section>

      <section className="carte">
        <h2>Arrivées et départs</h2>
        {arrivees.length === 0 ? (
          <p>Personne n’est prévu ce jour-là.</p>
        ) : (
          <ul className="liste-simple">
            {arrivees.map((vacation) => (
              <li key={vacation.id}>
                <strong>{vacation.debut}</strong> — {nom(vacation.collaborateurId)},{' '}
                {rayons.find((rayon) => rayon.id === vacation.rayonId)?.nom ?? vacation.rayonId}{' '}
                <span className="champ__aide">jusqu’à {vacation.fin}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function ListeRemplacants({
  vacation,
  onChoisir,
}: {
  readonly vacation: Vacation
  readonly onChoisir: (collaborateur: Collaborateur) => void
}) {
  const { etat, planning, besoinDuJour } = useDonnees()
  const semaine = lundiDeLaSemaine(vacation.jour)

  /*
   * Competences a exiger du remplacant : uniquement celles qui manqueraient
   * vraiment sur son creneau, une fois l'absence prise en compte. Exiger
   * toutes les competences du rayon ecarterait presque tout le monde.
   */
  const absencesDuMoment = absencesEffectives(etat)
  const besoin = besoinDuJour(vacation.jour, vacation.rayonId)
  const presentes = planning(semaine).vacations.filter(
    (autre) =>
      autre.jour === vacation.jour &&
      autre.id !== vacation.id &&
      !estAbsent(absencesDuMoment, autre.collaborateurId, autre.jour),
  )
  const tranches = tranchesCouvertes(
    enMinutes(vacation.debut),
    enMinutes(vacation.debut) + duree(vacation.debut, vacation.fin),
  )
  const couverture = besoin === null ? null : calculerCouverture(besoin, presentes, etat.collaborateurs)
  const surLeCreneau =
    couverture === null
      ? []
      : couverture.tranches.filter((tranche) => tranches.includes(tranche.index))

  const competences = [
    ...new Set(surLeCreneau.flatMap((tranche) => tranche.competencesManquantes)),
  ]
  const critiques = [
    ...new Set(surLeCreneau.flatMap((tranche) => tranche.competencesCritiquesManquantes)),
  ]

  const resultat = chercherDesRemplacants({
    vacation,
    collaborateurs: etat.collaborateurs,
    absences: absencesEffectives(etat),
    vacationsDeLaSemaine: planning(semaine).vacations,
    competencesRequises: competences,
    competencesCritiques: critiques,
    reposQuotidienMinutes: etat.reglesParametres.reposQuotidienMinutes,
  })

  return (
    <div className="editeur-case">
      <p className="champ__libelle">
        Remplaçants possibles — {jourDeLaSemaine(vacation.jour) === 7 ? 'dimanche' : ''}{' '}
        {vacation.debut}–{vacation.fin}
      </p>

      {resultat.possibles.length === 0 ? (
        <p>
          {resultat.partiels.length === 0
            ? 'Personne ne peut prendre cette vacation.'
            : 'Personne ne couvre tout le poste. Un renfort partiel reste possible.'}
        </p>
      ) : (
        <ul className="liste-simple">
          {resultat.possibles.map((remplacant) => (
            <li key={remplacant.collaborateur.id} className="ligne-remplacant">
              <div>
                <p className="ligne-remplacant__nom">{nomAffiche(remplacant.collaborateur)}</p>
                <p className="alerte__detail">{remplacant.atouts.join(' · ')}</p>
                {remplacant.reserves.length > 0 && (
                  <p className="ligne-remplacant__reserve">⚠ {remplacant.reserves.join(' · ')}</p>
                )}
              </div>
              <button
                type="button"
                className="bouton bouton--principal"
                onClick={() => onChoisir(remplacant.collaborateur)}
              >
                Choisir
              </button>
            </li>
          ))}
        </ul>
      )}

      {resultat.partiels.length > 0 && (
        <>
          <p className="champ__libelle">
            Renforts possibles — ils ne couvrent qu’une partie du poste
          </p>
          <ul className="liste-simple">
            {resultat.partiels.map((remplacant) => (
              <li key={remplacant.collaborateur.id} className="ligne-remplacant">
                <div>
                  <p className="ligne-remplacant__nom">{nomAffiche(remplacant.collaborateur)}</p>
                  <p className="alerte__detail">{remplacant.atouts.join(' · ')}</p>
                  <p className="ligne-remplacant__reserve">⚠ {remplacant.reserves.join(' · ')}</p>
                </div>
                <button
                  type="button"
                  className="bouton"
                  onClick={() => onChoisir(remplacant.collaborateur)}
                >
                  Choisir quand même
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {resultat.ecartes.length > 0 && (
        <details className="depliant">
          <summary className="depliant__titre">
            <span>Pourquoi les autres sont écartés</span>
            <span className="depliant__resume">{resultat.ecartes.length} personnes</span>
          </summary>
          <div className="depliant__contenu">
            <ul className="liste-simple">
              {resultat.ecartes.map((ecarte) => (
                <li key={ecarte.collaborateur.id}>{ecarte.motif}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  )
}
