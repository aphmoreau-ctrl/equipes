import { useState } from 'react'
import { useDonnees } from '../../DonneesProvider'
import { ChampHeure, ChampNombre, ChampTexte, Depliant, Interrupteur } from '../../composants/Champ'
import { rayonsActifs } from '../../../domaine/magasin'
import { JOURS_SEMAINE, nomDuJour, type JourSemaine } from '../../../domaine/calendrier'
import { nomsDesCompetences, competencesDuRayon } from '../../../domaine/competence'
import { LIBELLES_NIVEAU, type NiveauCompetence } from '../../../domaine/collaborateur'
import type { Bloc, ConfigurationRayon, ExigenceCompetence } from '../../../moteurs/besoin'

/**
 * Reglage du catalogue de taches, rayon par rayon (§7.4).
 *
 * C'est l'ecran qu'Arnaud utilisera sur le terrain : ajouter une tache qui
 * manque, retirer celle qui n'existe pas chez lui, corriger une duree ou une
 * fenetre horaire. Les volumes propres a chaque type de tache (palettes,
 * colis, metres, commandes) se reglent dans l'ecran Besoin, au chrono.
 */

const NIVEAUX: readonly NiveauCompetence[] = [0, 1, 2, 3]

/** Ce que chaque type de tache sait faire, en une phrase. */
const DESCRIPTION_TYPE: Readonly<Record<Bloc['type'], string>> = {
  reception: 'Se compte en palettes reçues.',
  'mise-en-place': 'Se compte en colis mis en rayon.',
  reassort: 'Se compte en colis remis en journée.',
  tri: 'Se compte en mètres de linéaire.',
  facing: 'Se compte en mètres de linéaire.',
  'controle-dates': 'Se compte en mètres de linéaire.',
  nettoyage: 'Se compte en meubles à nettoyer.',
  balances: 'Durée fixe, par balance.',
  transformation: 'Se compte en produits fabriqués.',
  'tache-fixe': 'Durée fixe, en minutes.',
  comptoir: 'Se compte en clients servis.',
  'plan-cuisson': 'Se compte en fournées.',
  'format-livraison': 'Se compte en unités reçues ou préparées.',
}

/** Une tache simple, ajoutee d'un geste : une duree et une fenetre horaire. */
function tacheNeuve(nom: string): Bloc {
  return {
    id: `t-${Date.now()}`,
    nom,
    type: 'tache-fixe',
    actif: true,
    jours: [1, 2, 3, 4, 5, 6],
    plage: { debut: '08:00', fin: '10:00' },
    competences: [],
    coefficients: [],
    minutes: 30,
  }
}

