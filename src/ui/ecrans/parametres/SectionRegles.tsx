import { useDonnees } from '../../DonneesProvider'
import { ChampHeure, ChampNombre } from '../../composants/Champ'
import { REGLES_IMPLEMENTEES, type ParametresRegles } from '../../../moteurs/regles'

/**
 * Reglage des regles legales et conventionnelles (§8).
 *
 * Toutes les valeurs sont modifiables : aucune regle n'est ecrite en dur.
 * Celles qui dependent de la CONVENTION et non de la loi portent la mention
 * « a vérifier » : elles sont a confirmer avec le service paie.
 */

/** Durees saisies en heures, enregistrees en minutes. */
function enHeures(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

function AVerifier() {
  return (
    <span className="etiquette etiquette--verifier" title="À confirmer avec le service paie">
      à vérifier
    </span>
  )
}

export function SectionRegles() {
  const { etat, modifier } = useDonnees()
  const p = etat.reglesParametres

  function regler(changement: Partial<ParametresRegles>): void {
    modifier((precedent) => ({
      ...precedent,
      reglesParametres: { ...precedent.reglesParametres, ...changement },
    }))
  }

  /** Durees : saisies en heures, converties en minutes. */
  function reglerHeures(cle: keyof ParametresRegles, heures: number): void {
    regler({ [cle]: Math.round(heures * 60) } as Partial<ParametresRegles>)
  }

  return (
    <>
      <section className="carte">
        <h2>Règles légales</h2>
        <p>
          {REGLES_IMPLEMENTEES.length} règles sont contrôlées automatiquement. Ces valeurs
          viennent du Code du travail : elles ne devraient pas changer, mais elles restent
          modifiables si votre situation l’exige.
        </p>

        <div className="grille-champs">
          <ChampNombre
            libelle="Travail maximum par jour"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.dureeMaximaleQuotidienneMinutes)}
            onChange={(valeur) => reglerHeures('dureeMaximaleQuotidienneMinutes', valeur)}
          />
          <ChampNombre
            libelle="Dérogation exceptionnelle"
            suffixe="h"
            pas={0.5}
            aide="Inventaire, fête de fin d’année…"
            valeur={enHeures(p.dureeMaximaleQuotidienneDerogationMinutes)}
            onChange={(valeur) =>
              reglerHeures('dureeMaximaleQuotidienneDerogationMinutes', valeur)
            }
          />
          <ChampNombre
            libelle="Travail maximum par semaine"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.dureeMaximaleHebdomadaireMinutes)}
            onChange={(valeur) => reglerHeures('dureeMaximaleHebdomadaireMinutes', valeur)}
          />
          <ChampNombre
            libelle="Moyenne sur 12 semaines"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.dureeMoyenneMaximaleSur12SemainesMinutes)}
            onChange={(valeur) =>
              reglerHeures('dureeMoyenneMaximaleSur12SemainesMinutes', valeur)
            }
          />
          <ChampNombre
            libelle="Repos entre deux journées"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.reposQuotidienMinutes)}
            onChange={(valeur) => reglerHeures('reposQuotidienMinutes', valeur)}
          />
          <ChampNombre
            libelle="Repos hebdomadaire"
            suffixe="h"
            pas={1}
            aide="35 h : les 24 h de repos hebdomadaire plus les 11 h quotidiennes."
            valeur={enHeures(p.reposHebdomadaireMinutes)}
            onChange={(valeur) => reglerHeures('reposHebdomadaireMinutes', valeur)}
          />
          <ChampNombre
            libelle="Jours travaillés par semaine"
            pas={1}
            valeur={p.joursMaximumParSemaine}
            onChange={(valeur) => regler({ joursMaximumParSemaine: Math.round(valeur) })}
          />
          <ChampNombre
            libelle="Pause"
            suffixe="min"
            pas={5}
            valeur={p.dureeMinimaleDeLaPauseMinutes}
            onChange={(valeur) => regler({ dureeMinimaleDeLaPauseMinutes: Math.round(valeur) })}
          />
          <ChampNombre
            libelle="Pause due à partir de"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.seuilDeclenchantLaPauseMinutes)}
            onChange={(valeur) => reglerHeures('seuilDeclenchantLaPauseMinutes', valeur)}
          />
        </div>

        <h3>Travail de nuit</h3>
        <p className="champ__aide">
          La nuit au sens de la loi va de 21 h à 6 h. Les majorations, elles, suivent la
          convention : elles se règlent plus bas.
        </p>
        <div className="grille-champs">
          <ChampHeure
            libelle="La nuit commence à"
            valeur={p.nuitDebut}
            onChange={(valeur) => regler({ nuitDebut: valeur })}
          />
          <ChampHeure
            libelle="La nuit se termine à"
            valeur={p.nuitFin}
            onChange={(valeur) => regler({ nuitFin: valeur })}
          />
        </div>
      </section>

      <section className="carte">
        <h2>Moins de 18 ans</h2>
        <p>
          La loi protège différemment les moins de 16 ans et les 16-17 ans. La tranche d’âge se
          renseigne sur la fiche de la personne — jamais sa date de naissance.
        </p>

        <div className="grille-champs">
          <ChampNombre
            libelle="Travail maximum par jour"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.dureeMaximaleQuotidienneJeuneMinutes)}
            onChange={(valeur) => reglerHeures('dureeMaximaleQuotidienneJeuneMinutes', valeur)}
          />
          <ChampNombre
            libelle="Travail maximum par semaine"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.dureeMaximaleHebdomadaireJeuneMinutes)}
            onChange={(valeur) => reglerHeures('dureeMaximaleHebdomadaireJeuneMinutes', valeur)}
          />
          <ChampNombre
            libelle="Repos entre deux journées"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.reposQuotidienJeuneMinutes)}
            onChange={(valeur) => reglerHeures('reposQuotidienJeuneMinutes', valeur)}
          />
          <ChampNombre
            libelle="Repos hebdomadaire"
            suffixe="h"
            pas={1}
            aide="48 h : deux jours consécutifs."
            valeur={enHeures(p.reposHebdomadaireJeuneMinutes)}
            onChange={(valeur) => reglerHeures('reposHebdomadaireJeuneMinutes', valeur)}
          />
          <ChampNombre
            libelle="Jours travaillés par semaine"
            pas={1}
            valeur={p.joursMaximumParSemaineJeune}
            onChange={(valeur) => regler({ joursMaximumParSemaineJeune: Math.round(valeur) })}
          />
          <ChampNombre
            libelle="Pause"
            suffixe="min"
            pas={5}
            valeur={p.dureeMinimaleDeLaPauseJeuneMinutes}
            onChange={(valeur) =>
              regler({ dureeMinimaleDeLaPauseJeuneMinutes: Math.round(valeur) })
            }
          />
        </div>

        <h3>16 et 17 ans : travail interdit la nuit</h3>
        <div className="grille-champs">
          <ChampHeure
            libelle="Plus de travail à partir de"
            valeur={p.jeuneNuitDebut}
            onChange={(valeur) => regler({ jeuneNuitDebut: valeur })}
          />
          <ChampHeure
            libelle="Reprise possible à"
            valeur={p.jeuneNuitFin}
            onChange={(valeur) => regler({ jeuneNuitFin: valeur })}
          />
        </div>

        <h3>Moins de 16 ans : le travail s’arrête plus tôt</h3>
        <div className="grille-champs">
          <ChampHeure
            libelle="Plus de travail à partir de"
            valeur={p.moinsDe16NuitDebut}
            onChange={(valeur) => regler({ moinsDe16NuitDebut: valeur })}
          />
          <ChampHeure
            libelle="Reprise possible à"
            valeur={p.moinsDe16NuitFin}
            onChange={(valeur) => regler({ moinsDe16NuitFin: valeur })}
          />
        </div>

        <p className="avis">
          <strong>Apprentis.</strong> Le temps passé en centre de formation est du temps de
          travail : il est rémunéré, il compte dans la durée du travail, et l’application refuse
          de placer une vacation pendant une période de formation. Ces périodes se saisissent sur
          la fiche de l’apprenti.
        </p>
      </section>

      <section className="carte">
        <h2>Convention collective (IDCC 2216)</h2>
        <p className="avis avis--attention">
          Ces valeurs ne viennent pas de la loi mais de la <strong>convention</strong> et des
          accords du magasin. Elles portent la mention « à vérifier » tant que vous ne les avez
          pas confirmées avec le service paie.
        </p>

        <div className="grille-champs">
          <ChampNombre
            libelle="Contingent d’heures supplémentaires"
            suffixe="h par an"
            pas={10}
            valeur={p.contingentHeuresSupplementairesAnnuel}
            onChange={(valeur) =>
              regler({ contingentHeuresSupplementairesAnnuel: Math.round(valeur) })
            }
          />
          <ChampNombre
            libelle="Délai de prévenance"
            suffixe="jours ouvrés"
            pas={1}
            valeur={p.delaiDePrevenanceJoursOuvres}
            onChange={(valeur) => regler({ delaiDePrevenanceJoursOuvres: Math.round(valeur) })}
          />
        </div>

        <h3>
          Majorations <AVerifier />
        </h3>
        <div className="grille-champs">
          <ChampNombre
            libelle="Dimanche habituel"
            suffixe="%"
            pas={5}
            valeur={p.majorations.dimancheHabituelPourcent}
            onChange={(valeur) =>
              regler({ majorations: { ...p.majorations, dimancheHabituelPourcent: valeur } })
            }
          />
          <ChampNombre
            libelle="Dimanche exceptionnel"
            suffixe="%"
            pas={5}
            valeur={p.majorations.dimancheExceptionnelPourcent}
            onChange={(valeur) =>
              regler({ majorations: { ...p.majorations, dimancheExceptionnelPourcent: valeur } })
            }
          />
          <ChampNombre
            libelle="Jour férié travaillé"
            suffixe="%"
            pas={5}
            valeur={p.majorations.ferieTravaillePourcent}
            onChange={(valeur) =>
              regler({ majorations: { ...p.majorations, ferieTravaillePourcent: valeur } })
            }
          />
          <ChampNombre
            libelle="Nuit de 21 h à 22 h"
            suffixe="%"
            pas={5}
            valeur={p.majorations.nuit21a22Pourcent}
            onChange={(valeur) =>
              regler({ majorations: { ...p.majorations, nuit21a22Pourcent: valeur } })
            }
          />
          <ChampNombre
            libelle="Nuit de 22 h à 5 h"
            suffixe="%"
            pas={5}
            valeur={p.majorations.nuit22a5Pourcent}
            onChange={(valeur) =>
              regler({ majorations: { ...p.majorations, nuit22a5Pourcent: valeur } })
            }
          />
        </div>

        <h3>Temps partiel</h3>
        <div className="grille-champs">
          <ChampNombre
            libelle="Durée minimale au contrat"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.dureeMinimaleTempsPartielMinutes)}
            onChange={(valeur) => reglerHeures('dureeMinimaleTempsPartielMinutes', valeur)}
          />
          <ChampNombre
            libelle="Coupures par jour"
            pas={1}
            valeur={p.coupuresMaximumParJour}
            onChange={(valeur) => regler({ coupuresMaximumParJour: Math.round(valeur) })}
          />
          <ChampNombre
            libelle="Durée maximale d’une coupure"
            suffixe="h"
            pas={0.5}
            valeur={enHeures(p.dureeMaximaleCoupureMinutes)}
            onChange={(valeur) => reglerHeures('dureeMaximaleCoupureMinutes', valeur)}
          />
          <ChampNombre
            libelle="Heures complémentaires"
            suffixe="% du contrat"
            pas={1}
            valeur={p.plafondHeuresComplementairesPourcent}
            onChange={(valeur) =>
              regler({ plafondHeuresComplementairesPourcent: Math.round(valeur) })
            }
          />
        </div>
      </section>
    </>
  )
}
