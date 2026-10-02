import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../../DonneesProvider'
import { Equipe } from '../Equipe'

/** Donnees FICTIVES uniquement. */

function afficher() {
  return render(
    <DonneesProvider>
      <Equipe />
    </DonneesProvider>,
  )
}

function ouvrir(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'Ajouter un collaborateur' }))
  return screen.getByRole('dialog', { name: 'Nouveau collaborateur' })
}

function saisirLePrenom(fenetre: HTMLElement, prenom: string): void {
  fireEvent.change(within(fenetre).getByLabelText('Prénom'), { target: { value: prenom } })
}

function sectionFiches(): HTMLElement {
  const element = screen.getByRole('heading', { name: 'Fiches' }).parentElement
  if (element === null) throw new Error('Section des fiches introuvable.')
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('fenêtre « Nouveau collaborateur »', () => {
  it('ne crée rien tant qu’elle n’est pas ouverte, et place le curseur dans le prénom', () => {
    afficher()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const fenetre = ouvrir()
    expect(within(fenetre).getByLabelText('Prénom')).toHaveFocus()
    // Aucune fiche « Nouveau X. » n'apparait a l'ouverture.
    expect(screen.getByText(/26 personnes/)).toBeInTheDocument()
  })

  it('garde « Enregistrer » grisé tant que le prénom et le rayon manquent', () => {
    afficher()
    const fenetre = ouvrir()
    const enregistrer = within(fenetre).getByRole('button', { name: 'Enregistrer' })
    expect(enregistrer).toBeDisabled()

    saisirLePrenom(fenetre, '   ')
    expect(enregistrer).toBeDisabled()

    saisirLePrenom(fenetre, 'Noémie')
    expect(enregistrer).toBeEnabled()
  })

  it('propose un seul rayon principal et plusieurs rayons d’appui', () => {
    afficher()
    const fenetre = ouvrir()
    const principal = within(fenetre).getByRole('group', { name: 'Rayon principal' })
    const appui = within(fenetre).getByRole('group', { name: 'Rayons où il peut aider' })

    fireEvent.click(within(principal).getByRole('button', { name: 'Boucherie' }))
    expect(within(principal).getAllByRole('button', { pressed: true })).toHaveLength(1)
    // Le rayon principal disparait de la liste des rayons d'appui.
    expect(within(appui).queryByRole('button', { name: 'Boucherie' })).not.toBeInTheDocument()

    fireEvent.click(within(appui).getByRole('button', { name: 'Fruits et légumes' }))
    fireEvent.click(within(appui).getByRole('button', { name: 'Marée' }))
    expect(within(appui).getAllByRole('button', { pressed: true })).toHaveLength(2)
    // Choisir un autre rayon principal n'en laisse toujours qu'un.
    fireEvent.click(within(principal).getByRole('button', { name: 'Fromage' }))
    expect(within(principal).getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('ne demande les dates de contrat que pour les contrats à durée déterminée', () => {
    afficher()
    const fenetre = ouvrir()
    expect(within(fenetre).queryByLabelText('Fin du contrat')).not.toBeInTheDocument()

    fireEvent.click(within(fenetre).getByRole('button', { name: 'CDD' }))
    expect(within(fenetre).getByLabelText('Début du contrat')).toBeInTheDocument()
    expect(within(fenetre).getByLabelText('Fin du contrat')).toBeInTheDocument()

    fireEvent.click(within(fenetre).getByRole('button', { name: 'CDI' }))
    expect(within(fenetre).queryByLabelText('Fin du contrat')).not.toBeInTheDocument()
  })

  it('enregistre la fiche, puis propose d’en ajouter une autre', () => {
    afficher()
    const fenetre = ouvrir()
    saisirLePrenom(fenetre, 'Noémie')
    fireEvent.change(within(fenetre).getByLabelText('Initiale du nom'), { target: { value: 'T.' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer' }))

    expect(within(fenetre).getByText('Collaborateur ajouté.')).toBeInTheDocument()

    // « Ajouter un autre » rouvre un formulaire vierge.
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Ajouter un autre' }))
    expect(within(fenetre).getByLabelText('Prénom')).toHaveValue('')

    fireEvent.click(within(fenetre).getByRole('button', { name: 'Fermer la fenêtre' }))
    expect(within(sectionFiches()).getByText('Noémie T.')).toBeInTheDocument()
    expect(screen.getByText(/27 personnes/)).toBeInTheDocument()
  })

  it('retient les jours de repos fixes comme des journées non disponibles', () => {
    afficher()
    const fenetre = ouvrir()
    saisirLePrenom(fenetre, 'Noémie')
    fireEvent.change(within(fenetre).getByLabelText('Initiale du nom'), { target: { value: 'T.' } })
    fireEvent.click(within(fenetre).getByRole('button', { name: 'mercredi' }))
    fireEvent.click(within(fenetre).getByRole('button', { name: 'dimanche' }))
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Enregistrer' }))
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Fermer' }))

    const fiche = within(sectionFiches()).getByText('Noémie T.').closest('details') as HTMLElement
    fireEvent.click(within(fiche).getByText('Noémie T.'))
    // Dans la fiche, un jour non disponible est un bouton non enfonce.
    expect(within(fiche).getByRole('button', { name: 'mer' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(fiche).getByRole('button', { name: 'dim' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(fiche).getByRole('button', { name: 'lun' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('demande confirmation avant d’abandonner une saisie commencée', () => {
    afficher()
    const fenetre = ouvrir()
    saisirLePrenom(fenetre, 'Noé')

    fireEvent.click(within(fenetre).getByRole('button', { name: 'Annuler' }))
    expect(within(fenetre).getByText(/Abandonner la saisie/)).toBeInTheDocument()

    // « Continuer la saisie » rend la main sans rien perdre.
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Continuer la saisie' }))
    expect(within(fenetre).getByLabelText('Prénom')).toHaveValue('Noé')

    fireEvent.click(within(fenetre).getByRole('button', { name: 'Annuler' }))
    fireEvent.click(within(fenetre).getByRole('button', { name: 'Abandonner' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/26 personnes/)).toBeInTheDocument()
  })

  it('se referme sans rien demander si l’on n’a rien saisi', () => {
    afficher()
    ouvrir()
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('demande aussi confirmation avec Échap et en touchant à côté', () => {
    afficher()
    const premiere = ouvrir()
    saisirLePrenom(premiere, 'Noé')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(within(premiere).getByText(/Abandonner la saisie/)).toBeInTheDocument()
    fireEvent.click(within(premiere).getByRole('button', { name: 'Abandonner' }))

    const seconde = ouvrir()
    saisirLePrenom(seconde, 'Noé')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer en touchant à côté' }))
    expect(within(seconde).getByText(/Abandonner la saisie/)).toBeInTheDocument()
  })

  it('n’affiche jamais autre chose que le prénom et l’initiale', () => {
    afficher()
    const fenetre = ouvrir()
    // RGPD : aucun champ de nom complet, de naissance ni d'appreciation.
    for (const interdit of [/nom de famille/i, /naissance/i, /adresse/i, /téléphone/i]) {
      expect(within(fenetre).queryByLabelText(interdit)).not.toBeInTheDocument()
    }
    expect(within(fenetre).getByText(/Jamais le nom entier/)).toBeInTheDocument()
  })
})
