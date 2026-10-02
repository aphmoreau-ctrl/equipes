import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { lundiDeLaSemaine } from '../../domaine/calendrier'
import { DonneesProvider } from '../DonneesProvider'
import { Aujourdhui } from './Aujourdhui'
import { etatInitial } from '../../donnees/etat'

/** Donnees FICTIVES uniquement. */

const JOUR = '2026-11-02' // un lundi

/** Prepare un planning contenant une vacation pour Camille D. ce lundi. */
function preparerPlanning(): void {
  const semaine = lundiDeLaSemaine(JOUR)
  const etat = {
    ...etatInitial(),
    demonstration: false,
    plannings: {
      [semaine]: {
        semaine,
        etat: 'brouillon' as const,
        historique: [],
        version: 1,
        vacations: [
          {
            id: 'v1',
            collaborateurId: 'c-01',
            rayonId: 'fruits-legumes',
            jour: JOUR,
            debut: '05:30',
            fin: '12:30',
            pauseMinutes: 20,
          },
        ],
      },
    },
  }
  window.localStorage.setItem('equipes.donnees.v1', JSON.stringify(etat))
}

function afficher() {
  return render(
    <DonneesProvider>
      <Aujourdhui />
    </DonneesProvider>,
  )
}

function choisirLeJour(): void {
  fireEvent.change(screen.getByLabelText('Jour'), { target: { value: JOUR } })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('écran du jour', () => {
  it('résume la journée : présents, absents, rayons en manque', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()

    expect(screen.getByText('Présents')).toBeInTheDocument()
    expect(screen.getByText('1 personne')).toBeInTheDocument()
    expect(screen.getByText('Personne')).toBeInTheDocument()
  })

  it('liste les arrivées de la journée', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()

    const arrivees = screen.getByText('Arrivées et départs').parentElement!
    expect(within(arrivees).getByText('05:30')).toBeInTheDocument()
    expect(within(arrivees).getByText(/Camille D./)).toBeInTheDocument()
    expect(within(arrivees).getByText(/jusqu’à 12:30/)).toBeInTheDocument()
  })

  it('montre la couverture rayon par rayon', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()
    expect(screen.getByText('Couverture par rayon')).toBeInTheDocument()
    expect(screen.getAllByText('Fruits et légumes').length).toBeGreaterThan(0)
  })
})

describe('absence imprévue', () => {
  it('rappelle de ne jamais noter le motif', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()
    fireEvent.change(screen.getByLabelText('Qui est absent ?'), { target: { value: 'c-01' } })
    expect(screen.getByText(/ne regarde pas l’employeur/)).toBeInTheDocument()
  })

  it('déclare une absence et la fait apparaître', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()

    fireEvent.change(screen.getByLabelText('Qui est absent ?'), { target: { value: 'c-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Maladie' }))

    expect(screen.getAllByText(/Camille D./).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Maladie/).length).toBeGreaterThan(0)
    // La personne absente ne compte plus parmi les présents.
    expect(screen.getByText('0 personne')).toBeInTheDocument()
  })

  it('propose de remplacer la vacation découverte', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()
    fireEvent.change(screen.getByLabelText('Qui est absent ?'), { target: { value: 'c-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Maladie' }))

    expect(screen.getByText('Vacations à remplacer')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Trouver un remplaçant' }))
    expect(screen.getByText(/Remplaçants possibles/)).toBeInTheDocument()
  })

  it('classe les remplaçants et explique pourquoi les autres sont écartés', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()
    fireEvent.change(screen.getByLabelText('Qui est absent ?'), { target: { value: 'c-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Maladie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trouver un remplaçant' }))

    // Personne ne couvre a lui seul toutes les competences du rayon : les
    // renforts partiels sont proposes a part, clairement signales.
    expect(screen.getByText(/ne couvrent qu’une partie du poste/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Choisir quand même' }).length).toBeGreaterThan(0)
    expect(screen.getByText(/Pourquoi les autres sont écartés/)).toBeInTheDocument()
    expect(screen.getAllByText(/n’intervient pas dans ce rayon/).length).toBeGreaterThan(0)
  })

  it('remplace effectivement la personne dans le planning', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()
    fireEvent.change(screen.getByLabelText('Qui est absent ?'), { target: { value: 'c-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Maladie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trouver un remplaçant' }))
    fireEvent.click(screen.getAllByRole('button', { name: /^Choisir/ })[0] as HTMLElement)

    // Quelqu'un a repris la vacation : on repasse a une personne presente.
    expect(screen.getByText('1 personne')).toBeInTheDocument()
    expect(screen.queryByText('Vacations à remplacer')).not.toBeInTheDocument()
  })

  it('permet d’annuler une absence déclarée par erreur', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()
    fireEvent.change(screen.getByLabelText('Qui est absent ?'), { target: { value: 'c-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Maladie' }))
    expect(screen.getByText('0 personne')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByText('1 personne')).toBeInTheDocument()
  })

  it('propose le vivier exterieur et compte le renfort appele', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()
    fireEvent.change(screen.getByLabelText('Qui est absent ?'), { target: { value: 'c-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Maladie' }))
    fireEvent.click(screen.getByRole('button', { name: 'Trouver un remplaçant' }))

    expect(screen.getByText(/Vivier extérieur/)).toBeInTheDocument()
    // Yanis T. (fictif) travaille le lundi en fruits et legumes.
    expect(screen.getByText(/Yanis T\./)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^Appeler/ })[0] as HTMLElement)

    expect(screen.getByText('Renforts extérieurs du jour')).toBeInTheDocument()
    expect(screen.queryByText('Vacations à remplacer')).not.toBeInTheDocument()
  })

  it('ne crie pas au manque quand le planning de la semaine n’est pas fait', () => {
    // Aucun planning enregistre : c'est l'etat d'un debut de semaine, pas une anomalie.
    window.localStorage.setItem(
      'equipes.donnees.v1',
      JSON.stringify({ ...etatInitial(), demonstration: false }),
    )
    afficher()
    choisirLeJour()

    expect(screen.getByText('Planning de la semaine')).toBeInTheDocument()
    expect(screen.getByText('Pas encore fait')).toBeInTheDocument()
    expect(screen.queryByText('Rayons en manque')).not.toBeInTheDocument()
    expect(screen.getByText(/le planning qui reste à faire/)).toBeInTheDocument()
    // Aucun rayon ne doit etre affiche en rouge.
    expect(document.querySelectorAll('.verdict--mauvais')).toHaveLength(0)
  })

  it('compte de nouveau les rayons en manque dès qu’une vacation est posée', () => {
    preparerPlanning()
    afficher()
    choisirLeJour()

    expect(screen.getByText('Rayons en manque')).toBeInTheDocument()
    expect(screen.queryByText('Pas encore fait')).not.toBeInTheDocument()
  })
})
