import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Planning } from '../ecrans/Planning'

/** Donnees FICTIVES uniquement. */

function afficher() {
  return render(
    <DonneesProvider>
      <Planning />
    </DonneesProvider>,
  )
}

function placerUneVacation(): void {
  const jour = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement
  fireEvent.click(jour)
  fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
}

function publier(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Soumis' }))
  fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Soumis »/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Validé' }))
  fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Validé »/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Publié à l’équipe' }))
  fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Publié à l’équipe »/ }))
}

function document_(): HTMLElement {
  const element = screen.getByText(/Service Frais — du/).closest('.document')
  if (element === null) throw new Error('Document introuvable.')
  return element as HTMLElement
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('conditions d’impression', () => {
  it('autorise le dossier à présenter dès le brouillon', () => {
    afficher()
    expect(screen.getByRole('button', { name: /Dossier à présenter/ })).toBeEnabled()
  })

  it('interdit l’affichage équipe tant que le planning n’est pas publié', () => {
    afficher()
    expect(screen.getByRole('button', { name: /Affichage équipe/ })).toBeDisabled()
    expect(screen.getByText(/seule protection contre la diffusion/)).toBeInTheDocument()
  })

  it('autorise l’affichage équipe une fois publié', () => {
    afficher()
    placerUneVacation()
    publier()
    expect(screen.getByRole('button', { name: /Affichage équipe/ })).toBeEnabled()
  })
})

describe('contenu du dossier à présenter', () => {
  beforeEach(() => {
    afficher()
    placerUneVacation()
    fireEvent.click(screen.getByRole('button', { name: /Dossier à présenter/ }))
  })

  it('porte un en-tête neutre : service, période, date d’édition, version', () => {
    const doc = document_()
    expect(within(doc).getByText('Planning prévisionnel')).toBeInTheDocument()
    expect(within(doc).getByText(/Service Frais — du/)).toBeInTheDocument()
    expect(within(doc).getByText(/Édité le .* · version 1/)).toBeInTheDocument()
  })

  it('montre le planning et les horaires', () => {
    const doc = document_()
    expect(within(doc).getByText('Camille D.')).toBeInTheDocument()
    expect(within(doc).getByText(/05:30/)).toBeInTheDocument()
  })

  it('montre les indicateurs utiles au patron', () => {
    const doc = document_()
    expect(within(doc).getByText('Effectifs et couverture')).toBeInTheDocument()
    expect(within(doc).getByText('Heures nécessaires')).toBeInTheDocument()
    expect(within(doc).getByText('Budget')).toBeInTheDocument()
  })

  it('ne porte AUCUN statut de suivi', () => {
    const doc = document_()
    for (const interdit of ['Brouillon', 'Soumis', 'Validé', 'À corriger', 'Publié à l’équipe']) {
      expect(within(doc).queryByText(new RegExp(interdit))).not.toBeInTheDocument()
    }
  })

  it('ne porte NI historique NI remarques du patron', () => {
    const doc = document_()
    expect(within(doc).queryByText(/Historique/)).not.toBeInTheDocument()
    expect(within(doc).queryByText(/Remarques/)).not.toBeInTheDocument()
    expect(within(doc).queryByText(/Suivi/)).not.toBeInTheDocument()
  })

  it('ne laisse filtrer aucune remarque déjà saisie', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Soumis' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Soumis »/ }))
    fireEvent.click(screen.getByRole('button', { name: 'À corriger' }))
    fireEvent.change(screen.getByLabelText(/Remarques du patron/), {
      target: { value: 'Revoir le samedi matin.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « À corriger »/ }))

    expect(within(document_()).queryByText(/Revoir le samedi matin/)).not.toBeInTheDocument()
    // La remarque reste bien visible dans l’application.
    expect(screen.getByText(/Revoir le samedi matin/)).toBeInTheDocument()
  })

  it('ne porte aucun message technique ni réglage', () => {
    const texte = document_().textContent ?? ''
    expect(texte).not.toMatch(/tolérance|coefficient|bloc|undefined|NaN/i)
  })
})

describe('contenu de l’affichage équipe', () => {
  beforeEach(() => {
    afficher()
    placerUneVacation()
    publier()
    fireEvent.click(screen.getByRole('button', { name: /Affichage équipe/ }))
  })

  it('porte un titre adapté aux salariés', () => {
    expect(within(document_()).getByText('Planning de la semaine')).toBeInTheDocument()
  })

  it('montre le planning et les horaires', () => {
    const doc = document_()
    expect(within(doc).getByText('Camille D.')).toBeInTheDocument()
    expect(within(doc).getByText(/05:30/)).toBeInTheDocument()
  })

  it('ne montre PAS les indicateurs, réservés au patron', () => {
    const doc = document_()
    expect(within(doc).queryByText('Effectifs et couverture')).not.toBeInTheDocument()
    expect(within(doc).queryByText('Budget')).not.toBeInTheDocument()
  })

  it('ne porte aucun statut, même une fois publié', () => {
    const texte = document_().textContent ?? ''
    expect(texte).not.toMatch(/Publié à l’équipe|Brouillon|Soumis/)
  })
})
