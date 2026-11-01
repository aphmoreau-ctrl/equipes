import { useId, useState } from 'react'
import { JOURS_SEMAINE, nomDuJour, type JourSemaine } from '../../../domaine/calendrier'
import { nomAffiche } from '../../../domaine/collaborateur'
import { rayonParId } from '../../../domaine/magasin'
import {
  jourDeRemplacement,
  LIBELLES_FONCTION,
  LIBELLES_NATURE_TACHE,
  LIBELLES_PHASE,
  phaseDuCreneau,
  type RemballeDuJour,
  PRIORITE_PAR_JOUR_PAR_DEFAUT,
  FENETRES_PAUSE_PAR_JOUR_PAR_DEFAUT,
  fenetresDuJour,
  JOURS_DE_REPOS_PREFERES_PAR_DEFAUT,
  JOURS_PRIORITAIRES_PAR_DEFAUT,
  type CreneauEffectif,
  type GrilleEffectifs,
  type OrganisationPlanning,
  type Plage,
  type PlanRotisserie,
  type ReglesInternes,
  type TachePlanifiee,
} from '../../../domaine/organisation'
import type { ConfigurationRayon } from '../../../moteurs/besoin'
import {
  LIBELLES_NATURE_POINT,
  pointsADefinir,
  type PointADefinir,
} from '../../../moteurs/organisation'
import { useDonnees } from '../../DonneesProvider'
import {
  appliquerGrillesDuWeekEnd,
  appliquerHorairesDeLaPreparation,
  horairesDeLaPreparationAAppliquer,
  journeesARemplir,
} from '../../../donnees/grilles-week-end'
import { ChampHeure, ChampNombre, ChampTexte, Depliant, Interrupteur } from '../../composants/Champ'

/**
 * Reglages des regles du planning v2 : points a definir, effectifs,
 * affluence, taches nommees, rotisserie, rotations et regles internes.
 *
 * Convention partout : un champ VIDE veut dire « a definir ». Il est signale
 * en haut des Parametres tant qu'il n'est pas rempli.
 */

/* ------------------------------------------------------------------ */
/* Petits champs                                                       */
/* ------------------------------------------------------------------ */

/** Nombre facultatif : vide = a definir (null). */
function ChampADefinir({
  libelle,
  valeur,
  onChange,
  suffixe,
  pas = 1,
}: {
  readonly libelle: string
  readonly valeur: number | null
  readonly onChange: (valeur: number | null) => void
  readonly suffixe?: string
  readonly pas?: number
}) {
  const identifiant = useId()
  return (
    <div className="champ champ--etroit">
      <label className="champ__libelle" htmlFor={identifiant}>
        {libelle}
        {suffixe !== undefined && <span className="champ__suffixe"> ({suffixe})</span>}
      </label>
      <input
        id={identifiant}
        type="number"
        inputMode="decimal"
        min={0}
        step={pas}
        className={valeur === null ? 'champ__saisie champ__saisie--vide' : 'champ__saisie'}
        placeholder="à définir"
        value={valeur === null ? '' : String(valeur)}
        onChange={(evenement) => {
          const texte = evenement.target.value.trim()
          if (texte === '') return onChange(null)
          const nombre = Number(texte.replace(',', '.'))
          if (Number.isFinite(nombre) && nombre >= 0) onChange(nombre)
        }}
      />
    </div>
  )
}

function ChoixDesJours({
  jours,
  onChange,
}: {
  readonly jours: readonly JourSemaine[]
  readonly onChange: (jours: JourSemaine[]) => void
}) {
  return (
    <div className="groupe-boutons">
      {JOURS_SEMAINE.map((jour) => (
        <Interrupteur
          key={jour}
          libelle={nomDuJour(jour)}
          actif={jours.includes(jour)}
          onChange={(actif) =>
            onChange(
              (actif ? [...jours, jour] : jours.filter((j) => j !== jour)).sort((a, b) => a - b),
            )
          }
        />
      ))}
    </div>
  )
}

function AuMoinsUnPoint() {
  return <span className="etiquette etiquette--verifier">à définir</span>
}

/** Raccourci : modifier l'organisation. */
function useOrganisation(): [OrganisationPlanning, (changement: Partial<OrganisationPlanning>) => void] {
  const { etat, modifier } = useDonnees()
  return [
    etat.organisation,
    (changement) =>
      modifier((precedent) => ({
        ...precedent,
        organisation: { ...precedent.organisation, ...changement },
      })),
  ]
}

/* ------------------------------------------------------------------ */
/* Points a definir                                                    */
/* ------------------------------------------------------------------ */

