import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import { calculerAlertes, resumerAlertes, type Alerte, type GraviteAlerte } from '../../moteurs/alertes'
import { useDonnees } from '../DonneesProvider'
import { ChampNombre } from '../composants/Champ'

const LIBELLES_GRAVITE: Readonly<Record<GraviteAlerte, string>> = {
  urgent: 'À traiter tout de suite',
  attention: 'À anticiper',
  information: 'Pour information',
}

function LigneAlerte({ alerte }: { readonly alerte: Alerte }) {
  return (
    <li className={`alerte alerte--${alerte.gravite}`}>
      <p className="alerte__titre">{alerte.titre}</p>
      <p className="alerte__detail">{alerte.detail}</p>
      {alerte.echeance !== null && (
        <p className="alerte__echeance">Échéance : {dateEnTexte(alerte.echeance)}</p>
      )}
    </li>
  )
}

export function Alertes() {
  const { etat, modifier } = useDonnees()
  const date = aujourdhui()
  const alertes = calculerAlertes(etat.collaborateurs, date, etat.reglagesAlertes)
  const resume = resumerAlertes(alertes)
  const reglages = etat.reglagesAlertes

  function modifierReglage(cle: keyof typeof reglages, valeur: number): void {
    modifier((precedent) => ({
      ...precedent,
      reglagesAlertes: { ...precedent.reglagesAlertes, [cle]: valeur },
    }))
  }

  const groupes: GraviteAlerte[] = ['urgent', 'attention', 'information']

  return (
    <>
      <header className="entete">
        <h1>Alertes</h1>
        <p>Toutes les échéances et anomalies réunies au même endroit.</p>
      </header>

      <section className="carte">
        <h2>{dateEnTexte(date)}</h2>
        <dl className="liste-faits">
          <dt>À traiter tout de suite</dt>
          <dd>{resume.urgent}</dd>
          <dt>À anticiper</dt>
          <dd>{resume.attention}</dd>
        </dl>
      </section>

      {alertes.length === 0 ? (
        <section className="carte">
          <h2>Rien à signaler</h2>
          <p>Aucune échéance ne demande votre attention aujourd’hui.</p>
        </section>
      ) : (
        groupes
          .filter((gravite) => alertes.some((alerte) => alerte.gravite === gravite))
          .map((gravite) => (
            <section key={gravite} className="carte">
              <h2>{LIBELLES_GRAVITE[gravite]}</h2>
              <ul className="liste-alertes">
                {alertes
                  .filter((alerte) => alerte.gravite === gravite)
                  .map((alerte) => (
                    <LigneAlerte key={alerte.id} alerte={alerte} />
                  ))}
              </ul>
            </section>
          ))
      )}

      <section className="carte">
        <h2>Réglages du préavis</h2>
        <p>Combien de jours à l’avance voulez-vous être prévenu ?</p>
        <div className="champs">
          <ChampNombre
            libelle="Fin de période d’essai"
            suffixe="jours"
            valeur={reglages.preavisPeriodeEssaiJours}
            onChange={(valeur) => modifierReglage('preavisPeriodeEssaiJours', valeur)}
          />
          <ChampNombre
            libelle="Fin de contrat"
            suffixe="jours"
            valeur={reglages.preavisFinContratJours}
            onChange={(valeur) => modifierReglage('preavisFinContratJours', valeur)}
          />
          <ChampNombre
            libelle="Habilitation"
            suffixe="jours"
            valeur={reglages.preavisHabilitationJours}
            onChange={(valeur) => modifierReglage('preavisHabilitationJours', valeur)}
          />
          <ChampNombre
            libelle="Seuil d’urgence"
            suffixe="jours"
            valeur={reglages.seuilUrgenceJours}
            onChange={(valeur) => modifierReglage('seuilUrgenceJours', valeur)}
          />
        </div>
      </section>
    </>
  )
}
