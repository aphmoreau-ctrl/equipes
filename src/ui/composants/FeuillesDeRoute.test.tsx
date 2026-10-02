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
  const element = screen.getByRole('heading', { name: 'Feuilles de route' }).parentElement
  if (element === null) throw new Error('Section des feuilles introuvable.')
  return element
}

function placerUneVacation(): void {
  fireEvent.click(screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement)
  fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('feuilles de route dans l’écran Planning', () => {
  it('annonce qu’il n’y a personne quand le planning est vide', () => {
    afficher()
    expect(within(section()).getByText(/Personne n’est prévu ce jour-là/)).toBeInTheDocument()
  })

  it('donne à chacun ses tâches, avec l’heure et le rayon', () => {
    afficher()
    placerUneVacation()

    const feuilles = section()
    expect(within(feuilles).getByText('Camille D.')).toBeInTheDocument()
    // Au moins une tache du rayon, avec une plage horaire.
    expect(within(feuilles).getAllByText(/^\d{2}:\d{2} – \d{2}:\d{2}$/).length).toBeGreaterThan(0)
    expect(within(feuilles).getAllByText('Fruits et légumes').length).toBeGreaterThan(0)
  })

  it('change de jour sans toucher au planning', () => {
    afficher()
    placerUneVacation()
    const feuilles = section()

    fireEvent.change(within(feuilles).getByLabelText('Jour'), {
      target: { value: '2026-10-03' },
    })
    expect(within(feuilles).getByText(/Personne n’est prévu ce jour-là/)).toBeInTheDocument()
  })

  it('totalise ce qui n’a trouvé personne', () => {
    afficher()
    placerUneVacation()
    const feuilles = section()
    expect(within(feuilles).getByText(/Ce qui n’a trouvé personne/)).toBeInTheDocument()
    expect(
      within(feuilles).getAllByText(/compétence requise|déjà occupé/).length,
    ).toBeGreaterThan(0)
  })

  it('propose d’imprimer les feuilles du jour', () => {
    afficher()
    placerUneVacation()
    expect(
      within(section()).getByRole('button', { name: 'Imprimer les feuilles du jour' }),
    ).toBeInTheDocument()
  })
})
