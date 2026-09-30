# Mettre en place la synchronisation (lot 4)

Ce document explique **ce que vous devez faire vous-même**. C'est la seule
étape du projet que je ne peux pas faire à votre place : créer un compte et un
projet Firebase suppose d'accepter des conditions d'utilisation en votre nom.

**Durée : environ 15 minutes.** Aucune connaissance technique n'est nécessaire :
il s'agit de cliquer dans un site web et de copier un texte.

> **Pourquoi Firebase ?** C'est le service de Google qui gardera vos données.
> Aujourd'hui, ce que vous réglez sur l'iPad reste sur l'iPad. Avec Firebase,
> l'iPad, l'iPhone et le Mac voient la même chose, en temps réel, et les
> données continuent de fonctionner hors ligne.
>
> **Coût : gratuit** pour un usage comme le vôtre. Le plan gratuit (« Spark »)
> couvre très largement un service Frais. Ne passez pas au plan payant.

---

## Étape 1 — Créer le projet

1. Allez sur **https://console.firebase.google.com**
2. Connectez-vous avec un compte Google.
   *Utilisez de préférence un compte dédié à ce projet, pas votre compte
   personnel — c'est plus propre si quelqu'un doit reprendre l'outil un jour.*
3. Cliquez sur **« Créer un projet »**.
4. Nom du projet : **`equipes-frais`**
   *(pas le projet « Mes Heures » : celui-ci doit être neuf et séparé).*
5. **Désactivez Google Analytics** — inutile ici, et cela évite de partager des
   statistiques d'usage.
6. Cliquez sur **Créer le projet**, puis attendez la fin.

## Étape 2 — Activer l'authentification

1. Dans le menu de gauche : **Créer → Authentication**.
2. Cliquez sur **Commencer**.
3. Dans l'onglet **Sign-in method**, choisissez **E-mail/Mot de passe**.
4. Activez le **premier** interrupteur (« E-mail/Mot de passe »).
   **N'activez pas** « Lien de connexion sans mot de passe ».
5. **Enregistrer**.
6. Onglet **Users** → **Ajouter un utilisateur** : saisissez votre adresse
   e-mail et un mot de passe.
   **Choisissez un vrai mot de passe, long et unique.** C'est lui qui protégera
   les données de vos collaborateurs. Notez-le dans votre gestionnaire de mots
   de passe — **ne me le communiquez jamais**.

## Étape 3 — Créer la base de données

1. Menu de gauche : **Créer → Firestore Database**.
2. **Créer une base de données**.
3. Emplacement : **`eur3 (europe-west)`** ou **`europe-west1`**.
   *Important : les données restent en Europe, comme l'exige le RGPD.*
4. Mode : choisissez **Démarrer en mode production** (tout est bloqué par
   défaut — c'est ce que nous voulons).
5. **Créer**.

## Étape 4 — Installer les règles de sécurité

1. Dans **Firestore Database**, onglet **Règles**.
2. **Effacez tout** ce qui s'y trouve.
3. Ouvrez le fichier [`firebase/firestore.rules`](firebase/firestore.rules) de
   ce projet, copiez **tout** son contenu, et collez-le à la place.
4. Cliquez sur **Publier**.

Ces règles disent une seule chose, mais elles la disent strictement :
**chacun n'accède qu'à ses propres données, et uniquement s'il est connecté.**
Personne d'autre ne peut rien lire ni écrire — y compris moi.

## Étape 5 — Me transmettre la configuration

1. Cliquez sur la **roue dentée** en haut à gauche → **Paramètres du projet**.
2. Descendez jusqu'à **« Vos applications »**.
3. Cliquez sur l'icône **`</>`** (application Web).
4. Surnom de l'application : **`Équipes`**.
   **Ne cochez pas** « Configurer Firebase Hosting ».
5. **Enregistrer l'application**.
6. Un bloc de texte apparaît, qui ressemble à ceci :

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "equipes-frais.firebaseapp.com",
  projectId: "equipes-frais",
  storageBucket: "equipes-frais.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef..."
};
```

7. **Copiez ce bloc** et collez-le-moi dans la conversation.

> **Est-ce dangereux de me le donner ?** Non. Malgré son nom, la clé `apiKey`
> n'est **pas un mot de passe** : Google prévoit qu'elle soit publique et
> visible dans le site. Ce qui protège vos données, ce sont les **règles de
> sécurité** de l'étape 4 et **votre mot de passe** de l'étape 2.
>
> **Votre mot de passe, lui, ne doit jamais être écrit ici.**

---

## Ce qui se passera ensuite

Une fois la configuration reçue, je brancherai la synchronisation et je
publierai. Vous n'aurez plus qu'à :

1. ouvrir l'application ;
2. vous connecter une fois sur chaque appareil, avec l'adresse et le mot de
   passe de l'étape 2 ;
3. constater que l'iPad, l'iPhone et le Mac affichent la même chose.

Tant que cette étape n'est pas faite, **l'application continue de fonctionner
normalement** : les données restent simplement sur chaque appareil, séparément.

---

## En cas de problème

- **Je ne trouve pas un bouton.** L'interface de Firebase change régulièrement.
  Décrivez-moi ce que vous voyez, ou envoyez une capture d'écran.
- **On me demande une carte bancaire.** Vous êtes en train de passer au plan
  payant : revenez en arrière, le plan gratuit suffit.
- **Je me suis trompé quelque part.** Rien n'est grave : on peut supprimer le
  projet et recommencer.
