import { jourEnTexte } from '../../domaine/calendrier'
import type { Constat } from '../../moteurs/controle'
import { Depliant } from './Champ'

/**
 * Controle de la semaine : tout ce qui ne va pas, bloquant d'abord.
 *
 * Toucher « Voir dans la grille » ouvre la case concernee. Une alerte (non
 * bloquante) peut etre acceptee pour la semaine : elle quitte la liste, reste
 * visible dans « acceptees », et l'acceptation est datee. Un bloquant ne
 * s'accepte jamais : il se corrige.
 */

interface Proprietes {
  readonly constats: readonly Constat[]
  readonly acceptees: readonly { readonly id: string; readonly le: string }[]
  readonly onAccepter: (id: string) => void
  readonly onAnnulerAcceptation: (id: string) => void
  readonly onOuvrir: (collaborateurId: string, jour: string) => void
}

function Ligne({
  constat,
  accepteeLe,
  onAccepter,
  onAnnuler,
  onOuvrir,
}: {
  readonly constat: Constat
  readonly accepteeLe?: string
  readonly onAccepter?: () => void
  readonly onAnnuler?: () => void
  readonly onOuvrir: (collaborateurId: string, jour: string) => void
}) {
  return (
    <li className={`controle-semaine__ligne controle-semaine__ligne--${constat.gravite}`}>
      <div className="controle-semaine__tete">
        <span className={constat.gravite === 'bloquant' ? 'verdict verdict--mauvais' : 'verdict verdict--moyen'}>
          {constat.gravite === 'bloquant' ? 'Bloquant' : 'Alerte'}
        </span>
        <span className="controle-semaine__categorie">{constat.categorie}</span>
      </div>
      <p className="controle-semaine__libelle">{constat.libelle}</p>
      <p className="controle-semaine__explication">{constat.explication}</p>
      <div className="groupe-boutons">
        {constat.collaborateurId !== null && constat.jour !== null && (
          <button
            type="button"
            className="bouton"
            onClick={() => onOuvrir(constat.collaborateurId as string, constat.jour as string)}
          >
            Voir dans la grille
          </button>
        )}
        {onAccepter !== undefined && (
          <button type="button" className="bouton" onClick={onAccepter}>
            Accepter pour cette semaine
          </button>
        )}
        {onAnnuler !== undefined && (
          <>
            <span className="bouton__aide">acceptée le {jourEnTexte(accepteeLe ?? '')}</span>
            <button type="button" className="bouton" onClick={onAnnuler}>
              Annuler l’acceptation
            </button>
          </>
        )}
      </div>
    </li>
  )
}

export function ControleSemaine({
  constats,
  acceptees,
  onAccepter,
  onAnnulerAcceptation,
  onOuvrir,
}: Proprietes) {
  const ids = new Set(acceptees.map((a) => a.id))
  const aConfirmer = constats.filter((c) => c.aConfirmer === true && !ids.has(c.id))
  const ouverts = constats.filter(
    (c) => c.aConfirmer !== true && (c.gravite === 'bloquant' || !ids.has(c.id)),
  )
  const accepteesVisibles = constats.filter((c) => c.gravite === 'alerte' && ids.has(c.id))
  const bloquants = ouverts.filter((c) => c.gravite === 'bloquant').length
  const alertes = ouverts.length - bloquants

  return (
    <section className="carte" aria-labelledby="titre-controle-semaine">
      <h2 id="titre-controle-semaine">Contrôle de la semaine</h2>
      <p>
        {ouverts.length === 0
          ? 'Rien à signaler : aucune règle enfreinte, aucune alerte en suspens.'
          : `${bloquants} bloquant${bloquants > 1 ? 's' : ''}, ${alertes} alerte${alertes > 1 ? 's' : ''}. ` +
            'Un bloquant se corrige ; une alerte peut être acceptée pour la semaine.'}
      </p>

      {ouverts.length > 0 && (
        <ul className="controle-semaine">
          {ouverts.map((constat) => (
            <Ligne
              key={constat.id}
              constat={constat}
              onOuvrir={onOuvrir}
              {...(constat.gravite === 'alerte' ? { onAccepter: () => onAccepter(constat.id) } : {})}
            />
          ))}
        </ul>
      )}

      {aConfirmer.length > 0 && (
        <Depliant
          titre="À confirmer quand la semaine voisine sera construite"
          resume={String(aConfirmer.length)}
        >
          <p className="champ__aide">
            Pas une erreur : la règle (souvent le repos hebdomadaire) porte sur deux semaines, et
            l’autre n’est pas encore planifiée.
          </p>
          <ul className="controle-semaine">
            {aConfirmer.map((constat) => (
              <Ligne key={constat.id} constat={constat} onOuvrir={onOuvrir} />
            ))}
          </ul>
        </Depliant>
      )}

      {accepteesVisibles.length > 0 && (
        <Depliant
          titre="Alertes acceptées pour cette semaine"
          resume={String(accepteesVisibles.length)}
        >
          <ul className="controle-semaine">
            {accepteesVisibles.map((constat) => {
              const le = acceptees.find((a) => a.id === constat.id)?.le
              return (
                <Ligne
                  key={constat.id}
                  constat={constat}
                  onOuvrir={onOuvrir}
                  onAnnuler={() => onAnnulerAcceptation(constat.id)}
                  {...(le === undefined ? {} : { accepteeLe: le })}
                />
              )
            })}
          </ul>
        </Depliant>
      )}
    </section>
  )
}
