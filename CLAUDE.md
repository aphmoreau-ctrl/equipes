# Projet « Équipes » – consignes permanentes

## Qui je suis
- Arnaud, futur responsable des rayons frais d'un supermarché Intermarché (convention collective IDCC 2216).
- Je ne suis **pas développeur** : explique chaque étape simplement, **toujours en français**.
- J'utilise l'application surtout sur **iPad** (construction des plannings), aussi sur **iPhone** (écran du jour, imprévus) et **Mac**.

## Le projet
Application web installable (PWA) de **gestion complète des équipes**, décrite dans `CAHIER-DES-CHARGES.md`. **Lis ce fichier avant toute tâche** et respecte-le. En cas de doute ou de contradiction, pose la question au lieu de supposer.

## Méthode de travail (obligatoire)

**Méthode en vigueur depuis le 2 octobre 2026, après le lot 1a : construction
continue jusqu'au bout de la feuille de route.** Arnaud a validé les lots 0 et
1a écran par écran, puis demandé d'enchaîner sans interruption.

1. **Enchaîner les lots sans demander de validation.** La feuille de route va
   du lot 1b au lot 10 (spécification `SPEC_PLANNING_AUTO.md`).
2. **Fin de chaque lot** : tests automatiques qui passent, données fictives de
   démonstration à jour, publication sur GitHub Pages, puis **lot suivant**.
3. **Point non précisé** : ne pas attendre. Choisir la solution la plus
   raisonnable et conforme au cahier des charges, puis la consigner dans
   `DECISIONS.md` (décision, raison, alternative possible).
4. **Ne s'arrêter que pour ce qui exige réellement son intervention** (créer le
   projet Firebase, se connecter à un compte). Dans ce cas : préparer tout le
   reste, expliquer exactement quoi faire, et continuer les autres lots.
5. Le **moteur de besoin** et le **moteur de planning** restent du code pur,
   séparé de l'interface, **couvert par des tests** (règles légales, cas
   limites). Aucun lot n'est terminé si un test échoue.
6. **Ne jamais modifier la charge des rayons existants sans le dire.** Le test
   `besoins-inchanges.test.ts` fige leur besoin : s'il casse, c'est volontaire
   et cela se consigne dans `DECISIONS.md`, jamais corrigé en silence.
7. Commits fréquents, messages en français, jamais de travail non publié.
8. Ne jamais supprimer ni réécrire une grosse partie sans l'expliquer dans
   `DECISIONS.md`.
9. **À la fin** : un résumé clair — ce qui est fait, comment le tester sur iPad
   et sur iPhone, et la liste des décisions à relire.

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