export function SectionPointsADefinir() {
  const { etat } = useDonnees()
  const [organisation, regler] = useOrganisation()
  const points = pointsADefinir(etat)
  if (points.length === 0) return null

  const parRubrique = new Map<string, PointADefinir[]>()
  for (const point of points) {
    parRubrique.set(point.rubrique, [...(parRubrique.get(point.rubrique) ?? []), point])
  }
  const aDefinir = points.filter((p) => p.nature === 'a-definir').length

  return (
    <section className="carte" aria-labelledby="titre-points-a-definir">
      <h2 id="titre-points-a-definir">Points à définir</h2>
      <p>
        {aDefinir > 0
          ? `${aDefinir} réglage${aDefinir > 1 ? 's' : ''} encore vide${aDefinir > 1 ? 's' : ''}. `
          : ''}
        Tant qu’un point reste ouvert, le planning fait sans et ne l’invente jamais. Remplissez-les
        dans les réglages plus bas, à votre rythme.
      </p>
      {[...parRubrique.entries()].map(([rubrique, liste]) => (
        <div key={rubrique}>
          <h3>{rubrique}</h3>
          <ul className="liste-simple">
            {liste.map((point) => {
              const verification = organisation.pointsAVerifier.find(
                (p) => `verifier-${p.id}` === point.id,
              )
              return (
                <li key={point.id}>
                  <span
                    className={
                      point.nature === 'provisoire'
                        ? 'etiquette etiquette--attente'
                        : 'etiquette etiquette--verifier'
                    }
                  >
                    {LIBELLES_NATURE_POINT[point.nature]}
                  </span>{' '}
                  {point.libelle}
                  {verification !== undefined && (
                    <>
                      {' '}
                      <button
                        type="button"
                        className="bouton"
                        onClick={() =>
                          regler({
                            pointsAVerifier: organisation.pointsAVerifier.map((p) =>
                              p.id === verification.id ? { ...p, verifie: true } : p,
                            ),
                          })
                        }
                      >
                        C’est vérifié
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Effectifs                                                           */
/* ------------------------------------------------------------------ */

export function SectionEffectifs() {
  const { etat, modifier } = useDonnees()
  const avecGrille = etat.configurations.filter((c) => c.grilleEffectifs !== undefined)
  const [rayonId, setRayonId] = useState(avecGrille[0]?.rayonId ?? '')
  const [jour, setJour] = useState<JourSemaine>(1)
  const [nouvelleTache, setNouvelleTache] = useState('')
  if (avecGrille.length === 0) return null

  const configuration = avecGrille.find((c) => c.rayonId === rayonId) ?? avecGrille[0]
  const grille = configuration?.grilleEffectifs
  if (configuration === undefined || grille === undefined) return null
  const creneaux = grille.jours[jour]
  const nomDuRayon = rayonParId(etat.magasin, configuration.rayonId)?.nom ?? configuration.rayonId

  function reglerGrille(changement: Partial<GrilleEffectifs>): void {
    modifier((precedent) => ({
      ...precedent,
      configurations: precedent.configurations.map((c: ConfigurationRayon) =>
        c.rayonId === configuration?.rayonId && c.grilleEffectifs !== undefined
          ? { ...c, grilleEffectifs: { ...c.grilleEffectifs, ...changement } }
          : c,
      ),
    }))
  }

  function reglerJour(valeur: readonly CreneauEffectif[] | null): void {
    if (grille === undefined) return
    reglerGrille({ jours: { ...grille.jours, [jour]: valeur } })
  }

  function reglerCreneau(index: number, changement: Partial<CreneauEffectif>): void {
    reglerJour(
      (creneaux ?? []).map((creneau, i) =>
        i === index ? { ...creneau, ...changement, provisoire: false } : creneau,
      ),
    )
  }

  const joursSources = JOURS_SEMAINE.filter((j) => j !== jour && (grille.jours[j] ?? []).length > 0)
  const rayonDuJour = rayonParId(etat.magasin, configuration.rayonId)
  const remballe = grille.remballe?.[jour]

  function reglerRemballe(valeur: RemballeDuJour | null): void {
    if (grille === undefined) return
    reglerGrille({ remballe: { ...(grille.remballe ?? {}), [jour]: valeur } })
  }

  const tachesDuRayon = etat.organisation.taches.filter(
    (t) => t.rayonId === configuration.rayonId && t.nature !== 'remballe',
  )
  function reglerTache(id: string, changement: Partial<TachePlanifiee>): void {
    modifier((precedent) => ({
      ...precedent,
      organisation: {
        ...precedent.organisation,
        taches: precedent.organisation.taches.map((t) => (t.id === id ? { ...t, ...changement } : t)),
      },
    }))
  }
  function ajouterTache(nom: string): void {
    const rayonCible = configuration?.rayonId ?? null
    modifier((precedent) => ({
      ...precedent,
      organisation: {
        ...precedent.organisation,
        taches: [
          ...precedent.organisation.taches,
          {
            id: `tache-${rayonCible ?? 'x'}-${precedent.organisation.taches.length + 1}`,
            nom,
            nature: 'tache',
            actif: true,
            rayonId: rayonCible,
            competence: grille?.competence ?? null,
            fonction: null,
            rayonsRepresentes: [],
            personnesDesignees: [],
            jours: null,
            moment: { type: 'libre' },
            dureeMinutes: null,
            occurrencesParSemaine: null,
            fenetre: null,
          },
        ],
      },
    }))
  }

  return (
    <section className="carte" aria-labelledby="titre-effectifs">
      <h2 id="titre-effectifs">Fiche rayon</h2>
      <p>
        Chaque journée se découpe en trois phases : <strong>préparation</strong> (de l’ouverture à
        8 h 30), <strong>vente</strong> (8 h 30-20 h, dimanche 8 h 30-12 h 30) et{' '}
        <strong>remballe</strong>. Chacune a son minimum, sa cible et ses tâches ; les tâches
        s’ajoutent aux personnes demandées.
      </p>
      <p>
        Le <strong>minimum</strong> est obligatoire : le planning alerte s’il n’est pas tenu. La{' '}
        <strong>cible</strong> est souhaitée : elle peut être atteinte avec des renforts. Un champ
        vide reste « à définir ».
      </p>

      {horairesDeLaPreparationAAppliquer(etat) && (
        <div className="avis">
          <p>
            <strong>Horaires de la préparation traiteur</strong> : fin à 12 h du lundi au vendredi,
            13 h 30 le samedi. La grille du rayon suit.
          </p>
          <button
            type="button"
            className="bouton bouton--principal"
            onClick={() => modifier((precedent) => appliquerHorairesDeLaPreparation(precedent))}
          >
            Appliquer ces horaires
          </button>
        </div>
      )}

      {journeesARemplir(etat) > 0 && (
        <div className="avis">
          <p>
            <strong>Grilles du week-end proposées</strong> : vendredi, samedi et dimanche des
            rayons trad, et l’affluence du samedi (10 h-13 h, 15 h-19 h). Seuls les jours encore
            « à définir » sont remplis ({journeesARemplir(etat)} journée
            {journeesARemplir(etat) > 1 ? 's' : ''}) ; rien de ce que vous avez saisi n’est
            modifié.
          </p>
          <button
            type="button"
            className="bouton bouton--principal"
            onClick={() => modifier((precedent) => appliquerGrillesDuWeekEnd(precedent).etat)}
          >
            Appliquer les grilles du week-end proposées
          </button>
        </div>
      )}

      <div className="champs">
        <label className="champ champ--etroit">
          <span className="champ__libelle">Rayon</span>
          <select
            className="champ__saisie"
            value={configuration.rayonId}
            onChange={(evenement) => setRayonId(evenement.target.value)}
          >
            {avecGrille.map((c) => (
              <option key={c.rayonId} value={c.rayonId}>
                {rayonParId(etat.magasin, c.rayonId)?.nom ?? c.rayonId}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="groupe-boutons" role="group" aria-label="Jour">
        {JOURS_SEMAINE.map((j) => (
          <button
            key={j}
            type="button"
            className={j === jour ? 'bouton bouton--principal' : 'bouton'}
            aria-pressed={j === jour}
            onClick={() => setJour(j)}
          >
            {nomDuJour(j)}
            {grille.jours[j] === null && ' •'}
          </button>
        ))}
      </div>

      <h3>
        {nomDuRayon}, {nomDuJour(jour)} {creneaux === null && <AuMoinsUnPoint />}
      </h3>

      {creneaux === null ? (
        <p>
          Les effectifs de ce jour ne sont pas encore définis.{' '}
          {jourDeRemplacement(grille, jour) !== null
            ? `En attendant, le planning prend la cible du ${nomDuJour(jourDeRemplacement(grille, jour) as JourSemaine)} comme minimum et comme cible.`
            : 'Seuls les planchers s’appliquent.'}
        </p>
      ) : creneaux.length === 0 ? (
        <p>Personne n’est attendu ce jour-là.</p>
      ) : (
        creneaux.map((creneau, index) => (
          <div className="champs" key={`${jour}-${index}`}>
            <span className="etiquette fiche-rayon__phase">{LIBELLES_PHASE[phaseDuCreneau(creneau)]}</span>
            <ChampHeure libelle="De" valeur={creneau.debut} onChange={(debut) => reglerCreneau(index, { debut })} />
            <ChampHeure libelle="À" valeur={creneau.fin} onChange={(fin) => reglerCreneau(index, { fin })} />
            <ChampADefinir
              libelle="Minimum"
              valeur={creneau.minimum}
              onChange={(minimum) => reglerCreneau(index, { minimum })}
            />
            <ChampADefinir
              libelle="Cible"
              valeur={creneau.cible}
              onChange={(cible) => reglerCreneau(index, { cible })}
            />
            {creneau.provisoire === true && <span className="etiquette etiquette--attente">provisoire</span>}
            <button
              type="button"
              className="bouton"
              onClick={() => reglerJour(creneaux.filter((_, i) => i !== index))}
            >
              Retirer
            </button>
          </div>
        ))
      )}

      <div className="groupe-boutons">
        <button
          type="button"
          className="bouton"
          onClick={() => {
            const dernier = creneaux?.[creneaux.length - 1]
            reglerJour([
              ...(creneaux ?? []),
              { debut: dernier?.fin ?? '08:30', fin: '20:00', minimum: null, cible: null },
            ])
          }}
        >
          Ajouter un créneau
        </button>
        {joursSources.map((source) => (
          <button
            key={source}
            type="button"
            className="bouton"
            onClick={() =>
              reglerJour((grille.jours[source] ?? []).map((c) => ({ ...c, provisoire: true })))
            }
          >
            Copier le {nomDuJour(source)}
          </button>
        ))}
        {creneaux !== null && (
          <button type="button" className="bouton" onClick={() => reglerJour(null)}>
            Remettre « à définir »
          </button>
        )}
        {creneaux !== null && creneaux.length > 0 && (
          <button type="button" className="bouton" onClick={() => reglerJour([])}>
            Personne ce jour-là
          </button>
        )}
      </div>

      {rayonDuJour?.vente !== false && rayonDuJour?.horairesPropres?.[jour].ouvert !== false && (
        <div className="fiche-rayon__remballe">
          <p className="champ__libelle">
            Remballe du {nomDuJour(jour)} {remballe == null && <AuMoinsUnPoint />}
          </p>
          {remballe == null ? (
            <button
              type="button"
              className="bouton"
              onClick={() =>
                reglerRemballe({ debut: '19:00', dureeMinutes: 60, minimum: 1, cible: 1 })
              }
            >
              Définir la remballe
            </button>
          ) : (
            <div className="champs">
              <ChampHeure
                libelle="Début"
                valeur={remballe.debut}
                onChange={(debut) => reglerRemballe({ ...remballe, debut })}
              />
              <ChampNombre
                libelle="Durée"
                suffixe="min"
                pas={15}
                valeur={remballe.dureeMinutes}
                onChange={(dureeMinutes) => reglerRemballe({ ...remballe, dureeMinutes })}
              />
              <ChampNombre
                libelle="Minimum"
                valeur={remballe.minimum}
                onChange={(minimum) => reglerRemballe({ ...remballe, minimum })}
              />
              <ChampNombre
                libelle="Cible"
                valeur={remballe.cible}
                onChange={(cible) => reglerRemballe({ ...remballe, cible })}
              />
              <button type="button" className="bouton" onClick={() => reglerRemballe(null)}>
                Remettre « à définir »
              </button>
            </div>
          )}
        </div>
      )}

      <div className="groupe-boutons">
        <Interrupteur
          libelle="Un titulaire à l’ouverture et à la fermeture"
          actif={grille.titulaireOuvertureFermeture !== false}
          onChange={(titulaireOuvertureFermeture) => reglerGrille({ titulaireOuvertureFermeture })}
        />
      </div>

      <h3>Tâches du rayon</h3>
      {tachesDuRayon.length === 0 ? (
        <p className="champ__aide">
          Aucune tâche : seule la grille compte. Ajoutez les tâches qui demandent des bras en plus
          (emballage, préparation de commandes…).
        </p>
      ) : (
        tachesDuRayon.map((tache) => (
          <Depliant
            key={tache.id}
            titre={tache.nom}
            resume={
              !tache.actif
                ? 'désactivée'
                : tache.dureeMinutes === null || tache.jours === null || tache.moment.type === 'a-definir'
                  ? 'à définir'
                  : 'complète'
            }
          >
            <EditeurTache tache={tache} onChange={(changement) => reglerTache(tache.id, changement)} />
          </Depliant>
        ))
      )}
      <div className="champs">
        <ChampTexte
          libelle="Nouvelle tâche"
          valeur={nouvelleTache}
          placeholder="ex. Préparation des commandes"
          onChange={setNouvelleTache}
        />
        <button
          type="button"
          className="bouton"
          disabled={nouvelleTache.trim() === ''}
          onClick={() => {
            ajouterTache(nouvelleTache.trim())
            setNouvelleTache('')
          }}
        >
          Ajouter la tâche
        </button>
      </div>

      <Depliant titre="Planchers de couverture" resume={`${grille.planchers.length}`}>
        <p className="champ__aide">
          Ils s’appliquent en plus de la grille, même les jours encore à définir : présence
          permanente en vente, deux personnes certains jours…
        </p>
        {grille.planchers.map((plancher) => (
          <div key={plancher.id}>
            <p className="champ__libelle">{plancher.libelle}</p>
            <div className="champs">
              <ChampHeure
                libelle="De"
                valeur={plancher.debut}
                onChange={(debut) =>
                  reglerGrille({
                    planchers: grille.planchers.map((p) => (p.id === plancher.id ? { ...p, debut } : p)),
                  })
                }
              />
              <ChampHeure
                libelle="À"
                valeur={plancher.fin}
                onChange={(fin) =>
                  reglerGrille({
                    planchers: grille.planchers.map((p) => (p.id === plancher.id ? { ...p, fin } : p)),
                  })
                }
              />
              <ChampNombre
                libelle="Personnes au moins"
                valeur={plancher.minimum}
                onChange={(minimum) =>
                  reglerGrille({
                    planchers: grille.planchers.map((p) => (p.id === plancher.id ? { ...p, minimum } : p)),
                  })
                }
              />
            </div>
            <ChoixDesJours
              jours={plancher.jours}
              onChange={(jours) =>
                reglerGrille({
                  planchers: grille.planchers.map((p) => (p.id === plancher.id ? { ...p, jours } : p)),
                })
              }
            />
          </div>
        ))}
      </Depliant>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Affluence                                                           */
/* ------------------------------------------------------------------ */

function EditeurPlages({
  plages,
  onChange,
}: {
  readonly plages: readonly Plage[]
  readonly onChange: (plages: Plage[]) => void
}) {
  return (
    <>
      {plages.map((plage, index) => (
        <div className="champs" key={index}>
          <ChampHeure
            libelle="De"
            valeur={plage.debut}
            onChange={(debut) => onChange(plages.map((p, i) => (i === index ? { ...p, debut } : p)))}
          />
          <ChampHeure
            libelle="À"
            valeur={plage.fin}
            onChange={(fin) => onChange(plages.map((p, i) => (i === index ? { ...p, fin } : p)))}
          />
          <button type="button" className="bouton" onClick={() => onChange(plages.filter((_, i) => i !== index))}>
            Retirer
          </button>
        </div>
      ))}
    </>
  )
}

export function SectionAffluence() {
  const { etat } = useDonnees()
  const [organisation, regler] = useOrganisation()
  if (etat.organisation.taches.length === 0 && etat.organisation.rotisserie === null) return null

  return (
    <section className="carte" aria-labelledby="titre-affluence">
      <h2 id="titre-affluence">Heures d’affluence</h2>
      <p>Pas de pause pendant ces heures. Elles servent aussi à placer les renforts.</p>
      {JOURS_SEMAINE.map((jour) => {
        const plages = organisation.plagesAffluence[jour]
        const reglerJour = (valeur: Plage[] | null) =>
          regler({ plagesAffluence: { ...organisation.plagesAffluence, [jour]: valeur } })
        return (
          <Depliant
            key={jour}
            titre={nomDuJour(jour)}
            resume={
              plages === null
                ? 'à définir'
                : plages.length === 0
                  ? 'aucune'
                  : plages.map((p) => `${p.debut}–${p.fin}`).join(' · ')
            }
          >
            {plages !== null && <EditeurPlages plages={plages} onChange={reglerJour} />}
            <div className="groupe-boutons">
              <button
                type="button"
                className="bouton"
                onClick={() => reglerJour([...(plages ?? []), { debut: '11:00', fin: '13:00' }])}
              >
                Ajouter une plage
              </button>
              {plages !== null && (
                <button type="button" className="bouton" onClick={() => reglerJour(null)}>
                  Remettre « à définir »
                </button>
              )}
            </div>
          </Depliant>
        )
      })}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Taches nommees                                                      */
/* ------------------------------------------------------------------ */

function EditeurTache({
  tache,
  onChange,
}: {
  readonly tache: TachePlanifiee
  readonly onChange: (changement: Partial<TachePlanifiee>) => void
}) {
  const { etat } = useDonnees()
  const equipe = etat.collaborateurs.filter((c) => c.actif)
  const designes = tache.personnesDesignees

  return (
    <>
      <p className="champ__aide">
        {LIBELLES_NATURE_TACHE[tache.nature]}
        {tache.rayonId !== null && ` · ${rayonParId(etat.magasin, tache.rayonId)?.nom ?? tache.rayonId}`}
        {tache.competence !== null && ` · compétence ${tache.competence}`}
        {tache.fonction !== null && ` · ${LIBELLES_FONCTION[tache.fonction]}`}
      </p>

      <p className="champ__libelle">Jours {tache.jours === null && <AuMoinsUnPoint />}</p>
      <ChoixDesJours jours={tache.jours ?? []} onChange={(jours) => onChange({ jours })} />

      <div className="champs">
        <label className="champ champ--etroit">
          <span className="champ__libelle">Moment</span>
          <select
            className="champ__saisie"
            value={tache.moment.type}
            onChange={(evenement) => {
              const type = evenement.target.value
              onChange({
                moment:
                  type === 'heure'
                    ? { type: 'heure', heure: '08:00' }
                    : type === 'libre'
                      ? { type: 'libre' }
                      : { type: 'a-definir' },
              })
            }}
          >
            <option value="heure">À heure fixe</option>
            <option value="libre">Au choix du planning</option>
            <option value="a-definir">À définir</option>
          </select>
        </label>
        {tache.moment.type === 'heure' && (
          <ChampHeure
            libelle="Heure"
            valeur={tache.moment.heure}
            onChange={(heure) => onChange({ moment: { type: 'heure', heure } })}
          />
        )}
        <ChampADefinir
          libelle="Durée"
          suffixe="min"
          valeur={tache.dureeMinutes}
          onChange={(dureeMinutes) => onChange({ dureeMinutes })}
        />
        <ChampADefinir
          libelle="Fois par semaine"
          valeur={tache.occurrencesParSemaine}
          onChange={(occurrencesParSemaine) => onChange({ occurrencesParSemaine })}
        />
        {tache.fonction === null && (
          <ChampNombre
            libelle="Personnes à la fois"
            minimum={1}
            valeur={tache.personnes ?? 1}
            onChange={(personnes) => onChange({ personnes: Math.max(1, Math.round(personnes)) })}
          />
        )}
      </div>
      <p className="champ__aide">« Fois par semaine » vide : une fois chaque jour prévu.</p>

      {tache.moment.type === 'libre' && tache.fonction === null && (
        <>
          <p className="champ__libelle">
            Plage horaire {tache.fenetre == null && <AuMoinsUnPoint />}
          </p>
          {tache.fenetre == null ? (
            <button
              type="button"
              className="bouton"
              onClick={() => onChange({ fenetre: { debut: '08:30', fin: '11:00' } })}
            >
              Fixer la plage horaire
            </button>
          ) : (
            <div className="champs">
              <ChampHeure
                libelle="Au plus tôt"
                valeur={tache.fenetre.debut}
                onChange={(debut) => onChange({ fenetre: { ...(tache.fenetre as Plage), debut } })}
              />
              <ChampHeure
                libelle="Heure limite de fin"
                valeur={tache.fenetre.fin}
                onChange={(fin) => onChange({ fenetre: { ...(tache.fenetre as Plage), fin } })}
              />
            </div>
          )}
          <p className="champ__aide">
            La durée se répartit entre ces deux heures, et s’ajoute aux personnes demandées pour la
            vente.
          </p>
        </>
      )}

      {tache.fonction === null && (
        <>
          <p className="champ__libelle">
            Personnes désignées {designes === null && <AuMoinsUnPoint />}
          </p>
          <div className="groupe-boutons">
            {equipe.map((collaborateur) => (
              <Interrupteur
                key={collaborateur.id}
                libelle={nomAffiche(collaborateur)}
                actif={(designes ?? []).includes(collaborateur.id)}
                onChange={(actif) =>
                  onChange({
                    personnesDesignees: actif
                      ? [...(designes ?? []), collaborateur.id]
                      : (designes ?? []).filter((id) => id !== collaborateur.id),
                  })
                }
              />
            ))}
          </div>
          {tache.competence !== null && (
            <p className="champ__aide">Personne de désigné : toute personne qui a la compétence.</p>
          )}
        </>
      )}

      <div className="groupe-boutons">
        <Interrupteur libelle="Tâche active" actif={tache.actif} onChange={(actif) => onChange({ actif })} />
      </div>
    </>
  )
}

export function SectionTachesPlanifiees() {
  const { etat } = useDonnees()
  const [organisation, regler] = useOrganisation()
  // Les taches d'un rayon se reglent dans sa fiche ; ici, ce qui ne depend
  // d'aucun rayon : les reunions.
  const horsRayon = organisation.taches.filter((t) => t.rayonId === null)
  if (horsRayon.length === 0) return null

  function reglerTache(id: string, changement: Partial<TachePlanifiee>): void {
    regler({ taches: organisation.taches.map((t) => (t.id === id ? { ...t, ...changement } : t)) })
  }

  return (
    <section className="carte" aria-labelledby="titre-taches-nommees">
      <h2 id="titre-taches-nommees">Réunions</h2>
      <p>
        Ce qui ne dépend d’aucun rayon. Les tâches d’un rayon (emballages, skin marée…) se règlent
        dans sa fiche, plus haut.
      </p>
      {horsRayon.map((tache) => {
        const rayon = tache.rayonId === null ? '' : ` — ${rayonParId(etat.magasin, tache.rayonId)?.nom ?? ''}`
        const incomplet =
          tache.jours === null || tache.dureeMinutes === null || tache.moment.type === 'a-definir'
        return (
          <Depliant
            key={tache.id}
            titre={`${tache.nom}${tache.nature === 'remballe' ? rayon : ''}`}
            resume={!tache.actif ? 'désactivée' : incomplet ? 'à définir' : 'complète'}
          >
            <EditeurTache tache={tache} onChange={(changement) => reglerTache(tache.id, changement)} />
          </Depliant>
        )
      })}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Rotisserie                                                          */
/* ------------------------------------------------------------------ */

export function SectionRotisserie() {
  const [organisation, regler] = useOrganisation()
  const rotisserie = organisation.rotisserie
  if (rotisserie === null) return null

  function reglerRotisserie(changement: Partial<PlanRotisserie>): void {
    if (rotisserie === null) return
    regler({ rotisserie: { ...rotisserie, ...changement } })
  }

  return (
    <section className="carte" aria-labelledby="titre-rotisserie">
      <h2 id="titre-rotisserie">Rôtisserie</h2>
      <p>
        Règle légale : un produit ne reste pas plus de{' '}
        {Math.round((rotisserie.maintienAuChaudMaximumMinutes / 60) * 100) / 100} h au chaud. Les
        heures indiquées sont celles de <strong>sortie du four</strong>.
      </p>
      <div className="champs">
        <ChampADefinir
          libelle="Durée d’une cuisson"
          suffixe="min"
          valeur={rotisserie.dureeCuissonMinutes}
          onChange={(dureeCuissonMinutes) => reglerRotisserie({ dureeCuissonMinutes })}
        />
        <ChampNombre
          libelle="Maintien au chaud maximum"
          suffixe="h"
          pas={0.25}
          valeur={rotisserie.maintienAuChaudMaximumMinutes / 60}
          onChange={(heures) => reglerRotisserie({ maintienAuChaudMaximumMinutes: Math.round(heures * 60) })}
        />
      </div>
      {JOURS_SEMAINE.map((jour) => {
        const duJour = rotisserie.jours[jour]
        const reglerJour = (changement: Partial<typeof duJour>) =>
          reglerRotisserie({ jours: { ...rotisserie.jours, [jour]: { ...duJour, ...changement } } })
        return (
          <Depliant
            key={jour}
            titre={nomDuJour(jour)}
            resume={duJour.vente === null ? 'pas de vente' : `${duJour.cuissons.length} cuisson(s)`}
          >
            {duJour.vente !== null && (
              <div className="champs">
                <ChampHeure
                  libelle="Vente de"
                  valeur={duJour.vente.debut}
                  onChange={(debut) => duJour.vente !== null && reglerJour({ vente: { ...duJour.vente, debut } })}
                />
                <ChampHeure
                  libelle="à"
                  valeur={duJour.vente.fin}
                  onChange={(fin) => duJour.vente !== null && reglerJour({ vente: { ...duJour.vente, fin } })}
                />
              </div>
            )}
            <div className="champs">
              {duJour.cuissons.map((heure, index) => (
                <ChampHeure
                  key={index}
                  libelle={`Cuisson ${index + 1}`}
                  valeur={heure}
                  onChange={(valeur) =>
                    reglerJour({ cuissons: duJour.cuissons.map((h, i) => (i === index ? valeur : h)) })
                  }
                />
              ))}
            </div>
            <div className="groupe-boutons">
              <button
                type="button"
                className="bouton"
                onClick={() => reglerJour({ cuissons: [...duJour.cuissons, '12:00'] })}
              >
                Ajouter une cuisson
              </button>
              {duJour.cuissons.length > 0 && (
                <button
                  type="button"
                  className="bouton"
                  onClick={() => reglerJour({ cuissons: duJour.cuissons.slice(0, -1) })}
                >
                  Retirer la dernière
                </button>
              )}
              <Interrupteur
                libelle="Vente ce jour"
                actif={duJour.vente !== null}
                onChange={(actif) =>
                  reglerJour({ vente: actif ? { debut: '08:30', fin: '20:00' } : null })
                }
              />
            </div>
          </Depliant>
        )
      })}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Rotations                                                           */
/* ------------------------------------------------------------------ */

export function SectionRotations() {
  const { etat } = useDonnees()
  const [organisation, regler] = useOrganisation()
  if (organisation.rotations.length === 0) return null
  const equipe = etat.collaborateurs.filter((c) => c.actif)

  return (
    <section className="carte" aria-labelledby="titre-rotations">
      <h2 id="titre-rotations">Rotations</h2>
      <p>Des personnes qui se partagent un poste à tour de rôle, et se remplacent pendant les vacances.</p>
      {organisation.rotations.map((rotation) => (
        <div key={rotation.id}>
          <h3>
            {rotation.nom} {rotation.personnes.length < 2 && <AuMoinsUnPoint />}
          </h3>
          <div className="groupe-boutons">
            {equipe.map((collaborateur) => (
              <Interrupteur
                key={collaborateur.id}
                libelle={nomAffiche(collaborateur)}
                actif={rotation.personnes.includes(collaborateur.id)}
                onChange={(actif) =>
                  regler({
                    rotations: organisation.rotations.map((r) =>
                      r.id === rotation.id
                        ? {
                            ...r,
                            personnes: actif
                              ? [...r.personnes, collaborateur.id]
                              : r.personnes.filter((id) => id !== collaborateur.id),
                          }
                        : r,
                    ),
                  })
                }
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Regles internes                                                     */
/* ------------------------------------------------------------------ */

export function SectionReglesInternes() {
  const [organisation, regler] = useOrganisation()
  const r = organisation.reglesInternes

  function reglerRegles(changement: Partial<ReglesInternes>): void {
    regler({ reglesInternes: { ...r, ...changement } })
  }

  return (
    <section className="carte" aria-labelledby="titre-regles-internes">
      <h2 id="titre-regles-internes">Règles internes</h2>
      <p>Elles déclenchent des alertes, jamais un blocage : vous gardez la main.</p>
      <div className="grille-champs">
        <ChampNombre
          libelle="Pause par heure travaillée"
          suffixe="min"
          valeur={r.pauseMinutesParHeure}
          onChange={(pauseMinutesParHeure) => reglerRegles({ pauseMinutesParHeure })}
        />
        <ChampNombre
          libelle="Présence minimale un jour travaillé"
          suffixe="h"
          pas={0.5}
          valeur={r.presenceMinimaleParJourMinutes / 60}
          onChange={(heures) => reglerRegles({ presenceMinimaleParJourMinutes: Math.round(heures * 60) })}
        />
        <ChampNombre
          libelle="Jours consécutifs au maximum"
          valeur={r.joursConsecutifsMaximum}
          onChange={(joursConsecutifsMaximum) => reglerRegles({ joursConsecutifsMaximum })}
        />
        <ChampHeure
          libelle="Un poste du matin finit au plus tard à"
          valeur={r.finDuMatin}
          onChange={(finDuMatin) => reglerRegles({ finDuMatin })}
        />
        <ChampADefinir
          libelle="Dépannage : durée maximale"
          suffixe="min"
          valeur={r.dureeMaximaleDepannageMinutes}
          onChange={(dureeMaximaleDepannageMinutes) => reglerRegles({ dureeMaximaleDepannageMinutes })}
        />
        <ChampNombre
          libelle="Poids des jours prioritaires"
          pas={0.25}
          aide="1 = comme les autres jours. Au-dessus, leurs trous passent en premier."
          valeur={(r.prioriteParJour ?? PRIORITE_PAR_JOUR_PAR_DEFAUT)[5] ?? 1.5}
          onChange={(valeur) => {
            const poids = Math.max(1, valeur)
            reglerRegles({ prioriteParJour: { 1: poids, 2: poids, 3: poids, 4: poids, 5: poids, 6: poids, 7: poids } })
          }}
        />
        <ChampNombre
          libelle="Jours ouvrables par semaine"
          aide="Un jour de congé vaut le contrat divisé par ce nombre (6 : décompte légal des congés payés)."
          valeur={r.joursHabituelsParSemaine ?? 6}
          onChange={(joursHabituelsParSemaine) =>
            reglerRegles({ joursHabituelsParSemaine: Math.min(7, Math.max(1, joursHabituelsParSemaine)) })
          }
        />
        <ChampNombre
          libelle="Dépassement du contrat au plus"
          suffixe="h / semaine"
          pas={0.25}
          aide="Le planning proposé ne fait pas faire plus d’heures que cela au-delà du contrat."
          valeur={(r.depassementContratMaximumMinutes ?? 60) / 60}
          onChange={(heures) =>
            reglerRegles({ depassementContratMaximumMinutes: Math.round(heures * 60) })
          }
        />
      </div>
      <div className="groupe-boutons">
        <Interrupteur
          libelle="Pauses payées, comprises dans le contrat"
          actif={r.pausesPayeesIncluses}
          onChange={(pausesPayeesIncluses) => reglerRegles({ pausesPayeesIncluses })}
        />
        <Interrupteur
          libelle="Jamais de pause pendant l’affluence"
          actif={r.pauseInterditeEnAffluence}
          onChange={(pauseInterditeEnAffluence) => reglerRegles({ pauseInterditeEnAffluence })}
        />
      </div>
      <p className="champ__libelle">Jours prioritaires (présence maximale : tout le monde y travaille, sauf congé)</p>
      <ChoixDesJours
        jours={r.joursPrioritaires ?? JOURS_PRIORITAIRES_PAR_DEFAUT}
        onChange={(joursPrioritaires) => reglerRegles({ joursPrioritaires })}
      />
      <p className="champ__libelle">Jours de repos de préférence</p>
      <ChoixDesJours
        jours={r.joursDeReposPreferes ?? JOURS_DE_REPOS_PREFERES_PAR_DEFAUT}
        onChange={(joursDeReposPreferes) => reglerRegles({ joursDeReposPreferes })}
      />

      <p className="champ__libelle">Plages où la pause peut être prise</p>
      <EditeurPlages plages={r.fenetresPause} onChange={(fenetresPause) => reglerRegles({ fenetresPause })} />
      <button
        type="button"
        className="bouton"
        onClick={() => reglerRegles({ fenetresPause: [...r.fenetresPause, { debut: '15:00', fin: '17:30' }] })}
      >
        Ajouter une plage
      </button>

      <p className="champ__libelle">Plages de pause du samedi (l’affluence y est différente)</p>
      <EditeurPlages
        plages={fenetresDuJour(r, 6)}
        onChange={(plages) =>
          reglerRegles({
            fenetresPauseParJour: {
              ...(r.fenetresPauseParJour ?? FENETRES_PAUSE_PAR_JOUR_PAR_DEFAUT),
              6: plages,
            },
          })
        }
      />
    </section>
  )
}
