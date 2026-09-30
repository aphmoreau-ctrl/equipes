import { useEffect, useState } from 'react'
import { LIBELLES_UNITE, dureeDeLaMesure, mesureEnCours } from '../../domaine/mesure'
import { dureeEnTexte } from '../../domaine/temps'
import {
  appliquerLeRecalage,
  proposerUnRecalage,
  uniteDuBloc,
} from '../../moteurs/besoin/cadences'
import type { ConfigurationRayon, NiveauQualite } from '../../moteurs/besoin'
import { useDonnees } from '../DonneesProvider'

const QUALITES: readonly { valeur: NiveauQualite | null; libelle: string }[] = [
  { valeur: null, libelle: 'Normale' },
  { valeur: 'B', libelle: 'Qualité B' },
  { valeur: 'C', libelle: 'Qualité C' },
]

/**
 * Mode chrono (§7.6) : on demarre, on travaille, on arrete. La duree reelle
 * est enregistree, et l'application en deduit la cadence du magasin.
 *
 * Concu pour l'iPhone, au rayon, d'une seule main : deux gros boutons.
 */
export function Chrono({ configuration }: { readonly configuration: ConfigurationRayon }) {
  const { etat, modifier } = useDonnees()
  const [blocId, setBlocId] = useState(configuration.blocs[0]?.id ?? '')
  const [quantite, setQuantite] = useState('10')
  const [qualite, setQualite] = useState<NiveauQualite | null>(null)
  const [maintenant, setMaintenant] = useState(() => Date.now())

  const enCours = mesureEnCours(etat.mesures)

  // Fait avancer le compteur tant qu'un chrono tourne.
  useEffect(() => {
    if (enCours === undefined) return
    const minuterie = window.setInterval(() => setMaintenant(Date.now()), 1000)
    return () => window.clearInterval(minuterie)
  }, [enCours])

  const bloc = configuration.blocs.find((candidat) => candidat.id === blocId)
  const blocEnCours = configuration.blocs.find((candidat) => candidat.id === enCours?.blocId)

  function demarrer(): void {
    const nombre = Number(quantite.replace(',', '.'))
    if (bloc === undefined || !Number.isFinite(nombre) || nombre <= 0) return

    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      mesures: [
        ...precedent.mesures,
        {
          id: `mes-${Date.now()}`,
          rayonId: configuration.rayonId,
          blocId: bloc.id,
          debut: new Date().toISOString(),
          fin: null,
          quantite: nombre,
          unite: uniteDuBloc(bloc),
          qualite,
        },
      ],
    }))
  }

  function arreter(): void {
    modifier((precedent) => ({
      ...precedent,
      mesures: precedent.mesures.map((mesure) =>
        mesure.fin === null ? { ...mesure, fin: new Date().toISOString() } : mesure,
      ),
    }))
  }

  function annuler(): void {
    modifier((precedent) => ({
      ...precedent,
      mesures: precedent.mesures.filter((mesure) => mesure.fin !== null),
    }))
  }

  function accepterLeRecalage(identifiantDuBloc: string, valeur: number): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      configurations: precedent.configurations.map((candidate) =>
        candidate.rayonId === configuration.rayonId
          ? {
              ...candidate,
              blocs: candidate.blocs.map((candidat) =>
                candidat.id === identifiantDuBloc ? appliquerLeRecalage(candidat, valeur) : candidat,
              ),
            }
          : candidate,
      ),
    }))
  }

  const mesuresDuRayon = etat.mesures
    .filter((mesure) => mesure.rayonId === configuration.rayonId && mesure.fin !== null)
    .sort((a, b) => (b.fin ?? '').localeCompare(a.fin ?? ''))
    .slice(0, 8)

  const propositions = configuration.blocs
    .map((candidat) => proposerUnRecalage(candidat, etat.mesures, configuration))
    .filter((proposition): proposition is NonNullable<typeof proposition> => proposition !== null)

  const secondesEcoulees =
    enCours === undefined ? 0 : Math.max(0, Math.floor((maintenant - Date.parse(enCours.debut)) / 1000))

  return (
    <section className="carte">
      <h2>Mode chrono</h2>
      <p>
        Mesurez le temps réellement passé sur une tâche. Après quelques mesures, l’application
        propose de recaler les cadences du modèle sur celles de votre magasin.
      </p>

      {enCours !== undefined ? (
        <div className="chrono">
          <p className="chrono__tache">
            {blocEnCours?.nom ?? enCours.blocId} — {enCours.quantite}{' '}
            {LIBELLES_UNITE[enCours.unite]}
            {enCours.qualite !== null && ` · qualité ${enCours.qualite}`}
          </p>
          <p className="chrono__compteur" role="timer" aria-label="Temps écoulé">
            {String(Math.floor(secondesEcoulees / 3600)).padStart(2, '0')}:
            {String(Math.floor((secondesEcoulees % 3600) / 60)).padStart(2, '0')}:
            {String(secondesEcoulees % 60).padStart(2, '0')}
          </p>
          <p>
            <button type="button" className="bouton bouton--principal chrono__bouton" onClick={arreter}>
              Arrêter et enregistrer
            </button>
          </p>
          <p>
            <button type="button" className="bouton bouton--discret" onClick={annuler}>
              Annuler cette mesure
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className="champs">
            <label className="champ">
              <span className="champ__libelle">Tâche</span>
              <select
                className="champ__saisie"
                value={blocId}
                onChange={(evenement) => setBlocId(evenement.target.value)}
              >
                {configuration.blocs.map((candidat) => (
                  <option key={candidat.id} value={candidat.id}>
                    {candidat.nom}
                  </option>
                ))}
              </select>
            </label>

            <label className="champ champ--etroit">
              <span className="champ__libelle">
                Quantité {bloc !== undefined && `(${LIBELLES_UNITE[uniteDuBloc(bloc)]})`}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                className="champ__saisie"
                value={quantite}
                onChange={(evenement) => setQuantite(evenement.target.value)}
              />
            </label>
          </div>

          <p className="champ__libelle">Qualité de la marchandise</p>
          <div className="groupe-boutons">
            {QUALITES.map((option) => (
              <button
                key={option.libelle}
                type="button"
                className={qualite === option.valeur ? 'bouton bouton--principal' : 'bouton'}
                onClick={() => setQualite(option.valeur)}
              >
                {option.libelle}
              </button>
            ))}
          </div>

          <p>
            <button
              type="button"
              className="bouton bouton--principal chrono__bouton"
              onClick={demarrer}
            >
              Démarrer le chrono
            </button>
          </p>
        </>
      )}

      {propositions.length > 0 && (
        <>
          <p className="champ__libelle">Cadences à recaler</p>
          <ul className="liste-alertes">
            {propositions.map((proposition) => (
              <li key={proposition.blocId} className="alerte alerte--information">
                <p className="alerte__titre">{proposition.nomDuBloc}</p>
                <p className="alerte__detail">
                  {proposition.libelleParametre} : réglé à{' '}
                  <strong>{proposition.valeurActuelle}</strong>, mesuré à{' '}
                  <strong>{proposition.valeurMesuree}</strong> sur{' '}
                  {proposition.nombreDeMesures} mesures (
                  {proposition.ecartPourcent > 0 ? '+' : ''}
                  {Math.round(proposition.ecartPourcent)} %).
                </p>
                <p className="alerte__detail">
                  Recalage progressif proposé : <strong>{proposition.valeurProposee}</strong>. Un
                  pas à la fois, pour qu’une semaine inhabituelle ne bouleverse pas le modèle.
                </p>
                <p>
                  <button
                    type="button"
                    className="bouton"
                    onClick={() =>
                      accepterLeRecalage(proposition.blocId, proposition.valeurProposee)
                    }
                  >
                    Appliquer {proposition.valeurProposee}
                  </button>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {mesuresDuRayon.length > 0 && (
        <>
          <p className="champ__libelle">Dernières mesures</p>
          <ul className="liste-simple">
            {mesuresDuRayon.map((mesure) => {
              const duree = dureeDeLaMesure(mesure) ?? 0
              const nomDuBloc =
                configuration.blocs.find((candidat) => candidat.id === mesure.blocId)?.nom ??
                mesure.blocId
              return (
                <li key={mesure.id}>
                  <strong>{nomDuBloc}</strong> — {mesure.quantite} {LIBELLES_UNITE[mesure.unite]} en{' '}
                  {dureeEnTexte(Math.round(duree))}
                  {mesure.quantite > 0 && (
                    <span className="champ__aide">
                      {' '}
                      ({(60 / (duree / mesure.quantite)).toFixed(1)}{' '}
                      {LIBELLES_UNITE[mesure.unite]} par heure)
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
