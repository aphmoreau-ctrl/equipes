import { useRef, useState } from 'react'
import type { EtatApplication } from '../../../donnees/etat'
import {
  creerSauvegarde,
  lireSauvegarde,
  nomDuFichier,
  resumerSauvegarde,
} from '../../../donnees/sauvegarde'
import { useDonnees } from '../../DonneesProvider'

interface Proposition {
  readonly etat: EtatApplication
  readonly exporteLe: string
}

function dateHeureEnTexte(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'date inconnue'
  return date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
}

/**
 * Sauvegarde et restauration sur fichier. Le fichier est enregistre sur
 * l'appareil (sur iPad : application Fichiers) ; l'application ne l'envoie
 * nulle part.
 */
export function SectionSauvegarde() {
  const { etat, remplacer } = useDonnees()
  const champFichier = useRef<HTMLInputElement>(null)
  const [proposition, setProposition] = useState<Proposition | null>(null)
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')

  function telecharger(): void {
    const maintenant = new Date()
    const contenu = creerSauvegarde(etat, maintenant)
    const lien = document.createElement('a')
    const adresse = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
    lien.href = adresse
    lien.download = nomDuFichier(maintenant)
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    setTimeout(() => URL.revokeObjectURL(adresse), 1000)
    setErreur('')
    setMessage(`Sauvegarde créée : ${nomDuFichier(maintenant)}.`)
  }

  async function lireFichier(fichier: File): Promise<void> {
    setMessage('')
    setErreur('')
    setProposition(null)
    const lecture = lireSauvegarde(await fichier.text())
    if (lecture.ok) {
      setProposition({ etat: lecture.etat, exporteLe: lecture.exporteLe })
    } else {
      setErreur(lecture.raison)
    }
  }

  return (
    <section className="carte">
      <h2>Sauvegarde et restauration</h2>
      <p>
        Tant que la synchronisation n’est pas en place, vos données n’existent{' '}
        <strong>que sur cet appareil</strong>. Une sauvegarde régulière, par exemple chaque
        vendredi, vous évite de tout perdre si l’iPad est remplacé ou réinitialisé. Elle sert aussi
        à passer vos données de l’iPad à l’iPhone ou au Mac.
      </p>
      <p className="avis avis--attention">
        Le fichier contient les données de votre équipe. Gardez-le pour vous, dans l’application{' '}
        <strong>Fichiers</strong> ou sur votre iCloud : ne l’envoyez ni par e-mail ni par
        messagerie.
      </p>

      <div className="groupe-boutons">
        <button type="button" className="bouton bouton--principal" onClick={telecharger}>
          Télécharger une sauvegarde
        </button>
        <button type="button" className="bouton" onClick={() => champFichier.current?.click()}>
          Restaurer depuis un fichier…
        </button>
      </div>
      <input
        ref={champFichier}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Fichier de sauvegarde à restaurer"
        onChange={(evenement) => {
          const fichier = evenement.target.files?.[0]
          evenement.target.value = ''
          if (fichier !== undefined) void lireFichier(fichier)
        }}
      />

      {message !== '' && <p className="avis">{message}</p>}
      {erreur !== '' && (
        <p className="avis avis--attention" role="alert">
          {erreur}
        </p>
      )}

      {proposition !== null && (
        <div className="avis avis--attention">
          <p>
            <strong>Restaurer cette sauvegarde ?</strong> Elle date du{' '}
            {dateHeureEnTexte(proposition.exporteLe)} et contient :{' '}
            {resumerSauvegarde(proposition.etat)}.
          </p>
          <p>
            Toutes les données actuelles de cet appareil seront <strong>remplacées</strong>.
            Conseil : téléchargez d’abord une sauvegarde de l’état actuel.
          </p>
          <div className="groupe-boutons">
            <button
              type="button"
              className="bouton bouton--principal"
              onClick={() => {
                remplacer(proposition.etat)
                setProposition(null)
                setMessage('Sauvegarde restaurée.')
              }}
            >
              Oui, restaurer
            </button>
            <button type="button" className="bouton" onClick={() => setProposition(null)}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
