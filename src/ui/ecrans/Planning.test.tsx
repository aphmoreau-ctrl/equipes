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
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Rayon' })).getByRole('button', { name: 'Boucherie' }),
    )
    expect(within(grille()).getByText('Thierry M.')).toBeInTheDocument()
    expect(within(grille()).queryByText('Julien S.')).not.toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: 'Contrôle de la semaine' })).toBeInTheDocument()
    // Sept jours d'affilee : interdit en soi (L3132-1), constat ferme.
    // Le constat apparait dans le controle des regles ET dans les controles
    // avant validation : les deux disent la meme chose, a deux endroits.
    expect(screen.getAllByText(/7 jours travaillés dans la semaine/).length).toBeGreaterThan(0)
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
    // 05:30 a 12:30 : 7 h planifiees, pauses payees comprises (D-125), pour
    // un contrat de 35 h ; dont 6 h 40 de travail effectif.
    const grille = screen.getByRole('heading', { name: 'Grille de la semaine' })
      .parentElement as HTMLElement
    expect(within(grille).getByText('7,00 h')).toBeInTheDocument()
    expect(within(grille).getAllByText('−28,0').length).toBeGreaterThan(0)
    expect(within(grille).getByText('dont 6,67 h de travail')).toBeInTheDocument()
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
    expect(screen.getAllByText('Couverture').length).toBeGreaterThan(0)
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

