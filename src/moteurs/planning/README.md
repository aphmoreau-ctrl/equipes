# Moteur de planning

**Priorité 2 de la priorisation** (cahier des charges §9, §16.1).

Ce dossier accueillera la génération automatique du planning : vacations
candidates, placement des postes clés, choix de la personne au meilleur score,
amélioration par recherche locale, gestion des polyvalents.

Jusqu'à sa livraison, les plannings sont construits **à la main** dans
l'application, qui les **vérifie** (`src/moteurs/regles/`) et affiche la
couverture face au besoin.

**Règle d'architecture** : code pur, déterministe (même résultat à données
égales), et couvert par une batterie de tests légaux avant toute mise en
service.