export function SectionTaches() {
  const { etat, modifier } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)
  const [rayonChoisi, setRayonChoisi] = useState(rayons[0]?.id ?? '')
  const [nouvelle, setNouvelle] = useState('')

  const configuration = etat.configurations.find((c) => c.rayonId === rayonChoisi)

  function changerConfiguration(
    changement: (precedente: ConfigurationRayon) => ConfigurationRayon,
  ): void {
    modifier((precedent) => ({
      ...precedent,
      configurations: precedent.configurations.map((c) =>
        c.rayonId === rayonChoisi ? changement(c) : c,
      ),
    }))
  }

  function changerTache(identifiant: string, changement: Partial<Bloc>): void {
    changerConfiguration((precedente) => ({
      ...precedente,
      blocs: precedente.blocs.map((bloc) =>
        bloc.id === identifiant ? ({ ...bloc, ...changement } as Bloc) : bloc,
      ),
    }))
  }

  function retirerTache(identifiant: string): void {
    changerConfiguration((precedente) => ({
      ...precedente,
      blocs: precedente.blocs.filter((bloc) => bloc.id !== identifiant),
    }))
  }

  function ajouterTache(): void {
    const nom = nouvelle.trim()
    if (nom === '') return
    changerConfiguration((precedente) => ({
      ...precedente,
      blocs: [...precedente.blocs, tacheNeuve(nom)],
    }))
    setNouvelle('')
  }

  /** Competences proposees : celles du rayon, plus celles deja exigees. */
  function competencesProposees(bloc: Bloc): string[] {
    const retenues = new Set(bloc.competences.map((exigence) => exigence.competence))
    for (const competence of competencesDuRayon(etat.competences, rayonChoisi)) {
      retenues.add(competence.nom)
    }
    return [...retenues].sort((a, b) => a.localeCompare(b, 'fr'))
  }

  function exigenceDe(bloc: Bloc, nom: string): ExigenceCompetence | undefined {
    return bloc.competences.find((exigence) => exigence.competence === nom)
  }

  function reglerExigence(bloc: Bloc, nom: string, exigence: ExigenceCompetence | null): void {
    const autres = bloc.competences.filter((candidate) => candidate.competence !== nom)
    changerTache(bloc.id, {
      competences: exigence === null ? autres : [...autres, exigence],
    })
  }

  return (
    <section className="carte">
      <h2>Catalogue des tâches</h2>
      <p>
        Le travail à faire dans chaque rayon : ce que l’application utilise pour calculer le
        besoin. Ajoutez ce qui manque, retirez ce qui n’existe pas chez vous, corrigez une durée
        ou une fenêtre horaire — c’est ici que le modèle devient le vôtre.
      </p>

      <label className="champ champ--etroit">
        <span className="champ__libelle">Rayon</span>
        <select
          className="champ__saisie"
          value={rayonChoisi}
          onChange={(evenement) => setRayonChoisi(evenement.target.value)}
        >
          {rayons.map((rayon) => (
            <option key={rayon.id} value={rayon.id}>
              {rayon.nom}
            </option>
          ))}
        </select>
      </label>

      {configuration === undefined ? (
        <p className="avis avis--attention">
          Ce rayon n’a pas encore de catalogue de tâches. Son besoin ne peut donc pas être
          calculé.
        </p>
      ) : (
        <>
          {configuration.blocs.map((bloc) => (
            <Depliant
              key={bloc.id}
              titre={bloc.nom}
              resume={`${bloc.plage.debut}–${bloc.plage.fin} · ${bloc.jours.length} jour${bloc.jours.length > 1 ? 's' : ''}${bloc.actif ? '' : ' · désactivée'}`}
            >
              <ChampTexte
                libelle="Nom de la tâche"
                valeur={bloc.nom}
                onChange={(nom) => changerTache(bloc.id, { nom })}
              />
              <p className="champ__aide">{DESCRIPTION_TYPE[bloc.type]}</p>

              <p className="champ__libelle">Fenêtre horaire</p>
              <div className="champs">
                <ChampHeure
                  libelle="De"
                  valeur={bloc.plage.debut}
                  onChange={(debut) => changerTache(bloc.id, { plage: { ...bloc.plage, debut } })}
                />
                <ChampHeure
                  libelle="À"
                  valeur={bloc.plage.fin}
                  onChange={(fin) => changerTache(bloc.id, { plage: { ...bloc.plage, fin } })}
                />
              </div>

              {bloc.type === 'tache-fixe' && (
                <ChampNombre
                  libelle="Durée"
                  suffixe="min"
                  pas={5}
                  valeur={bloc.minutes}
                  onChange={(minutes) => changerTache(bloc.id, { minutes } as Partial<Bloc>)}
                />
              )}

              <p className="champ__libelle" id={`jours-${bloc.id}`}>
                Jours
              </p>
              <div className="jours" role="group" aria-labelledby={`jours-${bloc.id}`}>
                {JOURS_SEMAINE.map((jour) => {
                  const retenu = bloc.jours.includes(jour)
                  return (
                    <button
                      key={jour}
                      type="button"
                      className={
                        retenu ? 'bouton bouton--principal bouton--jour' : 'bouton bouton--jour'
                      }
                      aria-pressed={retenu}
                      aria-label={nomDuJour(jour)}
                      onClick={() =>
                        changerTache(bloc.id, {
                          jours: retenu
                            ? bloc.jours.filter((autre) => autre !== jour)
                            : ([...bloc.jours, jour].sort((a, b) => a - b) as JourSemaine[]),
                        })
                      }
                    >
                      {nomDuJour(jour).slice(0, 1).toUpperCase()}
                    </button>
                  )
                })}
              </div>

              <p className="champ__libelle">Compétences exigées</p>
              <p className="champ__aide">
                Touchez un niveau pour l’exiger, touchez-le de nouveau pour ne plus rien exiger.
              </p>
              <ul className="liste-competences">
                {competencesProposees(bloc).map((nom) => {
                  const exigence = exigenceDe(bloc, nom)
                  return (
                    <li key={nom} className="ligne-competence">
                      <span className="ligne-competence__nom">{nom}</span>
                      <span className="groupe-boutons">
                        {NIVEAUX.filter((niveau) => niveau > 0).map((niveau) => (
                          <button
                            key={niveau}
                            type="button"
                            className={
                              exigence?.niveauMinimum === niveau
                                ? 'bouton bouton--principal bouton--niveau'
                                : 'bouton bouton--niveau'
                            }
                            aria-pressed={exigence?.niveauMinimum === niveau}
                            aria-label={`${nom} : ${LIBELLES_NIVEAU[niveau]}`}
                            onClick={() =>
                              reglerExigence(
                                bloc,
                                nom,
                                exigence?.niveauMinimum === niveau
                                  ? null
                                  : {
                                      competence: nom,
                                      niveauMinimum: niveau,
                                      ...(exigence?.critique === true ? { critique: true } : {}),
                                    },
                              )
                            }
                          >
                            {niveau}
                          </button>
                        ))}
                        {exigence !== undefined && (
                          <button
                            type="button"
                            className={
                              exigence.critique === true ? 'bouton bouton--principal' : 'bouton'
                            }
                            aria-pressed={exigence.critique === true}
                            aria-label={`${nom} : compétence critique`}
                            onClick={() =>
                              reglerExigence(bloc, nom, {
                                competence: nom,
                                niveauMinimum: exigence.niveauMinimum,
                                ...(exigence.critique === true ? {} : { critique: true }),
                              })
                            }
                          >
                            critique
                          </button>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="champ__aide">
                <strong>Critique</strong> : sans cette compétence, le poste ne peut pas être tenu
                du tout. Un remplaçant qui ne l’a pas est écarté, sans discussion.
              </p>

              <Interrupteur
                libelle={bloc.actif ? 'Tâche active' : 'Tâche désactivée'}
                actif={bloc.actif}
                onChange={(actif) => changerTache(bloc.id, { actif })}
              />
              <p className="champ__aide">
                Désactiver retire la tâche du calcul sans l’effacer : vous pourrez la remettre.
              </p>

              <button
                type="button"
                className="bouton bouton--discret"
                onClick={() => retirerTache(bloc.id)}
              >
                Supprimer définitivement
              </button>
            </Depliant>
          ))}

          <div className="champs">
            <ChampTexte
              libelle="Nouvelle tâche"
              valeur={nouvelle}
              etroit
              placeholder="Relevé des casses"
              onChange={setNouvelle}
            />
            <button
              type="button"
              className="bouton"
              disabled={nouvelle.trim() === ''}
              onClick={ajouterTache}
            >
              Ajouter
            </button>
          </div>
          <p className="champ__aide">
            Une tâche ajoutée ici dure un temps fixe. Pour une tâche qui dépend d’un volume
            (palettes, colis, commandes), partez d’une tâche existante du même genre.
          </p>

          <p className="champ__aide">
            {nomsDesCompetences(etat.competences).length} compétences au catalogue.
          </p>
        </>
      )}
    </section>
  )
}