describe('pauses et absences dans le planning', () => {
  it('affiche la pause de chaque poste', () => {
    afficher()
    fireEvent.click(screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
    expect(within(grille()).getAllByText('Pause 09:00 (20 min)').length).toBeGreaterThan(0)
  })

  it('propose de recalculer quand un congé tombe sur un jour déjà planifié', async () => {
    const { enregistrerEtat } = await import('../../donnees/etat')
    const { planningVide } = await import('../../domaine/planning')
    const semaine = lundiDeLaSemaine(aujourdhui())
    const base = etatInitial()
    const camille = base.collaborateurs.find((c) => c.prenom === 'Camille')!
    enregistrerEtat({
      ...base,
      absences: [
        { id: 'cp', collaborateurId: camille.id, debut: semaine, fin: semaine, type: 'conge-paye', prevue: true },
      ],
      plannings: {
        [semaine]: {
          ...planningVide(semaine),
          vacations: [
            {
              id: 'v1',
              collaborateurId: camille.id,
              rayonId: camille.rayonPrincipal,
              jour: semaine,
              debut: '06:00',
              fin: '13:00',
              pauseMinutes: 20,
              pauseDebut: '09:00',
            },
          ],
        },
      },
    })
    afficher()
    expect(screen.getByText(/Congé ou absence saisi depuis ce planning/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recalculer la semaine' })).toBeInTheDocument()
  })
})

describe('postes hors des horaires du rayon', () => {
  it('les repère et les retire d’un geste', async () => {
    const { enregistrerEtat, lireEtat } = await import('../../donnees/etat')
    const { planningVide } = await import('../../domaine/planning')
    const { construireEtatReel } = await import('../../donnees/import-equipe')
    const { RAYON } = await import('../../donnees/modele-la-vaugine')
    const semaine = lundiDeLaSemaine(aujourdhui())
    // Equipe FICTIVE.
    const base = construireEtatReel([
      { prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
    ])
    const abel = base.collaborateurs[0]!
    enregistrerEtat({
      ...base,
      plannings: {
        [semaine]: {
          ...planningVide(semaine),
          vacations: [
            { id: 'tard', collaborateurId: abel.id, rayonId: RAYON.maree, jour: semaine, debut: '19:30', fin: '22:30', pauseMinutes: 0 },
            { id: 'ok', collaborateurId: abel.id, rayonId: RAYON.maree, jour: ajouterJoursLocal(semaine, 1), debut: '07:00', fin: '14:00', pauseMinutes: 21, pauseDebut: '10:00' },
          ],
        },
      },
    })
    afficher()
    expect(screen.getByText(/1 poste hors des horaires/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retirer ces postes' }))
    expect(lireEtat().plannings[semaine]?.vacations.map((v) => v.id)).toEqual(['ok'])
  })
})

function ajouterJoursLocal(date: string, jours: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

describe('cases verrouillées', () => {
  it('annonce les cases verrouillées et les déverrouille toutes d’un geste', () => {
    afficher()
    fireEvent.click(screen.getAllByRole('button', { name: /^Camille D\., lundi/ })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /^Matin/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /^Verrouiller Camille D\., lundi/ })[0] as HTMLElement)
    expect(screen.getByText(/elle ne sera pas recalculée/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tout déverrouiller' }))
    expect(screen.queryByRole('button', { name: 'Tout déverrouiller' })).not.toBeInTheDocument()
  })
})

describe('vue par rayon', () => {
  async function preparer() {
    const { enregistrerEtat } = await import('../../donnees/etat')
    const { planningVide } = await import('../../domaine/planning')
    const { construireEtatReel } = await import('../../donnees/import-equipe')
    const { RAYON } = await import('../../donnees/modele-la-vaugine')
    const semaine = lundiDeLaSemaine(aujourdhui())
    const mardi = ajouterJoursLocal(semaine, 1)
    // Equipe FICTIVE.
    const base = construireEtatReel([
      { prenom: 'Abel', statut: 'employe', heures: 36.75, principaux: [RAYON.maree] },
      { prenom: 'Bérénice', statut: 'employe', heures: 36.75, principaux: [RAYON.charcuterieFromage], secondaires: [RAYON.maree] },
    ])
    const [abel, berenice] = base.collaborateurs as [typeof base.collaborateurs[0], typeof base.collaborateurs[0]]
    enregistrerEtat({
      ...base,
      plannings: {
        [semaine]: {
          ...planningVide(semaine),
          vacations: [
            { id: 'a', collaborateurId: abel.id, rayonId: RAYON.maree, jour: semaine, debut: '07:00', fin: '14:00', pauseMinutes: 21, pauseDebut: '10:00' },
            { id: 'b', collaborateurId: berenice.id, rayonId: RAYON.maree, jour: semaine, debut: '14:00', fin: '20:00', pauseMinutes: 18, pauseDebut: '16:00' },
            { id: 'c', collaborateurId: berenice.id, rayonId: RAYON.charcuterieFromage, jour: mardi, debut: '07:00', fin: '14:00', pauseMinutes: 21, pauseDebut: '10:00' },
          ],
        },
      },
    })
  }

  function choisirMaree() {
    fireEvent.click(within(screen.getByRole('group', { name: 'Rayon' })).getByRole('button', { name: 'Marée' }))
  }

  it('montre les titulaires, puis les renforts avec leur seul travail dans le rayon', async () => {
    await preparer()
    afficher()
    choisirMaree()
    const g = grille()
    expect(within(g).getByText('Abel')).toBeInTheDocument()
    expect(within(g).getByText('Renforts venus d’autres rayons')).toBeInTheDocument()
    expect(within(g).getByText(/renfort · titulaire Charcuterie \/ Fromage/)).toBeInTheDocument()
    expect(within(g).getByText('ailleurs (Charcuterie / Fromage)')).toBeInTheDocument()
    expect(within(g).getByText('14:00–20:00')).toBeInTheDocument()
    expect(within(g).queryByText('07:00–14:00', { selector: '.case__vacation--renfort *' })).toBeNull()
  })

  it('affiche la couverture heure par heure, avec le détail au toucher', async () => {
    await preparer()
    afficher()
    choisirMaree()
    expect(screen.getByRole('heading', { name: 'Couverture heure par heure' })).toBeInTheDocument()
    const case10h = screen.getByRole('button', { name: /^lundi 10 h : / })
    fireEvent.click(case10h)
    expect(screen.getByText(/10:00 : 0 présent, minimum 1, cible 1 — en pause : Abel/)).toBeInTheDocument()
  })

  it('contrôle la semaine : une alerte s’accepte, la case s’ouvre', async () => {
    await preparer()
    afficher()
    choisirMaree()
    const controle = screen.getByRole('heading', { name: 'Contrôle de la semaine' }).parentElement as HTMLElement
    expect(
      within(controle).getAllByText(/^Abel — /, { selector: '.controle-semaine__libelle' }).length,
    ).toBeGreaterThan(0)
    const avant = within(controle).getAllByRole('button', { name: 'Accepter pour cette semaine' }).length
    fireEvent.click(within(controle).getAllByRole('button', { name: 'Accepter pour cette semaine' })[0] as HTMLElement)
    expect(within(controle).getAllByRole('button', { name: 'Accepter pour cette semaine' }).length).toBe(avant - 1)
    expect(within(controle).getByText('Alertes acceptées pour cette semaine')).toBeInTheDocument()
  })

  it('se souvient du dernier rayon choisi', async () => {
    await preparer()
    const premier = afficher()
    choisirMaree()
    premier.unmount()
    afficher()
    expect(
      within(screen.getByRole('group', { name: 'Rayon' })).getByRole('button', { name: 'Marée' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
