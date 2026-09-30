import type { Module } from './modules'

/**
 * Ecran affiche pour un module pas encore construit.
 * Il annonce clairement ce qui viendra et quand, plutot que de laisser
 * croire a une page vide ou cassee.
 */
export function EcranAVenir({ module }: { readonly module: Module }) {
  return (
    <>
      <header className="entete">
        <h1>{module.titre}</h1>
        <p>{module.resume}</p>
      </header>

      <div className="carte">
        <h2>Cet écran n’est pas encore construit</h2>
        <p>
          Il fait partie du projet et sa place est déjà réservée ici. Son contenu est décrit dans le
          cahier des charges.
        </p>
        <p>
          <span className="etiquette etiquette--attente">Prévu : {module.livraison}</span>
        </p>
      </div>
    </>
  )
}
