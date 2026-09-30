import { useState } from 'react'
import { JOURS_SEMAINE, nomDuJour, type JourSemaine } from '../../../domaine/calendrier'
import type { Evenement, HoraireType, Magasin, Rayon } from '../../../domaine/magasin'
import { dureeEnTexte } from '../../../domaine/temps'
import { useDonnees } from '../../DonneesProvider'
import { ChampHeure, ChampNombre, ChampTexte, Depliant, Interrupteur } from '../../composants/Champ'

/** Modification du magasin : rayons, horaires, frequentation, evenements. */

function useMagasin() {
  const { etat, modifier } = useDonnees()
  const modifierMagasin = (transformation: (magasin: Magasin) => Magasin): void => {
    modifier((precedent) => ({
      ...precedent,
      magasin: transformation(precedent.magasin),
      demonstration: false,
    }))
  }
  return { magasin: etat.magasin, modifierMagasin }
}

// ------------------------------------------------------------- Rayons

export function SectionRayons() {
  const { magasin, modifierMagasin } = useMagasin()

  function modifierRayon(rayonId: string, changement: Partial<Rayon>): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      rayons: precedent.rayons.map((rayon) =>
        rayon.id === rayonId ? { ...rayon, ...changement } : rayon,
      ),
    }))
  }

  function deplacer(rayonId: string, sens: -1 | 1): void {
    modifierMagasin((precedent) => {
      const tries = [...precedent.rayons].sort((a, b) => a.ordre - b.ordre)
      const position = tries.findIndex((rayon) => rayon.id === rayonId)
      const cible = position + sens
      if (position < 0 || cible < 0 || cible >= tries.length) return precedent

      const echange = tries[position]
      const voisin = tries[cible]
      if (echange === undefined || voisin === undefined) return precedent
      tries[position] = voisin
      tries[cible] = echange

      return {
        ...precedent,
        rayons: tries.map((rayon, index) => ({ ...rayon, ordre: index + 1 })),
      }
    })
  }

  const tries = [...magasin.rayons].sort((a, b) => a.ordre - b.ordre)

  return (
    <section className="carte">
      <h2>Rayons</h2>
      <p>Renommez, activez, désactivez et réordonnez les rayons du service.</p>

      <ul className="liste-simple">
        {tries.map((rayon, index) => (
          <li key={rayon.id} className="ligne-rayon">
            <input
              type="text"
              className="champ__saisie"
              aria-label={`Nom du rayon ${rayon.nom}`}
              value={rayon.nom}
              onChange={(evenement) => modifierRayon(rayon.id, { nom: evenement.target.value })}
            />
            <div className="ligne-rayon__actions">
              <button
                type="button"
                className="bouton bouton--discret"
                aria-label={`Monter ${rayon.nom}`}
                disabled={index === 0}
                onClick={() => deplacer(rayon.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="bouton bouton--discret"
                aria-label={`Descendre ${rayon.nom}`}
                disabled={index === tries.length - 1}
                onClick={() => deplacer(rayon.id, 1)}
              >
                ↓
              </button>
              <Interrupteur
                libelle={rayon.actif ? 'Actif' : 'Inactif'}
                actif={rayon.actif}
                onChange={(actif) => modifierRayon(rayon.id, { actif })}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------- Horaires

export function SectionHoraires() {
  const { magasin, modifierMagasin } = useMagasin()

  function modifierJour(jour: JourSemaine, changement: Partial<Magasin['horaires'][JourSemaine]>): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      horaires: {
        ...precedent.horaires,
        [jour]: { ...precedent.horaires[jour], ...changement },
      },
    }))
  }

  return (
    <section className="carte">
      <h2>Horaires du magasin</h2>
      <p>Heures d’ouverture au public, jour par jour.</p>

      {JOURS_SEMAINE.map((jour) => {
        const horaires = magasin.horaires[jour]
        return (
          <div key={jour} className="ligne-horaire">
            <span className="ligne-horaire__jour">{nomDuJour(jour)}</span>
            <Interrupteur
              libelle={horaires.ouvert ? 'Ouvert' : 'Fermé'}
              actif={horaires.ouvert}
              onChange={(ouvert) => modifierJour(jour, { ouvert })}
            />
            {horaires.ouvert && (
              <div className="champs champs--serres">
                <ChampHeure
                  libelle={`Ouverture ${nomDuJour(jour)}`}
                  valeur={horaires.ouverture}
                  onChange={(ouverture) => modifierJour(jour, { ouverture })}
                />
                <ChampHeure
                  libelle={`Fermeture ${nomDuJour(jour)}`}
                  valeur={horaires.fermeture}
                  onChange={(fermeture) => modifierJour(jour, { fermeture })}
                />
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

// ------------------------------------------------------ Frequentation

export function SectionFrequentation() {
  const { magasin, modifierMagasin } = useMagasin()

  function modifierClients(jour: JourSemaine, clients: number): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      frequentation: {
        ...precedent.frequentation,
        clientsParJour: { ...precedent.frequentation.clientsParJour, [jour]: clients },
      },
    }))
  }

  const total = JOURS_SEMAINE.reduce(
    (somme, jour) => somme + magasin.frequentation.clientsParJour[jour],
    0,
  )

  return (
    <section className="carte">
      <h2>Fréquentation</h2>
      <p>
        Nombre de clients attendus chaque jour. Ces chiffres commandent le réassort et les
        comptoirs. Total de la semaine : <strong>{total.toLocaleString('fr-FR')} clients</strong>.
      </p>

      <div className="champs">
        {JOURS_SEMAINE.map((jour) => (
          <ChampNombre
            key={jour}
            libelle={nomDuJour(jour)}
            valeur={magasin.frequentation.clientsParJour[jour]}
            pas={50}
            onChange={(clients) => modifierClients(jour, clients)}
          />
        ))}
      </div>

      <p className="avis">
        La répartition des clients dans la journée (le profil horaire, par tranche de 30 minutes)
        est pour l’instant fixée dans le modèle de démonstration. Elle deviendra modifiable ici
        même, et importable depuis la caisse plus tard.
      </p>
    </section>
  )
}

// ------------------------------------------------------ Horaires types

export function SectionHorairesTypes() {
  const { magasin, modifierMagasin } = useMagasin()

  function modifierHoraire(identifiant: string, changement: Partial<HoraireType>): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      horairesTypes: precedent.horairesTypes.map((horaire) =>
        horaire.id === identifiant ? { ...horaire, ...changement } : horaire,
      ),
    }))
  }

  function ajouter(): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      horairesTypes: [
        ...precedent.horairesTypes,
        {
          id: `horaire-${Date.now()}`,
          nom: 'Nouvel horaire',
          debut: '09:00',
          fin: '16:00',
          pauseMinutes: 20,
          pauseDebut: '12:00',
        },
      ],
    }))
  }

  function retirer(identifiant: string): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      horairesTypes: precedent.horairesTypes.filter((horaire) => horaire.id !== identifiant),
    }))
  }

  return (
    <section className="carte">
      <h2>Horaires types</h2>
      <p>Les vacations habituelles, proposées à la construction du planning.</p>

      {magasin.horairesTypes.map((horaire) => (
        <Depliant
          key={horaire.id}
          titre={horaire.nom}
          resume={`${horaire.debut} – ${horaire.fin}, pause de ${horaire.pauseMinutes} min à ${horaire.pauseDebut}`}
        >
          <div className="champs">
            <ChampTexte
              libelle="Nom"
              valeur={horaire.nom}
              onChange={(nom) => modifierHoraire(horaire.id, { nom })}
            />
            <ChampHeure
              libelle="Début"
              valeur={horaire.debut}
              onChange={(debut) => modifierHoraire(horaire.id, { debut })}
            />
            <ChampHeure
              libelle="Fin"
              valeur={horaire.fin}
              onChange={(fin) => modifierHoraire(horaire.id, { fin })}
            />
            <ChampNombre
              libelle="Pause"
              suffixe="min"
              valeur={horaire.pauseMinutes}
              pas={5}
              onChange={(pauseMinutes) => modifierHoraire(horaire.id, { pauseMinutes })}
            />
            <ChampHeure
              libelle="Début de la pause"
              valeur={horaire.pauseDebut}
              onChange={(pauseDebut) => modifierHoraire(horaire.id, { pauseDebut })}
            />
          </div>
          <button type="button" className="bouton bouton--discret" onClick={() => retirer(horaire.id)}>
            Supprimer cet horaire
          </button>
        </Depliant>
      ))}

      <button type="button" className="bouton" onClick={ajouter}>
        Ajouter un horaire type
      </button>
    </section>
  )
}

