import { useMemo, useState } from 'react'
import { aujourdhui, dateEnTexte } from '../../domaine/calendrier'
import { clientsDuJour, evenementsDuJour, rayonsActifs } from '../../domaine/magasin'
import { dureeEnTexte } from '../../domaine/temps'
import { pointeDeLaJournee, type Meteo, type NiveauQualite } from '../../moteurs/besoin'
import { configurationDeRayon, enPromotion, meteoDuJour, saisiesDuJour } from '../../donnees/etat'
import { useDonnees } from '../DonneesProvider'
import { CourbeBesoin } from '../composants/CourbeBesoin'
import { Chrono } from '../composants/Chrono'
import { heuresEnTexte, nombreEnTexte } from '../../domaine/nombres'

const METEOS: readonly { valeur: Meteo; libelle: string }[] = [
  { valeur: 'normal', libelle: 'Normal' },
  { valeur: 'chaud', libelle: 'Chaud' },
  { valeur: 'tres-chaud', libelle: 'Très chaud' },
  { valeur: 'froid', libelle: 'Froid' },
  { valeur: 'pluie', libelle: 'Pluie' },
]

const NIVEAUX: readonly { valeur: NiveauQualite; libelle: string; aide: string }[] = [
  { valeur: 'A', libelle: 'A', aide: 'Sans tri' },
  { valeur: 'B', libelle: 'B', aide: 'Tri léger' },
  { valeur: 'C', libelle: 'C', aide: 'Tri important' },
  { valeur: 'refus', libelle: 'Refus', aide: 'Marchandise refusée' },
]

