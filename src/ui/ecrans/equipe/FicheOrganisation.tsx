import { JOURS_SEMAINE, nomDuJour, type JourSemaine } from '../../../domaine/calendrier'
import {
  LIBELLES_POSTE_DU_MATIN,
  type Collaborateur,
  type PosteDuMatin,
} from '../../../domaine/collaborateur'
import type { Rayon } from '../../../domaine/magasin'
import { LIBELLES_FONCTION, type Fonction } from '../../../domaine/organisation'
import { Interrupteur } from '../../composants/Champ'

/**
 * Partie de la fiche qui sert au planning : rangs dans les rayons, fonctions,
 * forfait, poste du matin et jours d'ecole (regles du planning v2).
 */

interface Proprietes {
  readonly collaborateur: Collaborateur
  readonly rayons: readonly Rayon[]
  readonly onModifier: (changement: Partial<Collaborateur>) => void
}

function basculer<T>(liste: readonly T[], element: T, actif: boolean): T[] {
  return actif ? [...liste.filter((e) => e !== element), element] : liste.filter((e) => e !== element)
}

export function FicheOrganisation({ collaborateur, rayons, onModifier }: Proprietes) {
  const autresPrincipaux = collaborateur.autresRayonsPrincipaux ?? []
  const depannage = collaborateur.rayonsDepannage ?? []
  const fonctions = collaborateur.fonctions ?? []
  const autres = rayons.filter((rayon) => rayon.id !== collaborateur.rayonPrincipal)
  const ecole = collaborateur.joursEcole

  return (
    <>
      <p className="champ__libelle">Autres rayons dont la personne est titulaire</p>
      <div className="groupe-boutons">
        {autres.map((rayon) => (
          <Interrupteur
            key={rayon.id}
            libelle={rayon.nom}
            actif={autresPrincipaux.includes(rayon.id)}
            onChange={(actif) =>
              onModifier({
                autresRayonsPrincipaux: basculer(autresPrincipaux, rayon.id, actif),
                // Un rayon n'a qu'un rang a la fois.
                ...(actif
                  ? {
                      rayonsSecondaires: collaborateur.rayonsSecondaires.filter((id) => id !== rayon.id),
                      rayonsDepannage: depannage.filter((id) => id !== rayon.id),
                    }
                  : {}),
              })
            }
          />
        ))}
      </div>

      <p className="champ__libelle">Dépannage uniquement (en dernier recours, peu de temps)</p>
      <div className="groupe-boutons">
        {autres.map((rayon) => (
          <Interrupteur
            key={rayon.id}
            libelle={rayon.nom}
            actif={depannage.includes(rayon.id)}
            onChange={(actif) =>
              onModifier({
                rayonsDepannage: basculer(depannage, rayon.id, actif),
                ...(actif
                  ? {
                      rayonsSecondaires: collaborateur.rayonsSecondaires.filter((id) => id !== rayon.id),
                      autresRayonsPrincipaux: autresPrincipaux.filter((id) => id !== rayon.id),
                    }
                  : {}),
              })
            }
          />
        ))}
      </div>

      <p className="champ__libelle">Fonctions</p>
      <div className="groupe-boutons">
        {(Object.keys(LIBELLES_FONCTION) as Fonction[]).map((fonction) => (
          <Interrupteur
            key={fonction}
            libelle={LIBELLES_FONCTION[fonction]}
            actif={fonctions.includes(fonction)}
            onChange={(actif) => onModifier({ fonctions: basculer(fonctions, fonction, actif) })}
          />
        ))}
        <Interrupteur
          libelle="Cadre au forfait (hors calcul d’heures)"
          actif={collaborateur.forfait === true}
          onChange={(forfait) => onModifier({ forfait })}
        />
      </div>

      <p className="champ__libelle">Poste du matin</p>
      <div className="groupe-boutons">
        {(Object.keys(LIBELLES_POSTE_DU_MATIN) as PosteDuMatin[]).map((choix) => (
          <button
            key={choix}
            type="button"
            className={
              (collaborateur.posteDuMatin ?? 'non') === choix ? 'bouton bouton--principal' : 'bouton'
            }
            aria-pressed={(collaborateur.posteDuMatin ?? 'non') === choix}
            onClick={() => onModifier({ posteDuMatin: choix })}
          >
            {LIBELLES_POSTE_DU_MATIN[choix]}
          </button>
        ))}
      </div>

      {collaborateur.contrat === 'apprenti' && (
        <>
          <p className="champ__libelle">
            Jours d’école chaque semaine{' '}
            {ecole === undefined && <span className="etiquette etiquette--verifier">à définir</span>}
          </p>
          <div className="groupe-boutons">
            {JOURS_SEMAINE.map((jour: JourSemaine) => (
              <Interrupteur
                key={jour}
                libelle={nomDuJour(jour)}
                actif={(ecole ?? []).includes(jour)}
                onChange={(actif) => onModifier({ joursEcole: basculer(ecole ?? [], jour, actif) })}
              />
            ))}
            {ecole !== undefined && ecole.length === 0 ? null : (
              <button type="button" className="bouton" onClick={() => onModifier({ joursEcole: [] })}>
                Aucun jour fixe
              </button>
            )}
          </div>
          <p className="champ__aide">
            Ces jours ne sont jamais planifiés en magasin. Les semaines entières de cours se
            saisissent plus bas, en périodes datées.
          </p>
        </>
      )}
    </>
  )
}
