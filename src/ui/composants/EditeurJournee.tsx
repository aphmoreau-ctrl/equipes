import { useMemo, useState } from 'react'
import { rangDansRayon, type Collaborateur } from '../../domaine/collaborateur'
import type { HoraireType, Rayon } from '../../domaine/magasin'
import { heuresEnTexte } from '../../domaine/nombres'
import { enMinutes, enTexte } from '../../domaine/temps'
import type { Constat } from '../../moteurs/controle'
import {
  dureeDuPoste,
  type PosteSaisi,
  type ResultatFaisabilite,
} from '../../moteurs/controle/faisabilite'
import type { Vacation } from '../../moteurs/regles'

/**
 * Edition a la main de la journee d'une personne : un ou plusieurs postes,
 * dans le rayon de son choix, au quart d'heure. La faisabilite se verifie
 * a chaque changement, AVANT d'enregistrer : un poste illegal ne s'enregistre
 * pas ; une alerte (sous-effectif, ecart au contrat) s'enregistre en
 * connaissance de cause.
 */

interface Proprietes {
  readonly titre: string
  readonly collaborateur: Collaborateur
  readonly vacationsDuJour: readonly Vacation[]
  readonly rayons: readonly Rayon[]
  readonly rayonParDefaut: string
  readonly horairesTypes: readonly HoraireType[]
  readonly heuresContrat: number
  readonly avertissements: readonly string[]
  readonly verifier: (postes: readonly PosteSaisi[]) => ResultatFaisabilite
  readonly pauseConseillee: (debut: string, fin: string) => { pauseMinutes: number; pauseDebut: string }
  readonly onEnregistrer: (vacations: readonly Vacation[]) => void
  readonly onFermer: () => void
}

const LIBELLE_RANG = { principal: 'titulaire', secondaire: 'renfort', depannage: 'dépannage' } as const

/** Decale une heure « HH:MM » d'un quart d'heure, dans la journee. */
function decaler(heure: string, minutes: number): string {
  if (!/^\d{2}:\d{2}$/.test(heure)) return heure
  return enTexte(Math.max(0, Math.min(24 * 60 - 15, enMinutes(heure) + minutes)))
}

function versPoste(vacation: Vacation): PosteSaisi {
  return {
    rayonId: vacation.rayonId,
    debut: vacation.debut,
    fin: vacation.fin,
    pauseMinutes: vacation.pauseMinutes,
    ...(vacation.pauseDebut !== undefined ? { pauseDebut: vacation.pauseDebut } : {}),
  }
}

function ChampHeure({
  libelle,
  valeur,
  onChange,
}: {
  readonly libelle: string
  readonly valeur: string
  readonly onChange: (valeur: string) => void
}) {
  return (
    <div className="champ-heure">
      <span className="champ__libelle">{libelle}</span>
      <div className="champ-heure__ligne">
        <button
          type="button"
          className="bouton bouton--carre"
          aria-label={`${libelle} : un quart d’heure plus tôt`}
          onClick={() => onChange(decaler(valeur, -15))}
        >
          −
        </button>
        <input
          className="champ__saisie champ-heure__saisie"
          type="time"
          step={900}
          value={valeur}
          aria-label={libelle}
          onChange={(evenement) => onChange(evenement.target.value)}
        />
        <button
          type="button"
          className="bouton bouton--carre"
          aria-label={`${libelle} : un quart d’heure plus tard`}
          onClick={() => onChange(decaler(valeur, 15))}
        >
          +
        </button>
      </div>
    </div>
  )
}

function ListeConstats({
  titre,
  constats,
  classe,
}: {
  readonly titre: string
  readonly constats: readonly Constat[]
  readonly classe: string
}) {
  if (constats.length === 0) return null
  return (
    <>
      <p className="champ__libelle">{titre}</p>
      <ul className="liste-alertes">
        {constats.map((constat) => (
          <li
            key={`${constat.id}|${constat.libelle}`}
            className={`alerte ${constat.gravite === 'bloquant' && classe !== 'alerte--information' ? 'alerte--urgent' : classe}`}
          >
            <p className="alerte__titre">
              {constat.gravite === 'bloquant' ? 'Bloquant — ' : ''}
              {constat.libelle}
            </p>
            <p className="alerte__detail">{constat.explication}</p>
          </li>
        ))}
      </ul>
    </>
  )
}

