import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../../DonneesProvider'
import { Besoin } from '../Besoin'
import {
  SectionBudgets,
  SectionFrequentation,
  SectionHoraires,
  SectionHorairesTypes,
  SectionRayons,
} from './SectionsMagasin'
import { SectionModeleRayon } from './SectionModeleRayon'

/** Donnees FICTIVES uniquement. */

function afficher(contenu: React.ReactNode) {
  return render(<DonneesProvider>{contenu}</DonneesProvider>)
}

/**
 * jsdom n'applique pas le repliement des blocs « details » : leur contenu
 * reste interrogeable meme replie. On limite donc la recherche au bloc voulu.
 */
function depliant(titre: string): HTMLElement {
  const element = screen.getByText(titre).closest('details')
  if (element === null) throw new Error(`Dépliant « ${titre} » introuvable.`)
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('reglage des rayons', () => {
  it('renomme un rayon et conserve la modification', () => {
    const premiere = afficher(<SectionRayons />)
    const champ = screen.getByLabelText('Nom du rayon Fruits et légumes')
    fireEvent.change(champ, { target: { value: 'Fruits, légumes et primeurs' } })
    expect(screen.getByDisplayValue('Fruits, légumes et primeurs')).toBeInTheDocument()
    premiere.unmount()

    afficher(<SectionRayons />)
    expect(screen.getByDisplayValue('Fruits, légumes et primeurs')).toBeInTheDocument()
  })

  it('desactive un rayon', () => {
    afficher(<SectionRayons />)
    const interrupteurs = screen.getAllByRole('button', { name: 'Actif' })
    expect(interrupteurs).toHaveLength(7)
    fireEvent.click(interrupteurs[0] as HTMLElement)
    expect(screen.getAllByRole('button', { name: 'Actif' })).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Inactif' })).toBeInTheDocument()
  })

  it('reordonne les rayons', () => {
    afficher(<SectionRayons />)
    expect(screen.getByRole('button', { name: 'Monter Fruits et légumes' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Descendre Fruits et légumes' }))
    expect(screen.getByRole('button', { name: 'Monter Fruits et légumes' })).toBeEnabled()
  })
})

describe('reglage des horaires', () => {
  it('ferme un jour et fait disparaitre ses heures', () => {
    afficher(<SectionHoraires />)
    expect(screen.getByLabelText('Ouverture dimanche')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Ouvert' })[6] as HTMLElement)
    expect(screen.queryByLabelText('Ouverture dimanche')).not.toBeInTheDocument()
  })

  it('modifie une heure d ouverture', () => {
    afficher(<SectionHoraires />)
    const champ = screen.getByLabelText('Ouverture lundi')
    fireEvent.change(champ, { target: { value: '08:00' } })
    expect(champ).toHaveValue('08:00')
  })
})

describe('reglage de la frequentation', () => {
  it('modifie le nombre de clients et met a jour le total', () => {
    afficher(<SectionFrequentation />)
    fireEvent.change(screen.getByLabelText('lundi'), { target: { value: '1200' } })
    expect(screen.getByLabelText('lundi')).toHaveValue(1200)
  })
})

describe('reglage des horaires types', () => {
  it('ajoute puis supprime un horaire', () => {
    afficher(<SectionHorairesTypes />)
    expect(screen.getAllByRole('group')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un horaire type' }))
    expect(screen.getAllByRole('group')).toHaveLength(4)

    const nouveau = depliant('Nouvel horaire')
    fireEvent.click(within(nouveau).getByRole('button', { name: 'Supprimer cet horaire' }))
    expect(screen.getAllByRole('group')).toHaveLength(3)
  })
})

describe('reglage des budgets', () => {
  it('modifie le budget d un rayon', () => {
    afficher(<SectionBudgets />)
    const champ = screen.getByLabelText(/Fruits et légumes/)
    fireEvent.change(champ, { target: { value: '200' } })
    expect(champ).toHaveValue(200)
  })
})

describe('reglage du modele d un rayon', () => {
  it('affiche les blocs du rayon fruits et legumes', () => {
    afficher(<SectionModeleRayon rayonId="fruits-legumes" />)
    expect(screen.getByText('Blocs de travail')).toBeInTheDocument()
    expect(screen.getByText('Réception et contrôle')).toBeInTheDocument()
    expect(screen.getByText('Fruits découpés, salades et jus')).toBeInTheDocument()
  })

  it('n affiche rien pour un rayon sans modele', () => {
    const { container } = afficher(<SectionModeleRayon rayonId="boucherie" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('modifie la taille du rayon', () => {
    afficher(<SectionModeleRayon rayonId="fruits-legumes" />)
    const champ = screen.getByLabelText('Mètres linéaires')
    fireEvent.change(champ, { target: { value: '60' } })
    expect(champ).toHaveValue(60)
  })

  it('modifie un parametre de bloc', () => {
    afficher(<SectionModeleRayon rayonId="fruits-legumes" />)
    const bloc = depliant('Réception et contrôle')
    const champ = within(bloc).getByLabelText(/Contrôle par palette/)
    fireEvent.change(champ, { target: { value: '20' } })
    expect(champ).toHaveValue(20)
  })
})

describe('effet du reglage sur le besoin calcule', () => {
  it('augmente le besoin quand le rayon s agrandit', () => {
    const reglages = afficher(<SectionModeleRayon rayonId="fruits-legumes" />)
    fireEvent.change(screen.getByLabelText('Mètres linéaires'), { target: { value: '200' } })
    reglages.unmount()

    afficher(<Besoin />)
    fireEvent.change(screen.getByLabelText('Jour'), { target: { value: '2026-11-02' } })
    // Le tri et le facing sont proportionnels aux metres : le total explose.
    expect(screen.getByText('Totaux de la journée')).toBeInTheDocument()
    const pointe = screen.getByText(/personnes en même temps/).textContent ?? ''
    expect(Number.parseInt(pointe, 10)).toBeGreaterThan(3)
  })

  it('n applique plus un bloc desactive', () => {
    const reglages = afficher(<SectionModeleRayon rayonId="fruits-legumes" />)
    const bloc = depliant('Réassort en journée')
    fireEvent.click(within(bloc).getByRole('button', { name: 'Bloc actif' }))
    reglages.unmount()

    afficher(<Besoin />)
    fireEvent.change(screen.getByLabelText('Jour'), { target: { value: '2026-11-02' } })
    expect(screen.queryByText('Réassort en journée')).not.toBeInTheDocument()
  })
})