// --------------------------------------------------------- Evenements

export function SectionEvenements() {
  const { magasin, modifierMagasin } = useMagasin()
  const [nom, setNom] = useState('')

  function modifierEvenement(identifiant: string, changement: Partial<Evenement>): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      evenements: precedent.evenements.map((evenement) =>
        evenement.id === identifiant ? { ...evenement, ...changement } : evenement,
      ),
    }))
  }

  function ajouter(): void {
    if (nom.trim() === '') return
    const aujourdHui = new Date().toISOString().slice(0, 10)
    modifierMagasin((precedent) => ({
      ...precedent,
      evenements: [
        ...precedent.evenements,
        {
          id: `evenement-${Date.now()}`,
          nom: nom.trim(),
          debut: aujourdHui,
          fin: aujourdHui,
          rayonsConcernes: [],
          coefficient: 1.2,
        },
      ],
    }))
    setNom('')
  }

  function retirer(identifiant: string): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      evenements: precedent.evenements.filter((evenement) => evenement.id !== identifiant),
    }))
  }

  return (
    <section className="carte">
      <h2>Calendrier des événements</h2>
      <p>
        Fêtes, catalogues promotionnels, vacances scolaires, inventaires, météo exceptionnelle.
        Chaque événement multiplie le volume de travail des rayons concernés.
      </p>

      {magasin.evenements.map((evenement) => (
        <Depliant
          key={evenement.id}
          titre={evenement.nom}
          resume={`du ${evenement.debut} au ${evenement.fin} — ×${evenement.coefficient}`}
        >
          <div className="champs">
            <ChampTexte
              libelle="Nom"
              valeur={evenement.nom}
              onChange={(valeur) => modifierEvenement(evenement.id, { nom: valeur })}
            />
            <div className="champ champ--etroit">
              <label className="champ__libelle" htmlFor={`debut-${evenement.id}`}>
                Début
              </label>
              <input
                id={`debut-${evenement.id}`}
                type="date"
                className="champ__saisie"
                value={evenement.debut}
                onChange={(e) => modifierEvenement(evenement.id, { debut: e.target.value })}
              />
            </div>
            <div className="champ champ--etroit">
              <label className="champ__libelle" htmlFor={`fin-${evenement.id}`}>
                Fin
              </label>
              <input
                id={`fin-${evenement.id}`}
                type="date"
                className="champ__saisie"
                value={evenement.fin}
                onChange={(e) => modifierEvenement(evenement.id, { fin: e.target.value })}
              />
            </div>
            <ChampNombre
              libelle="Coefficient"
              valeur={evenement.coefficient}
              pas={0.05}
              onChange={(coefficient) => modifierEvenement(evenement.id, { coefficient })}
              aide="1,2 = vingt pour cent de travail en plus"
            />
          </div>
          <button type="button" className="bouton bouton--discret" onClick={() => retirer(evenement.id)}>
            Supprimer cet événement
          </button>
        </Depliant>
      ))}

      <div className="champs">
        <ChampTexte libelle="Nouvel événement" valeur={nom} onChange={setNom} placeholder="Foire aux vins…" />
      </div>
      <button type="button" className="bouton" disabled={nom.trim() === ''} onClick={ajouter}>
        Ajouter
      </button>
    </section>
  )
}

// ------------------------------------------------------------ Budgets

export function SectionBudgets() {
  const { magasin, modifierMagasin } = useMagasin()

  function modifierBudget(rayonId: string, heures: number): void {
    modifierMagasin((precedent) => ({
      ...precedent,
      budgetHeuresParRayon: { ...precedent.budgetHeuresParRayon, [rayonId]: heures },
    }))
  }

  const total = Object.values(magasin.budgetHeuresParRayon).reduce((s, v) => s + v, 0)

  return (
    <section className="carte">
      <h2>Budget d’heures</h2>
      <p>
        Heures par semaine et par rayon. Total du service :{' '}
        <strong>{dureeEnTexte(Math.round(total * 60))}</strong> par semaine.
      </p>
      <div className="champs">
        {[...magasin.rayons]
          .sort((a, b) => a.ordre - b.ordre)
          .map((rayon) => (
            <ChampNombre
              key={rayon.id}
              libelle={rayon.nom}
              suffixe="h"
              valeur={magasin.budgetHeuresParRayon[rayon.id] ?? 0}
              pas={5}
              onChange={(heures) => modifierBudget(rayon.id, heures)}
            />
          ))}
      </div>
    </section>
  )
}
