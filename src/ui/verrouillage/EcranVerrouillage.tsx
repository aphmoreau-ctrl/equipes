import { useState } from 'react'
import { LONGUEUR_MAXIMALE, LONGUEUR_MINIMALE, messageDeValidation } from './code'
import type { ResultatFaceId } from './faceId'

interface Proprietes {
  readonly mode: 'definir' | 'ouvrir' | 'proposer-face-id'
  /** Une cle d'acces est enregistree sur cet appareil. */
  readonly faceIdEnregistre: boolean
  readonly onDefinir: (code: string) => Promise<void>
  readonly onEssayer: (code: string) => Promise<boolean>
  readonly onFaceId: () => Promise<ResultatFaceId>
  readonly onActiverFaceId: () => Promise<void>
  readonly onIgnorerFaceId: () => void
}

const CHIFFRES = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

export function EcranVerrouillage({
  mode,
  faceIdEnregistre,
  onDefinir,
  onEssayer,
  onFaceId,
  onActiverFaceId,
  onIgnorerFaceId,
}: Proprietes) {
  const [saisie, setSaisie] = useState('')
  const [premierCode, setPremierCode] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [clavierDemande, setClavierDemande] = useState(false)

  const enConfirmation = mode === 'definir' && premierCode !== null
  const parFaceId = mode === 'ouvrir' && faceIdEnregistre && !clavierDemande

  function ajouter(chiffre: string): void {
    setErreur('')
    setSaisie((actuelle) => (actuelle.length >= LONGUEUR_MAXIMALE ? actuelle : actuelle + chiffre))
  }

  function effacer(): void {
    setErreur('')
    setSaisie((actuelle) => actuelle.slice(0, -1))
  }

  async function avec(action: () => Promise<void>): Promise<void> {
    if (occupe) return
    setOccupe(true)
    try {
      await action()
    } catch (probleme) {
      setErreur(probleme instanceof Error ? probleme.message : 'Une erreur est survenue.')
    } finally {
      setOccupe(false)
    }
  }

  async function valider(): Promise<void> {
    const probleme = messageDeValidation(saisie)
    if (probleme !== null) {
      setErreur(probleme)
      return
    }

    await avec(async () => {
      if (mode === 'ouvrir') {
        if (!(await onEssayer(saisie))) {
          setErreur('Code incorrect.')
          setSaisie('')
        }
        return
      }

      if (premierCode === null) {
        setPremierCode(saisie)
        setSaisie('')
        return
      }

      if (saisie !== premierCode) {
        setErreur('Les deux codes ne correspondent pas. Recommencez.')
        setPremierCode(null)
        setSaisie('')
        return
      }

      await onDefinir(saisie)
    })
  }

  async function deverrouillerParFaceId(): Promise<void> {
    await avec(async () => {
      const resultat = await onFaceId()
      if (resultat === 'echec') {
        setErreur('Reconnaissance impossible. Utilisez votre code.')
        setClavierDemande(true)
      }
      // « annule » : l'utilisateur a ferme la demande, rien a signaler.
    })
  }

  function entete(titre: string, aide: string) {
    return (
      <>
        <div className="verrou__logo" aria-hidden="true">
          É
        </div>
        <h1 className="verrou__titre">{titre}</h1>
        <p className="verrou__aide">{aide}</p>
      </>
    )
  }

  // ---------------------------------------- Proposition d'activer Face ID
  if (mode === 'proposer-face-id') {
    return (
      <div className="verrou">
        <div className="verrou__boite">
          {entete(
            'Activer Face ID ?',
            'Vous ouvrirez l’application d’un regard, sans saisir votre code. Sur Mac, c’est Touch ID.',
          )}

          <p className="avis">
            Votre visage ne quitte jamais l’appareil : l’application ne reçoit qu’un oui ou un non.
            Votre code reste disponible à tout moment si la reconnaissance échoue.
          </p>

          <p>
            <button
              type="button"
              className="bouton bouton--principal verrou__bouton-large"
              onClick={() => void avec(onActiverFaceId)}
              disabled={occupe}
            >
              Activer Face ID
            </button>
          </p>
          <p>
            <button type="button" className="bouton verrou__bouton-large" onClick={onIgnorerFaceId}>
              Plus tard
            </button>
          </p>

          <p className="verrou__erreur" role="alert">
            {erreur}
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------- Ouverture par Face ID
  if (parFaceId) {
    return (
      <div className="verrou">
        <div className="verrou__boite">
          {entete('Équipes', 'Regardez votre appareil pour ouvrir l’application.')}

          <p>
            <button
              type="button"
              className="bouton bouton--principal verrou__bouton-large"
              onClick={() => void deverrouillerParFaceId()}
              disabled={occupe}
            >
              Déverrouiller avec Face ID
            </button>
          </p>
          <p>
            <button
              type="button"
              className="bouton verrou__bouton-large"
              onClick={() => setClavierDemande(true)}
            >
              Utiliser mon code
            </button>
          </p>

          <p className="verrou__erreur" role="alert">
            {erreur}
          </p>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------- Clavier numerique
  const titre =
    mode === 'ouvrir'
      ? 'Entrez votre code'
      : enConfirmation
        ? 'Confirmez votre code'
        : 'Choisissez un code'

  const aide =
    mode === 'ouvrir'
      ? 'Ce code protège l’accès à l’application sur cet appareil.'
      : enConfirmation
        ? 'Saisissez une seconde fois le même code.'
        : `De ${LONGUEUR_MINIMALE} à ${LONGUEUR_MAXIMALE} chiffres. Ce code reste sur cet appareil : il n’est envoyé nulle part, et personne d’autre ne peut le retrouver.`

  return (
    <div className="verrou">
      <div className="verrou__boite">
        {entete(titre, aide)}

        <div className="verrou__points" role="status" aria-label={`${saisie.length} chiffres saisis`}>
          {Array.from({ length: LONGUEUR_MAXIMALE }, (_, index) => (
            <span
              key={index}
              className={
                index < saisie.length ? 'verrou__point verrou__point--plein' : 'verrou__point'
              }
            />
          ))}
        </div>

        <div className="verrou__clavier">
          {CHIFFRES.map((chiffre) => (
            <button
              key={chiffre}
              type="button"
              className="verrou__touche"
              onClick={() => ajouter(chiffre)}
            >
              {chiffre}
            </button>
          ))}

          <button
            type="button"
            className="verrou__touche verrou__touche--texte"
            onClick={effacer}
            disabled={saisie.length === 0}
          >
            Effacer
          </button>

          <button type="button" className="verrou__touche" onClick={() => ajouter('0')}>
            0
          </button>

          <button
            type="button"
            className="verrou__touche verrou__touche--texte"
            onClick={() => void valider()}
            disabled={occupe || saisie.length < LONGUEUR_MINIMALE}
          >
            Valider
          </button>
        </div>

        {mode === 'ouvrir' && faceIdEnregistre && clavierDemande && (
          <p>
            <button
              type="button"
              className="bouton"
              onClick={() => {
                setErreur('')
                setClavierDemande(false)
              }}
            >
              Revenir à Face ID
            </button>
          </p>
        )}

        <p className="verrou__erreur" role="alert">
          {erreur}
        </p>
      </div>
    </div>
  )
}
