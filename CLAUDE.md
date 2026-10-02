# Projet « Équipes » – consignes permanentes

## Qui je suis
- Arnaud, futur responsable des rayons frais d'un supermarché Intermarché (convention collective IDCC 2216).
- Je ne suis **pas développeur** : explique chaque étape simplement, **toujours en français**.
- J'utilise l'application surtout sur **iPad** (construction des plannings), aussi sur **iPhone** (écran du jour, imprévus) et **Mac**.

## Le projet
Application web installable (PWA) de **gestion complète des équipes**, décrite dans `CAHIER-DES-CHARGES.md`. **Lis ce fichier avant toute tâche** et respecte-le. En cas de doute ou de contradiction, pose la question au lieu de supposer.

## Méthode de travail (obligatoire)

**Méthode en vigueur depuis le 2 octobre 2026 : accord avant chaque lot.**
Elle remplace la « construction continue » du 30 septembre, qui enchaînait les
lots sans rien demander.

1. **Avant chaque lot** : présenter ce qui va être fait, montrer la maquette
   quand il s'agit d'un écran, et **attendre l'accord d'Arnaud**.
2. **À l'intérieur d'un lot validé : avancer sans s'arrêter.** Pas de validation
   à chaque petite étape, pas de question sur un détail — le lot est validé,
   il se termine.
3. **Fin de lot** : tests automatiques qui passent, données fictives de
   démonstration à jour, publication sur GitHub Pages, puis **présenter le lot
   suivant et attendre l'accord**.
4. **Point non précisé à l'intérieur d'un lot** : ne pas attendre. Choisir la
   solution la plus raisonnable et conforme au cahier des charges, puis la
   consigner dans `DECISIONS.md` (décision, raison, alternative possible).
5. **Ne s'arrêter en cours de lot que pour ce qui exige réellement son
   intervention** (créer le projet Firebase, se connecter à un compte). Dans ce
   cas : préparer tout le reste et expliquer exactement quoi faire.
6. Le **moteur de besoin** et le **moteur de planning** restent du code pur,
   séparé de l'interface, **couvert par des tests** (règles légales, cas
   limites). Aucun lot n'est terminé si un test échoue.
7. Commits fréquents, messages en français, jamais de travail non publié.
8. Ne jamais supprimer ni réécrire une grosse partie sans l'expliquer dans
   `DECISIONS.md`.
9. **À la fin d'une série de lots** : un résumé clair — ce qui est fait, comment
   le tester sur iPad et sur iPhone, et la liste des décisions à relire.

## Règles absolues
- **Outil strictement personnel** : l'application est utilisée par Arnaud seul. **Aucun accès patron ni tiers** — jamais de compte, de partage en lecture seule ni de lien de consultation, même « plus tard ». Le patron valide **en dehors de l'application** ; Arnaud renseigne lui-même le **circuit de suivi** (§9.6 du cahier des charges : Brouillon → Soumis → Validé / À corriger → Publié à l'équipe, avec historique).
- **Verrouillage** : Face ID / Touch ID par clé d'accès, avec **code de secours** toujours défini en premier. Tant qu'il n'y a pas de serveur (avant le lot 4), c'est un verrou d'écran, pas une protection des données : ne jamais le présenter autrement.
- **PDF sortants** (patron ou équipe) : propres, sobres, professionnels. Planning, horaires et **indicateurs utiles uniquement**. **Jamais** de notes personnelles, de commentaires internes (y compris les remarques du patron), de statut de suivi ni d'historique. Voir §15 « Documents sortants » du cahier des charges.
- **Aucune donnée réelle dans le dépôt** (le dépôt et le site sont publics) : les données vivent uniquement dans Firebase, derrière l'authentification, avec des règles de sécurité strictes par utilisateur. Seules des données **fictives** peuvent figurer dans le code (démo, tests).
- **RGPD** : prénom + initiale du nom uniquement ; jamais de motif médical, de situation familiale, d'appréciation personnelle ; seulement des faits datés. Voir la section RGPD du cahier des charges.
- Les règles légales et conventionnelles sont des **paramètres modifiables**, jamais codées en dur sans possibilité de réglage.
- L'application doit fonctionner **hors ligne** et se synchroniser dès le retour du réseau.
- Interface en **français**, pensée d'abord pour l'**iPad** (écran tactile, gros boutons), puis iPhone et Mac.

## Publication
- Dépôt : `aphmoreau-ctrl/equipes`, publié sur GitHub Pages : https://aphmoreau-ctrl.github.io/equipes/
- Après chaque publication, rappelle-moi comment mettre à jour l'app sur l'iPad (fermer puis rouvrir).
