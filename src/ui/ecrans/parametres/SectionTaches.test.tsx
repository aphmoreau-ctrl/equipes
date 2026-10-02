import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../../DonneesProvider'
import { SectionTaches } from './SectionTaches'
import { SectionCompetences } from './SectionCompetences'
import { Equipe } from '../Equipe'

/** Donnees FICTIVES uniquement. */

function afficher(contenu: React.ReactNode) {
  return render(<DonneesProvider>{contenu}</DonneesProvider>)
}

function tache(nom: string): HTMLElement {
  const element = screen.getByText(nom).closest('details')
  if (element === null) throw new Error(`Tâche « ${nom} » introuvable.`)
  fireEvent.click(within(element).getByText(nom))
  return element
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('catalogue des tâches', () => {
  it('liste les tâches du rayon choisi', () => {
    afficher(<SectionTaches />)
    expect(screen.getByText('Réception et contrôle')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: 'drive' } })
    expect(screen.getByText('Préparation des commandes')).toBeInTheDocument()
    expect(screen.queryByText('Réception et contrôle')).not.toBeInTheDocument()
  })

  it('change la fenêtre horaire d’une tâche', () => {
    afficher(<SectionTaches />)
    const carte = tache('Réception et contrôle')
    fireEvent.change(within(carte).getByLabelText('De'), { target: { value: '04:30' } })
    expect(within(carte).getByLabelText('De')).toHaveValue('04:30')
    expect(screen.getByText(/04:30–/)).toBeInTheDocument()
  })

  it('ajoute une tâche, puis la supprime', () => {
    afficher(<SectionTaches />)
    fireEvent.change(screen.getByLabelText('Nouvelle tâche'), {
      target: { value: 'Relevé des casses' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(screen.getByText('Relevé des casses')).toBeInTheDocument()

    const carte = tache('Relevé des casses')
    fireEvent.change(within(carte).getByLabelText('Durée (min)'), { target: { value: '45' } })
    expect(within(carte).getByLabelText('Durée (min)')).toHaveValue(45)

    fireEvent.click(within(carte).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(screen.queryByText('Relevé des casses')).not.toBeInTheDocument()
  })

  it('refuse d’ajouter une tâche sans nom', () => {
    afficher(<SectionTaches />)
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled()
  })

  it('exige une compétence à un niveau, puis la rend critique', () => {
    afficher(<SectionTaches />)
    const carte = tache('Réception et contrôle')

    fireEvent.click(within(carte).getByRole('button', { name: 'tri : Autonome' }))
    expect(within(carte).getByRole('button', { name: 'tri : Autonome' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(within(carte).getByRole('button', { name: 'tri : compétence critique' }))
    expect(
      within(carte).getByRole('button', { name: 'tri : compétence critique' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // Toucher de nouveau le niveau retire l'exigence.
    fireEvent.click(within(carte).getByRole('button', { name: 'tri : Autonome' }))
    expect(
      within(carte).queryByRole('button', { name: 'tri : compétence critique' }),
    ).not.toBeInTheDocument()
  })

  it('retire un jour de la semaine', () => {
    afficher(<SectionTaches />)
    const carte = tache('Réception et contrôle')
    const lundi = within(carte).getByRole('button', { name: 'lundi' })
    expect(lundi).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(lundi)
    expect(within(carte).getByRole('button', { name: 'lundi' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('désactive une tâche sans l’effacer', () => {
    afficher(<SectionTaches />)
    const carte = tache('Réception et contrôle')
    fireEvent.click(within(carte).getByRole('button', { name: 'Tâche active' }))
    expect(within(carte).getByRole('button', { name: 'Tâche désactivée' })).toBeInTheDocument()
    // Le resume du depliant le dit aussi, sans ouvrir la tache.
    expect(within(carte).getByText(/· désactivée/)).toBeInTheDocument()
  })
})

describe('catalogue des compétences', () => {
  it('ajoute une compétence', () => {
    afficher(<SectionCompetences />)
    fireEvent.change(screen.getByLabelText('Nouvelle compétence'), {
      target: { value: 'découpe fine' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(screen.getByText('découpe fine')).toBeInTheDocument()
  })

  it('n’ajoute pas deux fois le même nom', () => {
    afficher(<SectionCompetences />)
    fireEvent.change(screen.getByLabelText('Nouvelle compétence'), {
      target: { value: 'nettoyage' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(screen.getAllByText('nettoyage')).toHaveLength(1)
  })

  it('rattache une compétence à un rayon', () => {
    afficher(<SectionCompetences />)
    const carte = screen.getByText('conseil vins').closest('details') as HTMLElement
    fireEvent.click(within(carte).getByText('conseil vins'))
    expect(within(carte).getByRole('button', { name: 'Cave / vins' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(carte).getByRole('button', { name: 'Boucherie' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('désactive une compétence sans rien effacer', () => {
    afficher(<SectionCompetences />)
    const carte = screen.getByText('démarque').closest('details') as HTMLElement
    fireEvent.click(within(carte).getByText('démarque'))
    fireEvent.click(within(carte).getByRole('button', { name: 'Active' }))
    expect(within(carte).getByRole('button', { name: 'Désactivée' })).toBeInTheDocument()
  })

  it('renomme une compétence partout à la fois', () => {
    afficher(
      <>
        <SectionCompetences />
        <SectionTaches />
      </>,
    )
    const carte = screen.getAllByText('conseil vins')[0]?.closest('details') as HTMLElement
    fireEvent.click(within(carte).getByText('conseil vins'))
    fireEvent.change(within(carte).getByLabelText('Nom'), {
      target: { value: 'œnologie' },
    })

    // La tache de la cave exige desormais le nouveau nom.
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: 'cave-vins' } })
    const conseil = screen.getByText('Conseil client').closest('details') as HTMLElement
    fireEvent.click(within(conseil).getByText('Conseil client'))
    expect(within(conseil).getByText('œnologie')).toBeInTheDocument()
    expect(within(conseil).queryByText('conseil vins')).not.toBeInTheDocument()
  })

  it('suit le renommage jusque dans les fiches de l’équipe', () => {
    afficher(
      <>
        <SectionCompetences />
        <Equipe />
      </>,
    )
    const carte = screen.getAllByText('conseil vins')[0]?.closest('details') as HTMLElement
    fireEvent.click(within(carte).getByText('conseil vins'))
    fireEvent.change(within(carte).getByLabelText('Nom'), { target: { value: 'œnologie' } })

    const fiches = screen.getByRole('heading', { name: 'Fiches' }).parentElement as HTMLElement
    const victor = within(fiches).getByText('Victor M.').closest('details') as HTMLElement
    fireEvent.click(within(victor).getByText('Victor M.'))
    expect(within(victor).getByText('œnologie')).toBeInTheDocument()
    // Son niveau 3 n'a pas ete perdu au passage.
    expect(within(victor).getByRole('button', { name: 'œnologie : Sait former' })).toHaveClass(
      'bouton--principal',
    )
  })
})
