import { useEffect, useState } from 'react'
import { useDonnees } from '../DonneesProvider'
import { ReglagePastille } from '../composants/PastilleIcone'
import { SectionRegles } from './parametres/SectionRegles'
import { SectionCompetences } from './parametres/SectionCompetences'
import { SectionTaches } from './parametres/SectionTaches'
import { useNombreUrgences } from '../Navigation'
import { MODULES } from '../modules'
import {
  SectionBudgets,
  SectionEvenements,
  SectionFrequentation,
  SectionHoraires,
  SectionHorairesTypes,
  SectionRayons,
} from './parametres/SectionsMagasin'
import { SectionModeleRayon } from './parametres/SectionModeleRayon'
import { SectionSauvegarde } from './parametres/SectionSauvegarde'

interface Proprietes {
  readonly faceIdPossible: boolean
  readonly faceIdEnregistre: boolean
  readonly onActiverFaceId: () => Promise<void>
  readonly onDesactiverFaceId: () => void
  readonly onChangerCode: () => void
}

interface EtatAppareil {
  readonly installee: boolean
  readonly horsLignePret: boolean
}

function useEtatAppareil(): EtatAppareil {
  const [etat, setEtat] = useState<EtatAppareil>({ installee: false, horsLignePret: false })

  useEffect(() => {
    const enPleinEcran =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches
    const surIOS = (navigator as { standalone?: boolean }).standalone === true
    const horsLignePret =
      'serviceWorker' in navigator && navigator.serviceWorker.controller !== null

    setEtat({ installee: enPleinEcran || surIOS, horsLignePret })
  }, [])

  return etat
}