export function EditeurJournee(props: Proprietes) {
  const { collaborateur } = props
  const [postes, setPostes] = useState<readonly PosteSaisi[]>(() =>
    [...props.vacationsDuJour].sort((a, b) => a.debut.localeCompare(b.debut)).map(versPoste),
  )

  /** Postes dont la pause a ete saisie a la main : on n'y touche plus. */
  const [pausesManuelles, setPausesManuelles] = useState<ReadonlySet<number>>(() =>
    // Une journee deja enregistree garde sa pause telle quelle.
    new Set(props.vacationsDuJour.map((_, rang) => rang)),
  )
  const { verifier } = props
  const resultat = useMemo(() => verifier(postes), [postes, verifier])

  function changer(rang: number, modification: Partial<PosteSaisi>, recalculerPause = false): void {
    setPostes((avant) =>
      avant.map((poste, i) => {
        if (i !== rang) return poste
        const nouveau = { ...poste, ...modification }
        if (!recalculerPause || pausesManuelles.has(rang) || dureeDuPoste(nouveau) === 0) return nouveau
        return { ...nouveau, ...props.pauseConseillee(nouveau.debut, nouveau.fin) }
      }),
    )
  }

  function marquerManuelle(rang: number): void {
    if (!pausesManuelles.has(rang)) setPausesManuelles(new Set([...pausesManuelles, rang]))
  }

  function ajouterUnPoste(): void {
    const dernier = postes[postes.length - 1]
    const debut = dernier !== undefined && dureeDuPoste(dernier) > 0 ? dernier.fin : '09:00'
    const fin = decaler(decaler(decaler(decaler(debut, 15), 15), 15), 15)
    setPostes([
      ...postes,
      { rayonId: props.rayonParDefaut, debut, fin, ...props.pauseConseillee(debut, fin) },
    ])
  }

  // Rayons : ceux de la personne d'abord, puis tous les autres (signales).
  const rayonsTries = [...props.rayons].sort((a, b) => {
    const rang = (r: Rayon) => {
      const place = rangDansRayon(collaborateur, r.id)
      return place === 'principal' ? 0 : place === 'secondaire' ? 1 : place === 'depannage' ? 2 : 3
    }
    return rang(a) - rang(b) || a.ordre - b.ordre
  })

  const total = postes.reduce((somme, poste) => somme + dureeDuPoste(poste), 0)
  const verdict = resultat.verdict
  const ecartApres = resultat.heuresApres - props.heuresContrat

  return (
    <div className="editeur-case" role="region" aria-label="Modifier la journée">
      <p className="champ__libelle">{props.titre}</p>
      {props.avertissements.map((texte) => (
        <p key={texte} className="avis avis--attention">
          {texte}
        </p>
      ))}

      {postes.length === 0 && <p className="champ__aide">Repos ce jour-là.</p>}

      {postes.map((poste, rang) => {
        const place = rangDansRayon(collaborateur, poste.rayonId)
        return (
          <fieldset key={rang} className="poste-saisi">
            <legend>
              {postes.length > 1 ? `Poste ${rang + 1}` : 'Poste'} ·{' '}
              {heuresEnTexte(dureeDuPoste(poste) / 60, 2)} de présence ·{' '}
              {heuresEnTexte(Math.max(0, dureeDuPoste(poste) - poste.pauseMinutes) / 60, 2)} de travail effectif
            </legend>
            <label className="champ">
              <span className="champ__libelle">Rayon</span>
              <select
                className="champ__saisie"
                value={poste.rayonId}
                onChange={(evenement) => changer(rang, { rayonId: evenement.target.value })}
              >
                {rayonsTries.map((rayon) => {
                  const r = rangDansRayon(collaborateur, rayon.id)
                  return (
                    <option key={rayon.id} value={rayon.id}>
                      {rayon.nom}
                      {r === null ? ' — ne le tient pas' : ` — ${LIBELLE_RANG[r]}`}
                    </option>
                  )
                })}
              </select>
            </label>
            {place === null && (
              <p className="avis avis--attention">
                {collaborateur.prenom} ne tient pas ce rayon (ni titulaire, ni renfort).
              </p>
            )}
            <div className="poste-saisi__heures">
              <ChampHeure
                libelle="Début"
                valeur={poste.debut}
                onChange={(valeur) => changer(rang, { debut: valeur }, true)}
              />
              <ChampHeure
                libelle="Fin"
                valeur={poste.fin}
                onChange={(valeur) => changer(rang, { fin: valeur }, true)}
              />
              <label className="champ champ--etroit">
                <span className="champ__libelle">Pause (min)</span>
                <input
                  className="champ__saisie"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={240}
                  step={1}
                  value={poste.pauseMinutes}
                  onChange={(evenement) => {
                    marquerManuelle(rang)
                    changer(rang, { pauseMinutes: Math.max(0, Number(evenement.target.value) || 0) })
                  }}
                />
              </label>
              {poste.pauseMinutes > 0 && (
                <ChampHeure
                  libelle="Début de pause"
                  valeur={poste.pauseDebut ?? ''}
                  onChange={(valeur) => {
                    marquerManuelle(rang)
                    changer(rang, { pauseDebut: valeur })
                  }}
                />
              )}
            </div>
            <div className="groupe-boutons">
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  const sans = new Set(pausesManuelles)
                  sans.delete(rang)
                  setPausesManuelles(sans)
                  const poste = postes[rang]
                  if (poste !== undefined && dureeDuPoste(poste) > 0) {
                    setPostes(postes.map((p, i) => (i === rang ? { ...p, ...props.pauseConseillee(p.debut, p.fin) } : p)))
                  }
                }}
              >
                Pause conseillée
                <span className="bouton__aide">durée et heure selon vos règles</span>
              </button>
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  setPostes(postes.filter((_, i) => i !== rang))
                  setPausesManuelles(
                    new Set([...pausesManuelles].filter((i) => i !== rang).map((i) => (i > rang ? i - 1 : i))),
                  )
                }}
              >
                Retirer ce poste
              </button>
            </div>
          </fieldset>
        )
      })}

      {props.horairesTypes.length > 0 && (
        <>
          <p className="champ__aide">Horaire type (remplace la journée)</p>
          <div className="groupe-boutons">
            {props.horairesTypes.map((horaire) => (
              <button
                key={horaire.id}
                type="button"
                className="bouton"
                onClick={() => {
                  setPausesManuelles(new Set())
                  setPostes([
                    {
                      rayonId: postes[0]?.rayonId ?? props.rayonParDefaut,
                      debut: horaire.debut,
                      fin: horaire.fin,
                      pauseMinutes: horaire.pauseMinutes,
                      ...(horaire.pauseDebut !== undefined ? { pauseDebut: horaire.pauseDebut } : {}),
                    },
                  ])
                }}
              >
                {horaire.nom}
                <span className="bouton__aide">
                  {horaire.debut}–{horaire.fin}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="groupe-boutons">
        <button type="button" className="bouton" onClick={ajouterUnPoste}>
          Ajouter un poste
          <span className="bouton__aide">renfort dans un autre rayon, coupure…</span>
        </button>
        <button
          type="button"
          className="bouton"
          onClick={() => {
            setPostes([])
            setPausesManuelles(new Set())
          }}
        >
          Repos
          <span className="bouton__aide">vider la journée</span>
        </button>
      </div>

      <section className="faisabilite" aria-live="polite">
        <h3>Vérification de faisabilité</h3>
        <p>
          <span
            className={`verdict ${verdict === 'faisable' ? 'verdict--bon' : verdict === 'a-discuter' ? 'verdict--moyen' : 'verdict--mauvais'}`}
          >
            {verdict === 'faisable'
              ? 'Faisable'
              : verdict === 'a-discuter'
                ? 'Faisable, avec des alertes'
                : 'Impossible en l’état'}
          </span>
          Journée : {heuresEnTexte(total / 60, 2)} · Semaine :{' '}
          {heuresEnTexte(resultat.heuresAvant, 2)} → <strong>{heuresEnTexte(resultat.heuresApres, 2)}</strong>{' '}
          pour {heuresEnTexte(props.heuresContrat, 2)} au contrat
          {Math.abs(ecartApres) >= 0.25 &&
            ` (${ecartApres > 0 ? '+' : '−'}${heuresEnTexte(Math.abs(ecartApres), 2)})`}
        </p>
        {resultat.erreursDeSaisie.length > 0 && (
          <ul className="liste-alertes">
            {resultat.erreursDeSaisie.map((erreur) => (
              <li key={erreur} className="alerte alerte--urgent">
                <p className="alerte__titre">{erreur}</p>
              </li>
            ))}
          </ul>
        )}
        <ListeConstats
          titre="Ce que la modification provoque"
          constats={resultat.nouveaux}
          classe="alerte--attention"
        />
        <ListeConstats
          titre="Ce qui évolue (déjà signalé, nouveau détail)"
          constats={resultat.evolues}
          classe="alerte--attention"
        />
        <ListeConstats
          titre="Ce qu’elle règle"
          constats={resultat.resolus}
          classe="alerte--information"
        />
        {resultat.restants.length > 0 && (
          <details>
            <summary>
              {resultat.restants.length} constat{resultat.restants.length > 1 ? 's' : ''} déjà
              présent{resultat.restants.length > 1 ? 's' : ''}, inchangé
              {resultat.restants.length > 1 ? 's' : ''}
            </summary>
            <ListeConstats titre="" constats={resultat.restants} classe="alerte--attention" />
          </details>
        )}
      </section>

      <div className="groupe-boutons">
        <button
          type="button"
          className="bouton bouton--principal"
          disabled={verdict === 'impossible'}
          onClick={() => props.onEnregistrer(resultat.vacations)}
        >
          {verdict === 'a-discuter' ? 'Enregistrer malgré les alertes' : 'Enregistrer'}
          <span className="bouton__aide">la journée sera verrouillée</span>
        </button>
        <button type="button" className="bouton" onClick={props.onFermer}>
          Annuler
        </button>
      </div>
      {verdict === 'impossible' && resultat.erreursDeSaisie.length === 0 && (
        <p className="champ__aide">
          Une règle légale serait enfreinte : corrigez les horaires ci-dessus pour pouvoir
          enregistrer.
        </p>
      )}
    </div>
  )
}
