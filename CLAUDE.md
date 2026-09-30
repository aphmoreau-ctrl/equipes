# Projet « Équipes » – consignes permanentes

## Qui je suis
- Arnaud, futur responsable des rayons frais d'un supermarché Intermarché (convention collective IDCC 2216).
- Je ne suis **pas développeur** : explique chaque étape simplement, **toujours en français**.
- J'utilise l'application surtout sur **iPad** (construction des plannings), aussi sur **iPhone** (écran du jour, imprévus) et **Mac**.

## Le projet
Application web installable (PWA) de **gestion complète des équipes**, décrite dans `CAHIER-DES-CHARGES.md`. **Lis ce fichier avant toute tâche** et respecte-le. En cas de doute ou de contradiction, pose la question au lieu de supposer.

## Méthode de travail (obligatoire)
1. On avance **étape par étape** (voir la feuille de route du cahier des charges). Avant chaque étape : présente ce que tu vas faire en quelques lignes et **attends ma validation**.
2. Après chaque étape : **tests automatiques** qui passent, **données fictives de démonstration** pour que je puisse tester, publication sur GitHub Pages, puis un résumé clair de ce qui a changé et de ce que je dois tester.
3. Le **moteur de besoin** et le **moteur de planning** sont du code pur, séparé de l'interface, et **couverts par des tests** (règles légales, cas limites). Aucune étape n'est terminée si un test échoue.
4. Commits fréquents, messages en français, jamais de travail non publié en fin d'étape.
5. Ne supprime ou ne réécris jamais une grosse partie sans me l'avoir expliqué et sans mon accord.

## Règles absolues
- **Aucune donnée réelle dans le dépôt** (le dépôt et le site sont publics) : les données vivent uniquement dans Firebase, derrière l'authentification, avec des règles de sécurité strictes par utilisateur. Seules des données **fictives** peuvent figurer dans le code (démo, tests).
- **RGPD** : prénom + initiale du nom uniquement ; jamais de motif médical, de situation familiale, d'appréciation personnelle ; seulement des faits datés. Voir la section RGPD du cahier des charges.
- Les règles légales et conventionnelles sont des **paramètres modifiables**, jamais codées en dur sans possibilité de réglage.
- L'application doit fonctionner **hors ligne** et se synchroniser dès le retour du réseau.
- Interface en **français**, pensée d'abord pour l'**iPad** (écran tactile, gros boutons), puis iPhone et Mac.

## Publication
- Dépôt : `aphmoreau-ctrl/equipes`, publié sur GitHub Pages : https://aphmoreau-ctrl.github.io/equipes/
- Après chaque publication, rappelle-moi comment mettre à jour l'app sur l'iPad (fermer puis rouvrir).