export function Parametres({
  faceIdPossible,
  faceIdEnregistre,
  onActiverFaceId,
  onDesactiverFaceId,
  onChangerCode,
}: Proprietes) {
  const appareil = useEtatAppareil()
  const urgences = useNombreUrgences()
  const { etat, reinitialiser } = useDonnees()
  const [confirmationCode, setConfirmationCode] = useState(false)
  const [confirmationDonnees, setConfirmationDonnees] = useState(false)
  const [erreurFaceId, setErreurFaceId] = useState('')

  async function activerFaceId(): Promise<void> {
    setErreurFaceId('')
    try {
      await onActiverFaceId()
    } catch (probleme) {
      setErreurFaceId(
        probleme instanceof Error
          ? `Activation impossible : ${probleme.message}`
          : 'Activation impossible.',
      )
    }
  }

  return (
    <>
      <header className="entete">
        <h1>Paramètres</h1>
        <p>Magasin, rayons, horaires, règles légales, verrouillage et sauvegarde.</p>
      </header>

      {etat.demonstration && (
        <p className="avis">
          <strong>Données de démonstration, entièrement fictives.</strong> Modifiez ce que vous
          voulez : vos changements restent sur cet appareil, et vous pouvez revenir à la
          démonstration à tout moment depuis le bas de cet écran.
        </p>
      )}

      <SectionRayons />
      <SectionHoraires />
      <SectionFrequentation />
      <SectionHorairesTypes />
      <SectionEvenements />
      <SectionBudgets />

      <SectionCompetences />
      <SectionTaches />

      {etat.configurations.map((configuration) => (
        <SectionModeleRayon key={configuration.rayonId} rayonId={configuration.rayonId} />
      ))}

      <SectionRegles />

      <section className="carte">
        <h2>Pastille sur l’icône</h2>
        <ReglagePastille nombre={urgences} />
      </section>

      <section className="carte">
        <h2>Face ID</h2>
        {faceIdPossible ? (
          <>
            <p>
              {faceIdEnregistre
                ? 'Activé sur cet appareil : l’application s’ouvre d’un regard, sans saisir le code.'
                : 'Cet appareil sait vous reconnaître. Vous pourrez ouvrir l’application sans saisir votre code.'}{' '}
              Sur Mac, c’est Touch ID.
            </p>
            <p className="avis">
              Votre visage ne quitte jamais l’appareil : l’application ne reçoit qu’un oui ou un
              non. Le code reste le secours si la reconnaissance échoue.
            </p>
            {faceIdEnregistre ? (
              <button type="button" className="bouton" onClick={onDesactiverFaceId}>
                Désactiver Face ID sur cet appareil
              </button>
            ) : (
              <button
                type="button"
                className="bouton bouton--principal"
                onClick={() => void activerFaceId()}
              >
                Activer Face ID
              </button>
            )}
            {erreurFaceId !== '' && <p className="verrou__erreur">{erreurFaceId}</p>}
          </>
        ) : (
          <p>
            Cet appareil ou ce navigateur ne propose pas la reconnaissance du visage ou de
            l’empreinte. Le code reste le seul moyen d’ouvrir l’application ici. Sur iPhone et
            iPad, Face ID exige d’ouvrir le site dans Safari.
          </p>
        )}
      </section>

      <section className="carte">
        <h2>Code de secours</h2>
        <p>
          Le code sert quand Face ID échoue, n’est pas disponible, ou n’a pas été activé. Il n’est
          pas enregistré : seule son empreinte est conservée sur cet appareil, et elle n’est envoyée
          nulle part.
        </p>
        <p className="avis avis--attention">
          Le code comme Face ID empêchent un curieux d’ouvrir l’application sur un iPad laissé sans
          surveillance. Ce n’est pas encore une protection des données : celle-ci viendra avec le
          compte et les règles de sécurité (lot 4).
        </p>

        {confirmationCode ? (
          <>
            <p>
              <strong>Confirmer ?</strong> L’application va se verrouiller et vous devrez choisir un
              nouveau code tout de suite.
            </p>
            <p>
              <button type="button" className="bouton bouton--principal" onClick={onChangerCode}>
                Oui, changer le code
              </button>{' '}
              <button type="button" className="bouton" onClick={() => setConfirmationCode(false)}>
                Annuler
              </button>
            </p>
          </>
        ) : (
          <button type="button" className="bouton" onClick={() => setConfirmationCode(true)}>
            Changer le code de verrouillage
          </button>
        )}
      </section>

      <section className="carte">
        <h2>Cette application</h2>
        <dl className="liste-faits">
          <dt>Version</dt>
          <dd>{__VERSION_APP__}</dd>

          <dt>Mode d’ouverture</dt>
          <dd>
            {appareil.installee
              ? 'Installée sur l’écran d’accueil'
              : 'Ouverte dans le navigateur (non installée)'}
          </dd>

          <dt>Fonctionnement hors ligne</dt>
          <dd>{appareil.horsLignePret ? 'Prêt' : 'Pas encore actif sur cet appareil'}</dd>

          <dt>Données</dt>
          <dd>{etat.demonstration ? 'Démonstration (fictives)' : 'Modifiées par vous'}</dd>
        </dl>

        {!appareil.installee && (
          <p className="avis">
            Pour installer l’application : ouvrez ce site <strong>dans Safari</strong>, touchez le
            bouton <strong>Partager</strong>, puis <strong>« Sur l’écran d’accueil »</strong>. Seul
            Safari sait installer une application sur iPhone et iPad.
          </p>
        )}

        <p className="avis avis--attention">
          Vos réglages sont pour l’instant enregistrés <strong>sur cet appareil seulement</strong>.
          La synchronisation entre iPad, iPhone et Mac arrive au lot 4, avec Firebase.
        </p>

        {confirmationDonnees ? (
          <>
            <p>
              <strong>Confirmer ?</strong> Tous vos réglages seront remplacés par ceux de la
              démonstration. Cette action ne peut pas être annulée.
            </p>
            <p>
              <button
                type="button"
                className="bouton bouton--principal"
                onClick={() => {
                  reinitialiser()
                  setConfirmationDonnees(false)
                }}
              >
                Oui, tout réinitialiser
              </button>{' '}
              <button type="button" className="bouton" onClick={() => setConfirmationDonnees(false)}>
                Annuler
              </button>
            </p>
          </>
        ) : (
          <button type="button" className="bouton" onClick={() => setConfirmationDonnees(true)}>
            Revenir aux données de démonstration
          </button>
        )}
      </section>

      <SectionSauvegarde />

      <section className="carte">
        <h2>Avancement du projet</h2>
        <ul className="liste-simple">
          {MODULES.map((module) => (
            <li key={module.id}>
              {module.titre}{' '}
              <span className={module.pret ? 'etiquette' : 'etiquette etiquette--attente'}>
                {module.pret ? 'disponible' : module.livraison}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
