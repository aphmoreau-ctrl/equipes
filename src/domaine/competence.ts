/**
 * Catalogue des competences (cahier des charges §6.3).
 *
 * Une competence est un savoir-faire nomme, rattache a un ou plusieurs rayons.
 * Les taches du catalogue en exigent un NIVEAU minimum ; les fiches des
 * collaborateurs enregistrent le niveau atteint par chacun.
 *
 * L'identifiant EST le nom : c'est ce nom qui figure dans les taches et dans
 * les fiches. Renommer une competence demande donc de la renommer partout,
 * ce dont se charge « renommerCompetence ».
 *
 * RGPD : une competence est un fait professionnel, jamais une appreciation.
 */

export interface Competence {
  /** Le nom lui-meme : « découpe », « conseil vins ». */
  readonly id: string
  readonly nom: string
  /** Rayons ou cette competence sert. Liste vide = tous les rayons. */
  readonly rayons: readonly string[]
  readonly actif: boolean
}

/** Competences utiles a un rayon : les siennes, et celles de tous les rayons. */
export function competencesDuRayon(
  competences: readonly Competence[],
  rayonId: string,
): Competence[] {
  return competences.filter(
    (competence) =>
      competence.actif && (competence.rayons.length === 0 || competence.rayons.includes(rayonId)),
  )
}

/** Noms des competences actives, classes a la francaise. */
export function nomsDesCompetences(competences: readonly Competence[]): string[] {
  return competences
    .filter((competence) => competence.actif)
    .map((competence) => competence.nom)
    .sort((a, b) => a.localeCompare(b, 'fr'))
}
