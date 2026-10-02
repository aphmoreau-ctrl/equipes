import { useState } from 'react'
import { useDonnees } from '../../DonneesProvider'
import { ChampTexte, Depliant, Interrupteur } from '../../composants/Champ'
import { rayonsActifs } from '../../../domaine/magasin'
import type { Competence } from '../../../domaine/competence'

/**
 * Reglage du catalogue des competences.
 *
 * Renommer une competence la renomme PARTOUT a la fois : dans les taches qui
 * l'exigent et dans les fiches qui la possedent. Sans cela, un simple
 * changement de nom couperait silencieusement le lien entre les deux.
 */
export function SectionCompetences() {
  const { etat, modifier } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)
  const [nouvelle, setNouvelle] = useState('')

  function changer(identifiant: string, changement: Partial<Competence>): void {
    modifier((precedent) => ({
      ...precedent,
      competences: precedent.competences.map((competence) =>
        competence.id === identifiant ? { ...competence, ...changement } : competence,
      ),
    }))
  }

  /** Renomme partout : catalogue, taches exigeantes et fiches. */
  function renommer(identifiant: string, nom: string): void {
    const propre = nom.trim()
    modifier((precedent) => {
      const ancien = precedent.competences.find((c) => c.id === identifiant)?.nom
      if (ancien === undefined || propre === '' || propre === ancien) {
        return {
          ...precedent,
          competences: precedent.competences.map((c) =>
            c.id === identifiant ? { ...c, nom } : c,
          ),
        }
      }

      return {
        ...precedent,
        competences: precedent.competences.map((c) =>
          c.id === identifiant ? { ...c, id: propre, nom: propre } : c,
        ),
        configurations: precedent.configurations.map((configuration) => ({
          ...configuration,
          blocs: configuration.blocs.map((bloc) => ({
            ...bloc,
            competences: bloc.competences.map((exigence) =>
              exigence.competence === ancien ? { ...exigence, competence: propre } : exigence,
            ),
          })),
        })),
        collaborateurs: precedent.collaborateurs.map((collaborateur) => {
          const niveau = collaborateur.competences[ancien]
          if (niveau === undefined) return collaborateur
          const reste = { ...collaborateur.competences }
          delete reste[ancien]
          return { ...collaborateur, competences: { ...reste, [propre]: niveau } }
        }),
      }
    })
  }

  function ajouter(): void {
    const nom = nouvelle.trim()
    if (nom === '') return
    if (etat.competences.some((competence) => competence.nom === nom)) return
    modifier((precedent) => ({
      ...precedent,
      competences: [...precedent.competences, { id: nom, nom, rayons: [], actif: true }],
    }))
    setNouvelle('')
  }

  /** Nombre de taches qui exigent cette competence : on ne supprime pas a l'aveugle. */
  function tachesQuiExigent(nom: string): number {
    return etat.configurations.reduce(
      (somme, configuration) =>
        somme +
        configuration.blocs.filter((bloc) =>
          bloc.competences.some((exigence) => exigence.competence === nom),
        ).length,
      0,
    )
  }

  function personnesQuiLOnt(nom: string): number {
    return etat.collaborateurs.filter((c) => (c.competences[nom] ?? 0) > 0).length
  }

  return (
    <section className="carte">
      <h2>Compétences</h2>
      <p>
        La liste des savoir-faire du service. Chaque tâche en exige une, avec un niveau minimum ;
        chaque fiche enregistre le niveau atteint. Une compétence sans rayon sert partout.
      </p>

      {etat.competences.map((competence) => (
        <Depliant
          key={competence.id}
          titre={competence.nom}
          resume={
            competence.rayons.length === 0
              ? `Tous les rayons · ${tachesQuiExigent(competence.nom)} tâche${tachesQuiExigent(competence.nom) > 1 ? 's' : ''}`
              : `${competence.rayons.length} rayon${competence.rayons.length > 1 ? 's' : ''} · ${tachesQuiExigent(competence.nom)} tâche${tachesQuiExigent(competence.nom) > 1 ? 's' : ''}`
          }
        >
          <ChampTexte
            libelle="Nom"
            valeur={competence.nom}
            aide="Renommer ici la renomme aussi dans les tâches et dans les fiches."
            onChange={(nom) => renommer(competence.id, nom)}
          />

          <p className="champ__libelle">Rayons où elle sert</p>
          <p className="champ__aide">Aucun rayon coché : la compétence sert partout.</p>
          <div className="groupe-boutons">
            {rayons.map((rayon) => (
              <Interrupteur
                key={rayon.id}
                libelle={rayon.nom}
                actif={competence.rayons.includes(rayon.id)}
                onChange={(actif) =>
                  changer(competence.id, {
                    rayons: actif
                      ? [...competence.rayons, rayon.id]
                      : competence.rayons.filter((id) => id !== rayon.id),
                  })
                }
              />
            ))}
          </div>

          <p className="champ__libelle">Utilisation</p>
          <p className="champ__aide">
            {tachesQuiExigent(competence.nom)} tâche
            {tachesQuiExigent(competence.nom) > 1 ? 's' : ''} l’exige
            {tachesQuiExigent(competence.nom) > 1 ? 'nt' : ''} · {personnesQuiLOnt(competence.nom)}{' '}
            personne{personnesQuiLOnt(competence.nom) > 1 ? 's' : ''} la possède
            {personnesQuiLOnt(competence.nom) > 1 ? 'nt' : ''}.
          </p>

          <Interrupteur
            libelle={competence.actif ? 'Active' : 'Désactivée'}
            actif={competence.actif}
            onChange={(actif) => changer(competence.id, { actif })}
          />
          <p className="champ__aide">
            Désactiver une compétence la retire des listes sans rien effacer : les tâches qui
            l’exigent et les niveaux déjà notés restent intacts.
          </p>
        </Depliant>
      ))}

      <div className="champs">
        <ChampTexte
          libelle="Nouvelle compétence"
          valeur={nouvelle}
          etroit
          placeholder="découpe fine"
          onChange={setNouvelle}
        />
        <button
          type="button"
          className="bouton"
          disabled={nouvelle.trim() === ''}
          onClick={ajouter}
        >
          Ajouter
        </button>
      </div>
    </section>
  )
}
