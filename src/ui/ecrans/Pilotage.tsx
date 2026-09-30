import { useMemo, useState } from 'react'
import { ajouterJours, aujourdhui, dateEnTexte, lundiDeLaSemaine, semaineDe } from '../../domaine/calendrier'
import { rayonsActifs } from '../../domaine/magasin'
import { contexteDeVerification, verifier } from '../../moteurs/regles'
import {
  construireLeTableauDeBord,
  proposerDesActions,
} from '../../moteurs/indicateurs/pilotage'
import { absencesEffectives } from '../../donnees/etat'
import { useDonnees } from '../DonneesProvider'
import { ChampNombre } from '../composants/Champ'
import { RapportImprimable, type TypeRapport } from '../composants/RapportImprimable'

export function Pilotage() {
  const { etat, modifier, planning, besoinDuJour, historique } = useDonnees()
  const [semaine, setSemaine] = useState(() => lundiDeLaSemaine(aujourdhui()))
  const [rapport, setRapport] = useState<TypeRapport | null>(null)

  const rayons = rayonsActifs(etat.magasin)
  const planningCourant = planning(semaine)
  const jours = useMemo(() => semaineDe(semaine), [semaine])

  const besoins = useMemo(() => {
    const resultat = []
    for (const rayon of rayons) {
      for (const jour of jours) {
        const besoin = besoinDuJour(jour, rayon.id)
        if (besoin !== null) resultat.push(besoin)
      }
    }
    return resultat
  }, [rayons, jours, besoinDuJour])

  const infractions = useMemo(
    () =>
      verifier(
        contexteDeVerification(planningCourant.vacations, etat.reglesParametres, {
          collaborateurs: etat.collaborateurs,
          vacationsAnterieures: historique(semaine),
        }),
      ),
    [planningCourant.vacations, etat.reglesParametres, etat.collaborateurs, historique, semaine],
  )

  const tableau = useMemo(
    () =>
      construireLeTableauDeBord({
        semaine,
        rayons,
        vacations: planningCourant.vacations,
        collaborateurs: etat.collaborateurs,
        absences: absencesEffectives(etat),
        besoins,
        infractions,
        budgetHeuresParRayon: etat.magasin.budgetHeuresParRayon,
        dureeLegaleHebdomadaireMinutes: etat.reglesParametres.dureeLegaleHebdomadaireMinutes,
        chiffreAffaires: etat.chiffreAffairesParSemaine[semaine] ?? null,
      }),
    [semaine, rayons, planningCourant.vacations, etat, besoins, infractions],
  )

  const actions = proposerDesActions(tableau)

  function enregistrerLeChiffreAffaires(montant: number): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      chiffreAffairesParSemaine: { ...precedent.chiffreAffairesParSemaine, [semaine]: montant },
    }))
  }

  function marquerLeRapportRemis(type: TypeRapport): void {
    modifier((precedent) => ({
      ...precedent,
      demonstration: false,
      rapportsProduits: [
        ...precedent.rapportsProduits,
        {
          id: `r-${Date.now()}`,
          type,
          periode: semaine,
          edite: aujourdhui(),
          remarques: '',
        },
      ],
    }))
  }

  function noterLesRemarques(identifiant: string, remarques: string): void {
    modifier((precedent) => ({
      ...precedent,
      rapportsProduits: precedent.rapportsProduits.map((produit) =>
        produit.id === identifiant ? { ...produit, remarques } : produit,
      ),
    }))
  }

  function retirerLeRapport(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      rapportsProduits: precedent.rapportsProduits.filter((produit) => produit.id !== identifiant),
    }))
  }

  const pourcent = (valeur: number) => `${Math.round(valeur * 100)} %`

  return (
    <>
      <header className="entete">
        <h1>Pilotage</h1>
        <p>Tableau de bord personnel et rapports PDF à remettre au patron.</p>
      </header>

      <section className="carte">
        <div className="barre-semaine">
          <button
            type="button"
            className="bouton"
            aria-label="Semaine précédente"
            onClick={() => setSemaine(ajouterJours(semaine, -7))}
          >
            ←
          </button>
          <span className="barre-semaine__titre">Semaine du {dateEnTexte(semaine)}</span>
          <button
            type="button"
            className="bouton"
            aria-label="Semaine suivante"
            onClick={() => setSemaine(ajouterJours(semaine, 7))}
          >
            →
          </button>
        </div>

        <p className="avis">
          Ce tableau de bord est <strong>personnel</strong> : votre patron n’y a pas accès. Il
          reçoit uniquement les documents PDF ci-dessous.
        </p>

        <dl className="liste-faits">
          <dt>Effectif</dt>
          <dd>{tableau.effectif} personnes</dd>

          <dt>Heures prévues</dt>
          <dd>
            {tableau.heuresPrevues.toFixed(1)} h — budget {tableau.heuresBudget} h (
            <span className={tableau.ecartAuBudget > 0 ? 'verdict verdict--mauvais' : 'verdict verdict--bon'}>
              {tableau.ecartAuBudget > 0 ? '+' : ''}
              {tableau.ecartAuBudget.toFixed(1)} h
            </span>
            )
          </dd>

          <dt>Couverture du besoin</dt>
          <dd>{pourcent(tableau.couverture)}</dd>

          <dt>Heures supplémentaires</dt>
          <dd>{tableau.heuresSupplementaires.toFixed(1)} h</dd>

          <dt>Absentéisme</dt>
          <dd>{pourcent(tableau.absenteisme)}</dd>

          <dt>Polyvalence moyenne</dt>
          <dd>{tableau.polyvalenceMoyenne.toFixed(1)} postes par personne</dd>

          <dt>Postes fragiles</dt>
          <dd>{tableau.competencesFragiles}</dd>

          <dt>Conformité</dt>
          <dd>
            {tableau.reglesEnfreintes === 0 ? (
              <span className="verdict verdict--bon">Aucune règle enfreinte</span>
            ) : (
              <span className="verdict verdict--mauvais">
                {tableau.reglesEnfreintes} règle{tableau.reglesEnfreintes > 1 ? 's' : ''} enfreinte
                {tableau.reglesEnfreintes > 1 ? 's' : ''}
              </span>
            )}
          </dd>
        </dl>

        <div className="champs">
          <ChampNombre
            libelle="Chiffre d’affaires de la semaine"
            suffixe="€"
            valeur={etat.chiffreAffairesParSemaine[semaine] ?? 0}
            pas={1000}
            onChange={enregistrerLeChiffreAffaires}
            aide="Facultatif. Renseigné, il donne la productivité en € par heure."
          />
        </div>
        {tableau.productivite !== null && (
          <p className="champ__aide">
            Productivité : <strong>{Math.round(tableau.productivite).toLocaleString('fr-FR')} €</strong>{' '}
            par heure travaillée.
          </p>
        )}
      </section>

      <section className="carte">
        <h2>Plan d’actions</h2>
        {actions.length === 0 ? (
          <p className="avis">Aucun point d’attention cette semaine.</p>
        ) : (
          <ul className="liste-alertes">
            {actions.map((action) => (
              <li
                key={action.titre}
                className={
                  action.priorite === 1
                    ? 'alerte alerte--urgent'
                    : action.priorite === 2
                      ? 'alerte alerte--attention'
                      : 'alerte alerte--information'
                }
              >
                <p className="alerte__titre">{action.titre}</p>
                <p className="alerte__detail">{action.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte">
        <h2>Rapports à remettre</h2>
        <p>
          Ce que vous voyez est exactement ce qui sera imprimé. Aucune note interne, aucun statut,
          aucun historique n’y figure.
        </p>

        <div className="groupe-boutons">
          {(['hebdomadaire', 'mensuel'] as TypeRapport[]).map((type) => (
            <button
              key={type}
              type="button"
              className={rapport === type ? 'bouton bouton--principal' : 'bouton'}
              onClick={() => setRapport(rapport === type ? null : type)}
            >
              {type === 'hebdomadaire' ? 'Rapport hebdomadaire' : 'Bilan mensuel'}
            </button>
          ))}
        </div>

        {rapport !== null && (
          <>
            <p>
              <button
                type="button"
                className="bouton bouton--principal"
                onClick={() => {
                  marquerLeRapportRemis(rapport)
                  window.print()
                }}
              >
                Imprimer ou enregistrer en PDF
              </button>
            </p>
            <div className="apercu-document">
              <RapportImprimable
                type={rapport}
                tableau={tableau}
                actions={actions}
                nomDuService={etat.magasin.services[0]?.nom ?? 'Frais'}
                edite={aujourdhui()}
              />
            </div>
          </>
        )}
      </section>

      <section className="carte">
        <h2>Rapports déjà remis</h2>
        <p className="avis">
          Simple liste, sans circuit de validation : un rapport ne se valide pas, il se remet. Les
          remarques ci-dessous sont des <strong>notes internes</strong> et ne figurent sur aucun
          document.
        </p>

        {etat.rapportsProduits.length === 0 ? (
          <p>Aucun rapport remis pour l’instant.</p>
        ) : (
          <ul className="liste-simple">
            {[...etat.rapportsProduits]
              .sort((a, b) => b.edite.localeCompare(a.edite))
              .map((produit) => (
                <li key={produit.id}>
                  <p>
                    <strong>
                      {produit.type === 'hebdomadaire' ? 'Rapport hebdomadaire' : 'Bilan mensuel'}
                    </strong>{' '}
                    — période du {dateEnTexte(produit.periode)}, édité le{' '}
                    {dateEnTexte(produit.edite)}
                  </p>
                  <label className="champ">
                    <span className="champ__libelle">Remarques du patron et suites à donner</span>
                    <textarea
                      className="champ__saisie champ__saisie--texte"
                      rows={2}
                      value={produit.remarques}
                      placeholder="Ce qu’il en a dit, ce que vous devez faire…"
                      onChange={(evenement) => noterLesRemarques(produit.id, evenement.target.value)}
                    />
                  </label>
                  <p>
                    <button
                      type="button"
                      className="bouton bouton--discret"
                      onClick={() => {
                        setSemaine(produit.periode)
                        setRapport(produit.type)
                      }}
                    >
                      Réimprimer à l’identique
                    </button>{' '}
                    <button
                      type="button"
                      className="bouton bouton--discret"
                      onClick={() => retirerLeRapport(produit.id)}
                    >
                      Supprimer
                    </button>
                  </p>
                </li>
              ))}
          </ul>
        )}
      </section>
    </>
  )
}