export function Besoin() {
  const { etat, modifier, besoinDuJour } = useDonnees()
  const rayons = rayonsActifs(etat.magasin)

  const [date, setDate] = useState(aujourdhui)
  const [rayonId, setRayonId] = useState(rayons[0]?.id ?? '')
  const [produit, setProduit] = useState('')
  const [quantite, setQuantite] = useState('1')

  const configuration = configurationDeRayon(etat, rayonId)
  const besoin = useMemo(() => besoinDuJour(date, rayonId), [besoinDuJour, date, rayonId])
  const saisies = saisiesDuJour(etat, date, rayonId)
  const evenements = evenementsDuJour(etat.magasin, date, rayonId)
  const meteo = meteoDuJour(etat, date)
  const promotion = enPromotion(etat, date, rayonId)
  const budget = etat.magasin.budgetHeuresParRayon[rayonId] ?? 0

  function changerMeteo(valeur: Meteo): void {
    modifier((precedent) => ({
      ...precedent,
      meteoParDate: { ...precedent.meteoParDate, [date]: valeur },
    }))
  }

  function basculerPromotion(): void {
    modifier((precedent) => {
      const actuels = precedent.promotionsParDate[date] ?? []
      const suivants = actuels.includes(rayonId)
        ? actuels.filter((identifiant) => identifiant !== rayonId)
        : [...actuels, rayonId]
      return { ...precedent, promotionsParDate: { ...precedent.promotionsParDate, [date]: suivants } }
    })
  }

  function ajouterSaisie(niveau: NiveauQualite): void {
    const nombre = Number(quantite.replace(',', '.'))
    if (produit.trim() === '' || !Number.isFinite(nombre) || nombre <= 0) return

    modifier((precedent) => ({
      ...precedent,
      saisiesQualite: [
        ...precedent.saisiesQualite,
        {
          id: `q-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
          date,
          rayonId,
          produit: produit.trim(),
          quantite: nombre,
          niveau,
        },
      ],
    }))
    setProduit('')
    setQuantite('1')
  }

  function retirerSaisie(identifiant: string): void {
    modifier((precedent) => ({
      ...precedent,
      saisiesQualite: precedent.saisiesQualite.filter((saisie) => saisie.id !== identifiant),
    }))
  }

  return (
    <>
      <header className="entete">
        <h1>Besoin</h1>
        <p>
          Combien de personnes et quelles compétences, par rayon et par tranche de 30 minutes.
        </p>
      </header>

      <section className="carte">
        <div className="champs">
          <label className="champ">
            <span className="champ__libelle">Jour</span>
            <input
              type="date"
              className="champ__saisie"
              value={date}
              onChange={(evenement) => setDate(evenement.target.value)}
            />
          </label>

          <label className="champ">
            <span className="champ__libelle">Rayon</span>
            <select
              className="champ__saisie"
              value={rayonId}
              onChange={(evenement) => setRayonId(evenement.target.value)}
            >
              {rayons.map((rayon) => (
                <option key={rayon.id} value={rayon.id}>
                  {rayon.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="champ__aide">
          {dateEnTexte(date)} — {Math.round(clientsDuJour(etat.magasin, date))} clients attendus
          dans le magasin.
        </p>
      </section>

      {configuration === undefined ? (
        <section className="carte">
          <h2>Ce rayon n’a pas encore de modèle</h2>
          <p>
            Seul le rayon <strong>fruits et légumes</strong> est modélisé pour l’instant. Les six
            autres arrivent au lot 3, sur le même principe : un assemblage de blocs, avec leurs
            propres formules et paramètres.
          </p>
        </section>
      ) : (
        <>
          <section className="carte">
            <h2>Conditions du jour</h2>

            <p className="champ__libelle" id="titre-meteo">Météo</p>
            <div className="groupe-boutons" role="group" aria-labelledby="titre-meteo">
              {METEOS.map((option) => (
                <button
                  key={option.valeur}
                  type="button"
                  className={
                    meteo === option.valeur ? 'bouton bouton--principal' : 'bouton'
                  }
                  onClick={() => changerMeteo(option.valeur)}
                >
                  {option.libelle}
                </button>
              ))}
            </div>

            <p className="champ__libelle">Promotion sur ce rayon</p>
            <button
              type="button"
              className={promotion ? 'bouton bouton--principal' : 'bouton'}
              onClick={basculerPromotion}
              aria-pressed={promotion}
            >
              {promotion ? 'Rayon en promotion' : 'Pas de promotion'}
            </button>

            {evenements.length > 0 && (
              <p className="avis">
                <strong>Événements du calendrier :</strong>{' '}
                {evenements.map((evenement) => `${evenement.nom} (×${evenement.coefficient})`).join(', ')}.
              </p>
            )}
          </section>

          <section className="carte">
            <h2>Qualité des arrivages</h2>
            <p>
              Saisie au moment de la livraison. Le besoin du jour est recalculé immédiatement :
              une marchandise à trier demande plus de temps de mise en place et de tri.
            </p>

            <div className="champs">
              <label className="champ champ--large">
                <span className="champ__libelle">Produit</span>
                <input
                  type="text"
                  className="champ__saisie"
                  value={produit}
                  placeholder="Fraises, tomates…"
                  onChange={(evenement) => setProduit(evenement.target.value)}
                />
              </label>
              <label className="champ champ--etroit">
                <span className="champ__libelle">Palettes</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  className="champ__saisie"
                  value={quantite}
                  onChange={(evenement) => setQuantite(evenement.target.value)}
                />
              </label>
            </div>

            <p className="champ__libelle">Qualité constatée — touchez pour enregistrer</p>
            <div className="groupe-boutons">
              {NIVEAUX.map((niveau) => (
                <button
                  key={niveau.valeur}
                  type="button"
                  className="bouton"
                  aria-label={`Qualité ${niveau.libelle} — ${niveau.aide}`}
                  disabled={produit.trim() === ''}
                  onClick={() => ajouterSaisie(niveau.valeur)}
                >
                  {niveau.libelle}
                  <span className="bouton__aide">{niveau.aide}</span>
                </button>
              ))}
            </div>

            {saisies.length > 0 && (
              <ul className="liste-simple">
                {saisies.map((saisie) => (
                  <li key={saisie.id} className="ligne-saisie">
                    <span>
                      <strong>{saisie.produit}</strong> — {saisie.quantite} palette
                      {saisie.quantite > 1 ? 's' : ''}, qualité {saisie.niveau}
                    </span>
                    <button
                      type="button"
                      className="bouton bouton--discret"
                      onClick={() => retirerSaisie(saisie.id)}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {besoin !== null && (
            <>
              <section className="carte">
                <h2>Courbe du besoin</h2>
                <p>
                  Hauteur des barres : le travail à faire, exprimé en personnes. La marche
                  d’escalier : le nombre de personnes finalement retenu.
                </p>
                <CourbeBesoin besoin={besoin} blocs={configuration.blocs} />
              </section>

              <section className="carte">
                <h2>Totaux de la journée</h2>
                <dl className="liste-faits">
                  <dt>Travail à faire</dt>
                  <dd>{dureeEnTexte(Math.round(besoin.minutesTotal))}</dd>

                  <dt>Présence nécessaire</dt>
                  <dd>{heuresEnTexte(besoin.heuresPresence)}</dd>

                  <dt>Pointe</dt>
                  <dd>
                    {pointeDeLaJournee(besoin)} personne
                    {pointeDeLaJournee(besoin) > 1 ? 's' : ''} en même temps
                  </dd>

                  <dt>Budget du rayon</dt>
                  <dd>{budget} h par semaine</dd>
                </dl>

                <p className="champ__libelle">Coefficients appliqués</p>
                <dl className="liste-faits">
                  <dt>Saison</dt>
                  <dd>×{nombreEnTexte(besoin.coefficientsAppliques.saison, 2)}</dd>
                  <dt>Météo</dt>
                  <dd>×{nombreEnTexte(besoin.coefficientsAppliques.meteo, 2)}</dd>
                  <dt>Événements</dt>
                  <dd>×{nombreEnTexte(besoin.coefficientsAppliques.evenement, 2)}</dd>
                  <dt>Promotion</dt>
                  <dd>×{nombreEnTexte(besoin.coefficientsAppliques.promotion, 2)}</dd>
                  <dt>Qualité des arrivages</dt>
                  <dd>×{nombreEnTexte(besoin.coefficientsAppliques.qualite, 2)}</dd>
                </dl>

                {besoin.alertes.map((alerte) => (
                  <p key={alerte} className="avis avis--attention">
                    {alerte}
                  </p>
                ))}
              </section>
            </>
          )}

          <Chrono configuration={configuration} />
        </>
      )}
    </>
  )
}
