import { useEffect, useState } from 'react'

/**
 * Pastille sur l'icone de l'application (§15, « alertes et rappels »).
 *
 * Sur iPhone et iPad, afficher un nombre sur l'icone de l'ecran d'accueil
 * exige l'autorisation des notifications. L'application ne la demande JAMAIS
 * d'elle-meme : une demande surgie au lancement est refusee neuf fois sur dix,
 * et un refus est definitif. Elle se demande ici, depuis un bouton, quand
 * l'utilisateur sait a quoi elle sert.
 */

export type EtatPastille = 'indisponible' | 'a-demander' | 'autorisee' | 'refusee'

/** Ce que l'appareil permet aujourd'hui. */
export function etatDeLaPastille(): EtatPastille {
  if (typeof navigator === 'undefined') return 'indisponible'
  const appareil = navigator as Navigator & { setAppBadge?: unknown }
  if (typeof appareil.setAppBadge !== 'function') return 'indisponible'
  if (typeof Notification === 'undefined') return 'autorisee'

  switch (Notification.permission) {
    case 'granted':
      return 'autorisee'
    case 'denied':
      return 'refusee'
    default:
      return 'a-demander'
  }
}

/** Demande l'autorisation. Ne peut etre appelee que depuis un geste de l'utilisateur. */
export async function demanderLaPastille(): Promise<EtatPastille> {
  if (typeof Notification === 'undefined') return etatDeLaPastille()
  try {
    await Notification.requestPermission()
  } catch {
    // Navigateur qui refuse la demande : on garde l'etat courant.
  }
  return etatDeLaPastille()
}

/** Pose ou retire le nombre affiche sur l'icone. */
export function poserLaPastille(nombre: number): void {
  const appareil = navigator as Navigator & {
    setAppBadge?: (nombre: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  const action = nombre > 0 ? appareil.setAppBadge?.(nombre) : appareil.clearAppBadge?.()
  action?.catch(() => {
    // Refuse par l'appareil : la pastille du menu suffit.
  })
}

/** Reglage de la pastille, dans l'ecran Parametres. */
export function ReglagePastille({ nombre }: { readonly nombre: number }) {
  const [etat, setEtat] = useState<EtatPastille>('indisponible')

  useEffect(() => {
    setEtat(etatDeLaPastille())
  }, [])

  if (etat === 'indisponible') {
    return (
      <p>
        Cet appareil ne sait pas afficher de nombre sur l’icône de l’application. La pastille
        rouge du menu, elle, fonctionne partout.
      </p>
    )
  }

  return (
    <>
      <p>
        Afficher le nombre d’alertes à traiter directement sur l’icône de l’application, comme le
        fait Mail. La pastille rouge dans le menu fonctionne de toute façon.
      </p>

      {etat === 'autorisee' && (
        <p className="avis">
          <strong>Activée.</strong> L’icône affiche actuellement{' '}
          {nombre === 0 ? 'aucune alerte' : `${nombre} alerte${nombre > 1 ? 's' : ''}`}.
        </p>
      )}

      {etat === 'a-demander' && (
        <>
          <p className="avis">
            Sur iPhone et iPad, cela passe par l’autorisation des notifications. L’application ne
            vous enverra <strong>aucune notification</strong> : elle s’en sert uniquement pour
            poser le chiffre sur l’icône.
          </p>
          <button
            type="button"
            className="bouton bouton--principal"
            onClick={() => {
              void demanderLaPastille().then((nouveau) => {
                setEtat(nouveau)
                if (nouveau === 'autorisee') poserLaPastille(nombre)
              })
            }}
          >
            Activer la pastille sur l’icône
          </button>
        </>
      )}

      {etat === 'refusee' && (
        <p className="avis avis--attention">
          L’autorisation a été refusée. Pour l’accorder : <strong>Réglages</strong> de l’appareil →{' '}
          <strong>Notifications</strong> → <strong>Équipes</strong>. Un refus ne peut pas être
          redemandé depuis l’application.
        </p>
      )}
    </>
  )
}
