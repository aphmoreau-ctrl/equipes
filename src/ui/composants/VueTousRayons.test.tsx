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

function section(): HTMLElement {
  const element = screen.getByRole('heading', { name: 'Tous les rayons' }).parentElement
  if (element === null) throw new Error('Vue tous rayons introuvable.')
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('vue tous rayons', () => {
  it('donne une ligne par rayon, plus le total du service', () => {
    afficher()
    const vue = section()
    expect(within(vue).getByRole('row', { name: /^Fruits et légumes/ })).toBeInTheDocument()
    expect(within(vue).getByRole('row', { name: /^Drive/ })).toBeInTheDocument()
    expect(within(vue).getByRole('row', { name: /^Total du service/ })).toBeInTheDocument()
  })

  it('affiche la couverture en pourcentage', () => {
    afficher()
    expect(within(section()).getAllByText(/^\d+ %$/).length).toBeGreaterThan(0)
  })

  it('compare les heures prévues au budget', () => {
    afficher()
    const ligne = within(section()).getByRole('row', { name: /^Fruits et légumes/ })
    // Planning vide : zéro heure prévue, donc tout l'écart au budget.
    expect(within(ligne).getByText('0,0 h')).toBeInTheDocument()
    expect(within(ligne).getByText('180 h')).toBeInTheDocument()
  })

  it('dit quand personne n’est prêté', () => {
    afficher()
    expect(
      within(section()).getByText(/Personne ne travaille hors de son rayon/),
    ).toBeInTheDocument()
  })

  it('signale un prêt dès qu’il y en a un', () => {
    afficher()
    // Camille D. tient les fruits et légumes : on la place en crèmerie.
    // La vacation prend le rayon choisi dans le filtre.
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: 'cremerie' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))

    const vue = section()
    expect(within(vue).getByText(/Camille D\./)).toBeInTheDocument()
    expect(within(vue).getByText(/depuis Fruits et légumes vers Crèmerie/)).toBeInTheDocument()
  })
})
