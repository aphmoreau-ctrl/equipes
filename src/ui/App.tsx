import { Navigate, Route, Routes } from 'react-router-dom'
import { EcranAVenir } from './EcranAVenir'
import { Navigation } from './Navigation'
import { MODULES } from './modules'
import { Parametres } from './ecrans/Parametres'
import { EcranVerrouillage } from './verrouillage/EcranVerrouillage'
import { useVerrouillage } from './verrouillage/useVerrouillage'

export function App() {
  const verrouillage = useVerrouillage()

  // Le temps de lire le stockage de l'appareil : rien, pour eviter que
  // l'ecran de code n'apparaisse puis ne disparaisse aussitot.
  if (verrouillage.etat === 'chargement') {
    return <div className="verrou" aria-busy="true" />
  }

  if (verrouillage.etat !== 'ouvert') {
    return (
      <EcranVerrouillage
        mode={
          verrouillage.etat === 'a-definir'
            ? 'definir'
            : verrouillage.etat === 'proposer-face-id'
              ? 'proposer-face-id'
              : 'ouvrir'
        }
        faceIdEnregistre={verrouillage.faceIdEnregistre}
        onDefinir={verrouillage.definirCode}
        onEssayer={verrouillage.essayerCode}
        onFaceId={verrouillage.essayerFaceId}
        onActiverFaceId={verrouillage.activerFaceId}
        onIgnorerFaceId={verrouillage.ignorerFaceId}
      />
    )
  }

  return (
    <div className="application">
      <Navigation />
      <main className="contenu">
        <div className="contenu__interieur">
          <Routes>
            {MODULES.map((module) => (
              <Route
                key={module.id}
                path={module.chemin}
                element={
                  module.id === 'parametres' ? (
                    <Parametres
                      faceIdPossible={verrouillage.faceIdPossible}
                      faceIdEnregistre={verrouillage.faceIdEnregistre}
                      onActiverFaceId={verrouillage.activerFaceId}
                      onDesactiverFaceId={verrouillage.desactiverFaceId}
                      onChangerCode={verrouillage.changerDeCode}
                    />
                  ) : (
                    <EcranAVenir module={module} />
                  )
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
