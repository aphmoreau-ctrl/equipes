import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { aujourdhui, lundiDeLaSemaine } from '../../domaine/calendrier'
import { etatInitial } from '../../donnees/etat'
import { DonneesProvider } from '../DonneesProvider'
import { Planning } from './Planning'

/** Donnees FICTIVES uniquement. */

/**
 * La grille du planning seule : les boutons d'horaire affichent les memes
 * heures, et le tableau des scenarios est aussi un « table ».
 */
function grille(): HTMLElement {
  const element = document.querySelector('table.grille:not(.grille--compacte)')
  if (element === null) throw new Error('Grille du planning introuvable.')
  return element as HTMLElement
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
    expect(screen.getByText('6,7 h')).toBeInTheDocument()
    expect(screen.getByText('−28,3')).toBeInTheDocument()
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


describe('proposition automatique', () => {
  it('propose un planning qui ne viole aucune règle', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))

    expect(screen.getByText('Vacations placées')).toBeInTheDocument()
    expect(within(grille()).getAllByText(/\d\d:\d\d–\d\d:\d\d/).length).toBeGreaterThan(5)
    expect(screen.getByText('Aucune règle enfreinte')).toBeInTheDocument()
  })

  it('demande confirmation avant d’écraser un planning existant', () => {
    afficher()
    // Une vacation saisie a la main.
    const jour = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement
    fireEvent.click(jour)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    expect(screen.getByText(/remplacera/)).toBeInTheDocument()
    // Rien n'a encore ete genere.
    expect(screen.queryByText('Vacations placées')).not.toBeInTheDocument()
  })

  it('remplace le planning après confirmation', () => {
    afficher()
    const jour = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement
    fireEvent.click(jour)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    fireEvent.click(screen.getByRole('button', { name: 'Oui, remplacer' }))
    expect(screen.getByText('Vacations placées')).toBeInTheDocument()
  })

  it('explique ce qu’elle n’a pas pu couvrir', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    // L'equipe de demonstration est trop petite pour couvrir tout le besoin.
    expect(screen.getByText(/n’a pas pu couvrir/)).toBeInTheDocument()
  })

  it('conserve la proposition après rechargement', () => {
    const premiere = afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    const placees = within(grille()).getAllByText(/\d\d:\d\d–\d\d:\d\d/).length
    premiere.unmount()

    afficher()
    expect(within(grille()).getAllByText(/\d\d:\d\d–\d\d:\d\d/).length).toBe(placees)
  })
})

describe('scénarios', () => {
  it('invite d’abord à construire un planning', () => {
    afficher()
    expect(screen.getByText('Scénarios')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Enregistrer le planning actuel/ }),
    ).toBeDisabled()
  })

  it('enregistre un scénario et le compare au planning en cours', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))

    fireEvent.change(screen.getByLabelText('Nom du scénario'), {
      target: { value: 'Proposition automatique' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le planning actuel/ }))

    expect(screen.getAllByText('Proposition automatique').length).toBeGreaterThan(0)
    expect(screen.getByText('En cours')).toBeInTheDocument()
    expect(screen.getByText('Couverture')).toBeInTheDocument()
  })

  it('explique ce qui distingue un scénario du planning en cours', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le planning actuel/ }))

    // Le scenario vient d'etre copie : il est identique au planning en cours.
    expect(screen.getByText(/Identique au planning en cours/)).toBeInTheDocument()
  })

  it('prévient que retenir un scénario remplace le planning', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le planning actuel/ }))
    // Le texte est coupe par une balise : on lit le contenu de l'avertissement.
    const avertissement = [...document.querySelectorAll('.avis')].find((element) =>
      (element.textContent ?? '').includes('Retenir'),
    )
    expect(avertissement?.textContent).toContain('remplace')
    expect(avertissement?.textContent).toContain('planning de la semaine')
  })

  it('retient un scénario et remplace le planning', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le planning actuel/ }))

    const placees = within(grille()).getAllByText(/\d\d:\d\d–\d\d:\d\d/).length
    fireEvent.click(screen.getByRole('button', { name: 'Retenir ce scénario' }))
    expect(within(grille()).getAllByText(/\d\d:\d\d–\d\d:\d\d/).length).toBe(placees)
  })

  it('supprime un scénario', () => {
    afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le planning actuel/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(screen.queryByText('En cours')).not.toBeInTheDocument()
  })

  it('conserve les scénarios après rechargement', () => {
    const premiere = afficher()
    fireEvent.click(screen.getByRole('button', { name: 'Proposer un planning' }))
    fireEvent.change(screen.getByLabelText('Nom du scénario'), { target: { value: 'Version A' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le planning actuel/ }))
    premiere.unmount()

    afficher()
    expect(screen.getAllByText('Version A').length).toBeGreaterThan(0)
  })
})

