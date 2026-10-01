import { etatInitial, VERSION_ETAT, type EtatApplication } from './etat'

/**
 * Sauvegarde et restauration sur fichier (§16.2, etape 4 : « sauvegarde et
 * restauration »).
 *
 * Tant que Firebase n'est pas en place, c'est le SEUL moyen de ne pas perdre
 * ses donnees si l'iPad est remplace, ou de les passer d'un appareil a
 * l'autre. Le fichier reste chez vous : l'application ne l'envoie nulle part.
 */

/** Marque qui distingue un fichier de sauvegarde de n'importe quel JSON. */
export const FORMAT_SAUVEGARDE = 'equipes-sauvegarde'

export interface FichierSauvegarde {
  readonly format: typeof FORMAT_SAUVEGARDE
  readonly version: number
  /** Date et heure de l'export, au format ISO. */
  readonly exporteLe: string
  readonly donnees: EtatApplication
}

export function creerSauvegarde(etat: EtatApplication, maintenant: Date): string {
  const fichier: FichierSauvegarde = {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_ETAT,
    exporteLe: maintenant.toISOString(),
    donnees: etat,
  }
  return JSON.stringify(fichier, null, 1)
}

/** « equipes-sauvegarde-2026-10-01.json » */
export function nomDuFichier(maintenant: Date): string {
  const jour = maintenant.toISOString().slice(0, 10)
  return `${FORMAT_SAUVEGARDE}-${jour}.json`
}

export type LectureSauvegarde =
  | { readonly ok: true; readonly etat: EtatApplication; readonly exporteLe: string }
  | { readonly ok: false; readonly raison: string }

/** Champs sans lesquels l'application ne peut pas fonctionner. */
const TABLEAUX_OBLIGATOIRES: readonly (keyof EtatApplication)[] = [
  'configurations',
  'collaborateurs',
]

/**
 * Relit un fichier de sauvegarde. Ne modifie rien : c'est a l'ecran de
 * demander confirmation avant de remplacer les donnees.
 *
 * Les champs apparus depuis l'export (nouveaux modules) prennent leur valeur
 * par defaut, pour qu'une ancienne sauvegarde reste restaurable.
 */
export function lireSauvegarde(texte: string): LectureSauvegarde {
  let valeur: unknown
  try {
    valeur = JSON.parse(texte)
  } catch {
    return { ok: false, raison: 'Ce fichier est illisible : ce n’est pas une sauvegarde de l’application.' }
  }

  if (typeof valeur !== 'object' || valeur === null) {
    return { ok: false, raison: 'Ce fichier n’est pas une sauvegarde de l’application.' }
  }
  const fichier = valeur as Partial<FichierSauvegarde>
  if (fichier.format !== FORMAT_SAUVEGARDE) {
    return { ok: false, raison: 'Ce fichier n’est pas une sauvegarde de l’application.' }
  }
  if (typeof fichier.version !== 'number' || fichier.version > VERSION_ETAT) {
    return {
      ok: false,
      raison:
        'Cette sauvegarde vient d’une version plus récente de l’application. ' +
        'Mettez d’abord l’application à jour, puis recommencez.',
    }
  }
  const donnees = fichier.donnees
  if (typeof donnees !== 'object' || donnees === null || typeof donnees.magasin !== 'object') {
    return { ok: false, raison: 'Cette sauvegarde est incomplète : le magasin est absent.' }
  }
  for (const champ of TABLEAUX_OBLIGATOIRES) {
    if (!Array.isArray(donnees[champ])) {
      return { ok: false, raison: 'Cette sauvegarde est incomplète ou endommagée.' }
    }
  }

  return {
    ok: true,
    etat: { ...etatInitial(), ...donnees, version: VERSION_ETAT },
    exporteLe: typeof fichier.exporteLe === 'string' ? fichier.exporteLe : '',
  }
}

/** Ce que contient une sauvegarde, en une phrase, avant de la restaurer. */
export function resumerSauvegarde(etat: EtatApplication): string {
  const semaines = Object.keys(etat.plannings).length
  const collaborateurs = etat.collaborateurs.length
  return (
    `${collaborateurs} collaborateur${collaborateurs > 1 ? 's' : ''}, ` +
    `${semaines} semaine${semaines > 1 ? 's' : ''} de planning, ` +
    `${etat.notes.length} note${etat.notes.length > 1 ? 's' : ''}` +
    (etat.demonstration ? ' — données de démonstration' : '')
  )
}
