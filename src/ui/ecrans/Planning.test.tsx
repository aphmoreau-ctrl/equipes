import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../DonneesProvider'
import { Planning } from './Planning'

/** Donnees FICTIVES uniquement. */

/** La grille seule : les boutons d'horaire affichent aussi les memes heures. */
function grille(): HTMLElement {
  return screen.getByRole('table')
}

function afficher() {
  return render(
    <DonneesProvider>
      <Planning />
    </DonneesProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('écran Planning', () => {
  it('affiche la grille de la semaine avec toute l’équipe', () => {
    afficher()
    expect(screen.getByText('Grille de la semaine')).toBeInTheDocument()
    expect(screen.getByText('Camille D.')).toBeInTheDocument()
    expect(screen.getByText('Thierry M.')).toBeInTheDocument()
  })

  it('part d’une semaine vide et parfaitement conforme', () => {
    afficher()
    expect(screen.getByText('Aucune règle enfreinte')).toBeInTheDocument()
  })

  it('change de semaine', () => {
    afficher()
    const titre = screen.getByText(/Semaine du/).textContent
    fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }))
    expect(screen.getByText(/Semaine du/).textContent).not.toBe(titre)
  })

  it('filtre l’équipe par rayon', () => {
    afficher()
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: 'boucherie' } })
    expect(screen.getByText('Thierry M.')).toBeInTheDocument()
    expect(screen.queryByText('Julien S.')).not.toBeInTheDocument()
  })

  it('place une vacation en touchant une case', () => {
    afficher()
    const jours = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })
    expect(jours.length).toBeGreaterThan(0)

    fireEvent.click(jours[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))

    expect(within(grille()).getAllByText('05:30–12:30').length).toBeGreaterThan(0)
  })

  it('retire une vacation avec le bouton Repos', () => {
    afficher()
    const jour = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement
    fireEvent.click(jour)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
    expect(within(grille()).getAllByText('05:30–12:30')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /^Repos/ }))
    expect(within(grille()).queryByText('05:30–12:30')).not.toBeInTheDocument()
  })

  it('signale immédiatement une règle enfreinte', () => {
    afficher()
    // Sept jours d'affilee : le repos hebdomadaire saute.
    for (const jour of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) {
      const cases = screen.getAllByRole('button', { name: new RegExp(`^Camille D\\., ${jour}`) })
      fireEvent.click(cases[0] as HTMLElement)
      fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
    }

    expect(screen.getByText('Contrôle des règles')).toBeInTheDocument()
    // Sept jours d'affilee : interdit en soi (L3132-1), constat ferme.
    expect(screen.getByText(/7 jours travaillés dans la semaine/)).toBeInTheDocument()
    expect(screen.queryByText('Aucune règle enfreinte')).not.toBeInTheDocument()
  })

  it('prévient quand la personne s’est déclarée indisponible', () => {
    afficher()
    // Sofia B. a declare ne pas etre disponible le mercredi.
    const cases = screen.getAllByRole('button', { name: /^Sofia B\., mercredi/ })
    fireEvent.click(cases[0] as HTMLElement)
    expect(screen.getByText(/a déclaré ne pas être disponible/)).toBeInTheDocument()
  })

  it('explique les trous de couverture', () => {
    afficher()
    expect(screen.getByRole('heading', { name: 'Couverture du besoin' })).toBeInTheDocument()
    // Sans personne placee, tout est decouvert.
    expect(screen.getAllByText(/il manque \d+ personne/).length).toBeGreaterThan(0)
  })

  it('totalise les heures et l’écart au contrat', () => {
    afficher()
    const jour = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement
    fireEvent.click(jour)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
    // 05:30 a 12:30 moins 20 min de pause = 6,7 h, pour un contrat de 35 h.
    expect(screen.getByText('6.7 h')).toBeInTheDocument()
    expect(screen.getByText('-28.3')).toBeInTheDocument()
  })
})

describe('circuit de suivi', () => {
  it('commence en brouillon', () => {
    afficher()
    expect(screen.getByText('Brouillon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Soumis' })).toBeInTheDocument()
  })

  it('rappelle que le suivi ne figure sur aucun document', () => {
    afficher()
    expect(screen.getByText(/uniquement dans l’application/)).toBeInTheDocument()
  })

  it('enregistre une soumission avec sa date', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Soumis' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Soumis »/ }))

    expect(screen.getByText('Soumis')).toBeInTheDocument()
    expect(screen.getByText('Historique')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Validé' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'À corriger' })).toBeInTheDocument()
  })

  it('note les remarques du patron et crée une nouvelle version', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Soumis' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Soumis »/ }))

    fireEvent.click(screen.getByRole('button', { name: 'À corriger' }))
    fireEvent.change(screen.getByLabelText(/Remarques du patron/), {
      target: { value: 'Revoir le samedi matin.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « À corriger »/ }))

    expect(screen.getByText(/Revoir le samedi matin/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Soumis' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Soumis »/ }))
    expect(screen.getByText('version 2')).toBeInTheDocument()
  })

  it('conserve le planning et son suivi après rechargement', () => {
    const premiere = afficher()
    const jour = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement
    fireEvent.click(jour)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Soumis' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer « Soumis »/ }))
    premiere.unmount()

    afficher()
    expect(within(grille()).getAllByText('05:30–12:30')).toHaveLength(1)
    // Ligne d'historique : « Soumis — lundi ... (version 1) »
    expect(screen.getAllByText(/^Soumis — /).length).toBeGreaterThan(0)
  })
})
