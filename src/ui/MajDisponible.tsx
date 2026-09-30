import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Bandeau propose quand une nouvelle version a ete telechargee.
 *
 * La mise a jour n'est jamais imposee : l'utilisateur peut etre en train de
 * travailler. Elle s'applique quand il le decide, ou au prochain lancement.
 */
export function MajDisponible() {
  const {
    needRefresh: [aBesoinDeRecharger, setABesoinDeRecharger],
    updateServiceWorker,
  } = useRegisterSW()

  if (!aBesoinDeRecharger) return null

  return (
    <div className="maj" role="status">
      <span>Une nouvelle version est prête.</span>
      <button
        type="button"
        className="bouton bouton--principal"
        onClick={() => void updateServiceWorker(true)}
      >
        Mettre à jour
      </button>
      <button type="button" className="bouton" onClick={() => setABesoinDeRecharger(false)}>
        Plus tard
      </button>
    </div>
  )
}
