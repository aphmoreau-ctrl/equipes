import { useId } from 'react'

/** Champs de saisie, tous construits sur le meme modele : un libelle, une valeur. */

interface ChampTexteProprietes {
  readonly libelle: string
  readonly valeur: string
  readonly onChange: (valeur: string) => void
  readonly aide?: string
  readonly placeholder?: string
  readonly etroit?: boolean
}

export function ChampTexte({ libelle, valeur, onChange, aide, placeholder, etroit }: ChampTexteProprietes) {
  const identifiant = useId()
  return (
    <div className={etroit === true ? 'champ champ--etroit' : 'champ'}>
      <label className="champ__libelle" htmlFor={identifiant}>
        {libelle}
      </label>
      <input
        id={identifiant}
        type="text"
        className="champ__saisie"
        value={valeur}
        placeholder={placeholder}
        onChange={(evenement) => onChange(evenement.target.value)}
      />
      {aide !== undefined && <span className="champ__aide">{aide}</span>}
    </div>
  )
}

interface ChampNombreProprietes {
  readonly libelle: string
  readonly valeur: number
  readonly onChange: (valeur: number) => void
  readonly pas?: number
  readonly minimum?: number
  readonly suffixe?: string
  readonly aide?: string
}

export function ChampNombre({
  libelle,
  valeur,
  onChange,
  pas = 1,
  minimum = 0,
  suffixe,
  aide,
}: ChampNombreProprietes) {
  const identifiant = useId()
  return (
    <div className="champ champ--etroit">
      <label className="champ__libelle" htmlFor={identifiant}>
        {libelle}
        {suffixe !== undefined && <span className="champ__suffixe"> ({suffixe})</span>}
      </label>
      <input
        id={identifiant}
        type="number"
        inputMode="decimal"
        className="champ__saisie"
        value={String(valeur)}
        step={pas}
        min={minimum}
        onChange={(evenement) => {
          const nombre = Number(evenement.target.value.replace(',', '.'))
          if (Number.isFinite(nombre)) onChange(nombre)
        }}
      />
      {aide !== undefined && <span className="champ__aide">{aide}</span>}
    </div>
  )
}

interface ChampHeureProprietes {
  readonly libelle: string
  readonly valeur: string
  readonly onChange: (valeur: string) => void
}

export function ChampHeure({ libelle, valeur, onChange }: ChampHeureProprietes) {
  const identifiant = useId()
  return (
    <div className="champ champ--etroit">
      <label className="champ__libelle" htmlFor={identifiant}>
        {libelle}
      </label>
      <input
        id={identifiant}
        type="time"
        className="champ__saisie"
        value={valeur}
        step={300}
        onChange={(evenement) => onChange(evenement.target.value)}
      />
    </div>
  )
}

interface InterrupteurProprietes {
  readonly libelle: string
  readonly actif: boolean
  readonly onChange: (actif: boolean) => void
}

export function Interrupteur({ libelle, actif, onChange }: InterrupteurProprietes) {
  return (
    <button
      type="button"
      className={actif ? 'bouton bouton--principal' : 'bouton'}
      aria-pressed={actif}
      onClick={() => onChange(!actif)}
    >
      {libelle}
    </button>
  )
}

/** Un bloc repliable : evite les ecrans interminables sur iPhone. */
export function Depliant({
  titre,
  resume,
  children,
}: {
  readonly titre: string
  readonly resume?: string
  readonly children: React.ReactNode
}) {
  return (
    <details className="depliant">
      <summary className="depliant__titre">
        <span>{titre}</span>
        {resume !== undefined && <span className="depliant__resume">{resume}</span>}
      </summary>
      <div className="depliant__contenu">{children}</div>
    </details>
  )
}
