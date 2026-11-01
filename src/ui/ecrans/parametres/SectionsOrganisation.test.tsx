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
    expect(screen.getByText(/Emballage fromage/)).toBeInTheDocument()
    const boutons = screen.getAllByRole('button', { name: 'C’est vérifié' })
    expect(boutons).toHaveLength(2)
    fireEvent.click(boutons[0] as HTMLElement)
    expect(screen.getAllByRole('button', { name: 'C’est vérifié' })).toHaveLength(1)
  })
})

describe('effectifs', () => {
  it('applique les grilles du week-end proposées aux jours encore à définir', async () => {
    const { construireEtatReel } = await import('../../../donnees/import-equipe')
    const etat = construireEtatReel([{ prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] }])
    // Donnees importees avant les grilles du week-end.
    enregistrerEtat({
      ...etat,
      configurations: etat.configurations.map((c) =>
        c.rayonId === RAYON.maree
          ? { ...c, grilleEffectifs: { ...c.grilleEffectifs!, jours: { ...c.grilleEffectifs!.jours, 5: null, 6: null, 7: null } } }
          : c,
      ),
    })
    afficher(<SectionEffectifs />)
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer les grilles du week-end proposées' }))
    const grille = lireEtat().configurations.find((c) => c.rayonId === RAYON.maree)?.grilleEffectifs
    expect(grille?.jours[6]?.[2]).toMatchObject({ debut: '10:00', fin: '13:00', minimum: 2, cible: 3 })
    expect(screen.queryByRole('button', { name: 'Appliquer les grilles du week-end proposées' })).not.toBeInTheDocument()
  })

  it('remplit le vendredi en copiant le jeudi, puis ajuste un minimum', () => {
    chargerLeMagasin()
    afficher(<SectionEffectifs />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: RAYON.maree } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Jour' })).getByRole('button', { name: /^vendredi/ }))
    // Le vendredi a sa grille de depart : on la remet « a definir », puis on copie le jeudi.
    fireEvent.click(screen.getByRole('button', { name: 'Remettre « à définir »' }))
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
  it('la fiche rayon règle ses tâches : durée, plage horaire, personnes', () => {
    chargerLeMagasin()
    afficher(<SectionEffectifs />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: RAYON.boucherieLs } })
    const bloc = screen.getByText('Emballage boucherie').closest('details') as HTMLElement
    fireEvent.change(within(bloc).getByLabelText(/Durée/), { target: { value: '90' } })
    fireEvent.change(within(bloc).getByLabelText('Moment'), { target: { value: 'libre' } })
    fireEvent.click(within(bloc).getByRole('button', { name: 'Fixer la plage horaire' }))
    fireEvent.change(within(bloc).getByLabelText('Personnes à la fois'), { target: { value: '2' } })
    const tache = lireEtat().organisation.taches.find((t) => t.id === TACHE.emballageBoucherie)
    expect(tache).toMatchObject({ dureeMinutes: 90, personnes: 2, fenetre: { debut: '08:30', fin: '11:00' } })
    expect(tache?.personnesDesignees).toEqual(['c-basile'])
  })

  it('la fiche rayon règle la remballe du jour et la règle du titulaire', () => {
    chargerLeMagasin()
    afficher(<SectionEffectifs />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: RAYON.maree } })
    fireEvent.click(screen.getByRole('button', { name: 'Définir la remballe' }))
    const grille = () => lireEtat().configurations.find((c) => c.rayonId === RAYON.maree)!.grilleEffectifs!
    expect(grille().remballe?.[1]).toEqual({ debut: '19:00', dureeMinutes: 60, minimum: 1, cible: 1 })
    fireEvent.click(screen.getByRole('button', { name: 'Un titulaire à l’ouverture et à la fermeture' }))
    expect(grille().titulaireOuvertureFermeture).toBe(false)
  })

  it('ajoute une tâche au rayon', () => {
    chargerLeMagasin()
    afficher(<SectionEffectifs />)
    fireEvent.change(screen.getByLabelText('Rayon'), { target: { value: RAYON.maree } })
    fireEvent.change(screen.getByLabelText('Nouvelle tâche'), { target: { value: 'Commandes clients' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la tâche' }))
    expect(lireEtat().organisation.taches.some((t) => t.nom === 'Commandes clients' && t.rayonId === RAYON.maree)).toBe(true)
  })

  it('la section des réunions ne garde que ce qui ne dépend d’aucun rayon', () => {
    chargerLeMagasin()
    afficher(<SectionTachesPlanifiees />)
    expect(screen.getByRole('heading', { name: 'Réunions' })).toBeInTheDocument()
    expect(screen.queryByText('Emballage boucherie')).not.toBeInTheDocument()
    expect(screen.getByText('Réunion managers')).toBeInTheDocument()
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
