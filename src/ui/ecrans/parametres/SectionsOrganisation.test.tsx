import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DonneesProvider } from '../../DonneesProvider'
import { enregistrerEtat, lireEtat } from '../../../donnees/etat'
import { construireEtatReel } from '../../../donnees/import-equipe'
import { RAYON, ROTATION_SAMEDI_PREPARATION, TACHE } from '../../../donnees/modele-la-vaugine'
import {
  SectionEffectifs,
  SectionPointsADefinir,
  SectionReglesInternes,
  SectionRotisserie,
  SectionTachesPlanifiees,
} from './SectionsOrganisation'

/** Prenoms ENTIEREMENT FICTIFS. */
function chargerLeMagasin(): void {
  enregistrerEtat(
    construireEtatReel([
      { prenom: 'Alix', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
      {
        prenom: 'Basile',
        statut: 'manager',
        heures: 36.75,
        principaux: [RAYON.boucherieTrad],
        taches: [TACHE.emballageBoucherie],
      },
      { prenom: 'Côme', statut: 'employe', heures: 36.75, principaux: [RAYON.preparationTraiteur], rotations: [ROTATION_SAMEDI_PREPARATION] },
    ]),
  )
}

function afficher(contenu: React.ReactNode) {
  return render(<DonneesProvider>{contenu}</DonneesProvider>)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('points à définir', () => {
  it('n’apparaissent pas dans la démonstration', () => {
    afficher(<SectionPointsADefinir />)
    expect(screen.queryByRole('heading', { name: 'Points à définir' })).not.toBeInTheDocument()
  })

  it('listent ce qui manque, et la question RH se coche', () => {
    chargerLeMagasin()
    afficher(<SectionPointsADefinir />)
    expect(screen.getByText('Rôtisserie : durée d’une cuisson.')).toBeInTheDocument()
    expect(screen.getByText(/Heures d’affluence du samedi/)).toBeInTheDocument()
    const boutons = screen.getAllByRole('button', { name: 'C’est vérifié' })
    expect(boutons).toHaveLength(2)
    fireEvent.click(boutons[0] as HTMLElement)
    expect(screen.getAllByRole('button', { name: 'C’est vérifié' })).toHaveLength(1)
  })
})

describe('effectifs', () => {
  it('remplit le vendredi en copiant le jeudi, puis ajuste un minimum', () => {
    chargerLeMagasin()
    afficher(<SectionEffectifs />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: RAYON.maree } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Jour' })).getByRole('button', { name: /^vendredi/ }))
    expect(screen.getByText(/pas encore définis/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copier le jeudi' }))
    const minimums = screen.getAllByLabelText('Minimum')
    expect(minimums).toHaveLength(6)
    fireEvent.change(minimums[2] as HTMLElement, { target: { value: '2' } })

    const grille = lireEtat().configurations.find((c) => c.rayonId === RAYON.maree)?.grilleEffectifs
    expect(grille?.jours[5]?.[2]).toMatchObject({ debut: '11:00', minimum: 2, provisoire: false })
  })

  it('un champ vidé redevient « à définir »', () => {
    chargerLeMagasin()
    afficher(<SectionEffectifs />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: RAYON.fruitsLegumes } })
    fireEvent.change(screen.getAllByLabelText('Cible')[0] as HTMLElement, { target: { value: '' } })
    const grille = lireEtat().configurations.find((c) => c.rayonId === RAYON.fruitsLegumes)?.grilleEffectifs
    expect(grille?.jours[1]?.[0]?.cible).toBeNull()
  })
})

describe('tâches, rôtisserie et règles internes', () => {
  it('renseigne la durée d’une tâche', () => {
    chargerLeMagasin()
    afficher(<SectionTachesPlanifiees />)
    const bloc = screen.getByText('Emballage boucherie').closest('details') as HTMLElement
    fireEvent.change(within(bloc).getByLabelText(/Durée/), { target: { value: '90' } })
    const tache = lireEtat().organisation.taches.find((t) => t.id === TACHE.emballageBoucherie)
    expect(tache?.dureeMinutes).toBe(90)
    expect(tache?.personnesDesignees).toEqual(['c-basile'])
  })

  it('renseigne la durée de cuisson', () => {
    chargerLeMagasin()
    afficher(<SectionRotisserie />)
    fireEvent.change(screen.getByLabelText(/Durée d’une cuisson/), { target: { value: '75' } })
    expect(lireEtat().organisation.rotisserie?.dureeCuissonMinutes).toBe(75)
  })

  it('règle la présence minimale par jour', () => {
    afficher(<SectionReglesInternes />)
    fireEvent.change(screen.getByLabelText(/Présence minimale/), { target: { value: '4' } })
    expect(lireEtat().organisation.reglesInternes.presenceMinimaleParJourMinutes).toBe(240)
  })
})
