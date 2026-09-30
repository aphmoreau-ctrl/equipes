import { Navigate, Route, Routes } from 'react-router-dom'
import { EcranAVenir } from './EcranAVenir'
import { BarreOnglets, EnteteMobile, MenuLateral } from './Navigation'
import { MODULES } from './modules'
import { Parametres } from './ecrans/Parametres'
import { Besoin } from './ecrans/Besoin'
import { Equipe } from './ecrans/Equipe'
import { Alertes } from './ecrans/Alertes'
import { Planning } from './ecrans/Planning'
import { Aujourdhui } from './ecrans/Aujourdhui'
import { Conges } from './ecrans/Conges'
import { Heures } from './ecrans/Heures'
import { Competences } from './ecrans/Competences'
import { DonneesProvider } from './DonneesProvider'
import { EcranVerrouillage } from './verrouillage/EcranVerrouillage'
import { useVerrouillage } from './verrouillage/useVerrouillage'
import { useDisposition } from './useDisposition'

export function App() {
  const verrouillage = useVerrouillage()
  const disposition = useDisposition()

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

  const enOnglets = disposition === 'onglets'

  return (
    <DonneesProvider>
    <div className={enOnglets ? 'application application--onglets' : 'application'}>
      {enOnglets ? <EnteteMobile /> : <MenuLateral />}
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
                  ) : module.id === 'besoin' ? (
                    <Besoin />
                  ) : module.id === 'equipe' ? (
                    <Equipe />
                  ) : module.id === 'alertes' ? (
                    <Alertes />
                  ) : module.id === 'planning' ? (
                    <Planning />
                  ) : module.id === 'aujourdhui' ? (
                    <Aujourdhui />
                  ) : module.id === 'conges' ? (
                    <Conges />
                  ) : module.id === 'heures' ? (
                    <Heures />
                  ) : module.id === 'competences' ? (
                    <Competences />
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
      {enOnglets && <BarreOnglets />}
    </div>
    </DonneesProvider>
  )
}
