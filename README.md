# Équipes

Application web installable (PWA) de gestion des équipes du service Frais.

**Adresse du site : https://aphmoreau-ctrl.github.io/equipes/**

Deux documents font référence pour ce projet :

- [`CAHIER-DES-CHARGES.md`](CAHIER-DES-CHARGES.md) — ce que l'application doit faire, dans le détail.
- [`CLAUDE.md`](CLAUDE.md) — les consignes permanentes de travail.

---

## Installer l'application sur iPad ou iPhone

1. Ouvrir **https://aphmoreau-ctrl.github.io/equipes/** **dans Safari**
   *(seul Safari sait installer une application sur iPhone et iPad — ni Chrome, ni Firefox).*
2. Toucher le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisir **« Sur l'écran d'accueil »**, puis **Ajouter**.

L'icône apparaît sur l'écran d'accueil. L'application s'ouvre alors en plein écran,
sans barre d'adresse, et **fonctionne sans réseau**.

Sur Mac, dans Safari : menu **Fichier → Ajouter au Dock**.

## Mettre à jour l'application

Quand une nouvelle version est publiée :

- si l'application est ouverte, un bandeau **« Une nouvelle version est prête »**
  apparaît en bas de l'écran. Toucher **Mettre à jour** ;
- sinon, **fermer complètement l'application** (glisser vers le haut depuis le
  bas de l'écran, puis balayer la fenêtre de l'application vers le haut) et la
  **rouvrir**.

Le numéro de version s'affiche dans **Paramètres → Cette application**.
C'est le moyen le plus simple de vérifier que la mise à jour est bien arrivée.

## Ouvrir l'application

Au premier lancement, l'application demande de **choisir un code** de 4 à 6
chiffres, puis propose d'activer **Face ID** (ou **Touch ID** sur Mac).

Le code reste toujours disponible comme secours : si Face ID ne reconnaît pas,
ou sur un appareil qui ne le propose pas.

> **Ce que cette protection vaut réellement.** L'application n'a pas encore de
> serveur : elle demande à l'appareil de vérifier l'identité, puis fait confiance
> à sa réponse. C'est un **verrou d'écran** — très efficace contre un curieux,
> insuffisant contre quelqu'un de compétent ayant l'appareil en main. La vraie
> protection des données viendra avec Firebase (lot 4).

---

## Travailler sur le projet

Il faut **Node.js 22 ou plus récent**.

```bash
npm install          # installer les dépendances (une seule fois)
npm run dev          # ouvrir l'application en développement
npm run verifier     # vérifier les types ET lancer tous les tests
npm run test:suivi   # relancer les tests à chaque modification
npm run build        # construire le site tel qu'il sera publié
npm run preview      # voir le site construit, service worker compris
npm run icones       # regénérer les icônes (seulement si le dessin change)
```

### Organisation des dossiers

| Dossier | Contenu |
|---|---|
| `src/domaine/` | Notions communes : heures, durées, tranches de 30 minutes |
| `src/moteurs/regles/` | Règles légales et conventionnelles, toutes paramétrables |
| `src/moteurs/besoin/` | Calcul du besoin par rayon et par tranche *(lot 2)* |
| `src/moteurs/planning/` | Génération automatique du planning *(priorité 2)* |
| `src/moteurs/indicateurs/` | Couverture, conformité, équité, budget |
| `src/donnees/` | Données de démonstration, **entièrement fictives** |
| `src/ui/` | Tout ce qui s'affiche à l'écran |
| `outils/` | Scripts de développement (génération des icônes) |

**Règle d'architecture, non négociable** : les dossiers `src/moteurs/` sont du
**code pur**. Ils ne doivent jamais importer quoi que ce soit de `src/ui/`.
C'est ce qui permet de les tester intégralement — et donc de garantir qu'un
planning ne violera pas le Code du travail.

### Publication

Chaque envoi sur la branche `main` déclenche automatiquement, sur GitHub :
vérification des types, exécution de tous les tests, construction du site,
puis mise en ligne.

**Si un test échoue, le site n'est pas mis à jour.** La dernière version saine
reste en ligne.

---

## Règles absolues

- **Aucune donnée réelle dans ce dépôt.** Le dépôt et le site sont publics.
  Seules des données fictives peuvent figurer dans le code, les tests et les
  démonstrations.
- **RGPD** : prénom et initiale du nom uniquement ; jamais de motif médical, de
  situation familiale ni d'appréciation personnelle ; uniquement des faits datés.
- **Outil strictement personnel** : aucun accès pour un tiers. Les documents
  destinés au patron ou à l'équipe sortent en PDF, hors de l'application.