describe('renforts extérieurs dans le planning', () => {
  /** Met un renfort en mission le lundi de la semaine affichée. */
  function preparerUneMission(): void {
    const base = etatInitial()
    window.localStorage.setItem(
      'equipes.donnees.v1',
      JSON.stringify({
        ...base,
        demonstration: false,
        missions: [
          {
            id: 'm-test',
            renfortId: base.renforts[0]?.id ?? 'r-01',
            date: lundiDeLaSemaine(aujourdhui()),
            rayonId: 'fruits-legumes',
            debut: '06:00',
            fin: '13:00',
            pauseMinutes: 20,
            motif: 'renfort',
            vacationCouverte: null,
          },
        ],
      }),
    )
  }

  it('n’affiche aucune ligne de renfort quand il n’y a pas de mission', () => {
    afficher()
    expect(screen.queryByText('Renforts extérieurs')).not.toBeInTheDocument()
  })

  it('affiche le renfort en mission dans la grille', () => {
    preparerUneMission()
    afficher()

    expect(screen.getByText('Renforts extérieurs')).toBeInTheDocument()
    expect(within(grille()).getAllByText('06:00–13:00').length).toBeGreaterThan(0)
  })

  it('explique que le renfort compte dans la couverture mais pas dans les règles', () => {
    preparerUneMission()
    afficher()
    expect(
      screen.getByText(/comptent dans la couverture du besoin, mais pas dans le contrôle/),
    ).toBeInTheDocument()
  })

  it('ne compte pas le renfort dans le contrôle des règles', () => {
    preparerUneMission()
    afficher()
    // Une seule mission ne peut enfreindre aucune regle : le planning reste conforme.
    expect(screen.getByText('Aucune règle enfreinte')).toBeInTheDocument()
  })

  it('fait figurer le renfort sur le document remis', () => {
    preparerUneMission()
    afficher()
    fireEvent.click(screen.getByRole('button', { name: /Dossier à présenter/ }))

    const document_ = screen.getByText(/Service Frais — du/).closest('.document')
    expect(document_?.textContent).toContain('06:00')
    expect(document_?.textContent).toMatch(/Intérimaire|Étudiant|Ancien salarié/)
  })
})

describe('verrouillage des cases', () => {
  function placerUneVacation(): void {
    fireEvent.click(screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
  }

  it('ne propose un verrou que sur une case occupée', () => {
    afficher()
    expect(screen.queryByRole('button', { name: /^Verrouiller Camille D\./ })).not.toBeInTheDocument()

    placerUneVacation()
    expect(screen.getByRole('button', { name: /^Verrouiller Camille D\., lundi/ })).toBeInTheDocument()
  })

  it('verrouille puis déverrouille une case', () => {
    afficher()
    placerUneVacation()

    fireEvent.click(screen.getByRole('button', { name: /^Verrouiller Camille D\., lundi/ }))
    expect(
      screen.getByRole('button', { name: /^Déverrouiller Camille D\., lundi/ }),
    ).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /^Déverrouiller Camille D\., lundi/ }))
    expect(screen.getByRole('button', { name: /^Verrouiller Camille D\., lundi/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('compte les cases verrouillées à côté du bouton Relancer', () => {
    afficher()
    placerUneVacation()
    expect(screen.getByText('aucune case verrouillée pour l’instant')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Verrouiller Camille D\., lundi/ }))
    expect(screen.getByText('1 case verrouillée')).toBeInTheDocument()
  })

  it('garde la vacation verrouillée après une relance', () => {
    afficher()
    placerUneVacation()
    fireEvent.click(screen.getByRole('button', { name: /^Verrouiller Camille D\., lundi/ }))

    const avant = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0]
    const horaireAvant = avant?.textContent

    fireEvent.click(
      screen.getByRole('button', { name: 'Relancer sans toucher aux cases verrouillées' }),
    )

    const apres = screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0]
    expect(apres?.textContent).toBe(horaireAvant)
  })
})
