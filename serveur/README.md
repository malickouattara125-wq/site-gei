# Serveur et tableau de bord GEI

Ce dossier fait tourner le site de Global Empire Immobilier **avec son tableau de bord**.
Il utilise uniquement Node.js, sans aucune bibliothèque à installer.

## Tester depuis le dépôt GitHub (pour un ami, un développeur)

Il faut **Node.js 18 ou plus** (https://nodejs.org). Aucune autre installation n'est nécessaire.

1. Télécharger le dépôt : bouton vert **Code**, puis **Download ZIP**, et décompresser l'archive.
   Ou bien : `git clone https://github.com/malickouattara125-wq/site-gei.git`
2. Dans un terminal, aller dans le dossier `serveur` du dépôt et lancer :
   ```
   node server.js
   ```
   Sous Windows, on peut aussi double-cliquer sur `serveur/demarrer.bat`.
3. Ouvrir http://localhost:8765 pour le site, et http://localhost:8765/admin pour le tableau de bord.
4. Au premier démarrage, un compte admin est créé automatiquement. Ses identifiants sont dans `serveur/data/premier-acces.txt`.
   Le contenu de départ (4 programmes, 6 actualités) vient du dossier `serveur/seed/`.

## Démarrer en local

Double-cliquez sur **`demarrer.bat`**. Le tableau de bord s'ouvre tout seul dans le navigateur.

- Site : http://localhost:8765
- Tableau de bord : http://localhost:8765/admin

Laissez la fenêtre noire ouverte. Fermez-la pour arrêter le site.

**Première connexion :** l'identifiant et le mot de passe sont dans `data/premier-acces.txt`.
Changez le mot de passe dans l'onglet « Mon compte ». Le fichier est ensuite supprimé tout seul.

## Ce que fait le tableau de bord

| Onglet | Rôle |
|---|---|
| Vue d'ensemble | Visiteurs et pages vues sur 30 jours, pages les plus vues, demandes à traiter |
| Demandes | Messages envoyés par le formulaire du site. Bouton WhatsApp, « Marquer traitée », suppression |
| Programmes | Ajouter, modifier, masquer ou supprimer un programme : prix, statut, textes, photos, galerie, vidéo |
| Actualités | Écrire, publier ou retirer une actualité |
| Mon compte | Changer le mot de passe |

Les changements apparaissent **tout de suite** sur le site : accueil, page Programmes, fiches et Actualités.

## Organisation des dossiers

Dans le dépôt GitHub, le site est à la racine et le serveur dans `serveur/` : il trouve le site tout seul.
Sur l'ordinateur de départ, l'organisation est la suivante :

```
N'Gaman/5_Site_web/
├── Site_GEI/        les pages, le style, les images et les vidéos du site
├── GEI_Serveur/     ce dossier
│   ├── server.js    le serveur
│   ├── lib/         connexion, stockage, statistiques, fabrication des pages
│   ├── admin/       l'interface du tableau de bord
│   ├── templates/   le gabarit des fiches programme
│   ├── seed/        le contenu de départ (copié dans data/ au premier démarrage)
│   ├── data/        LES DONNÉES : programmes, actualités, demandes, mot de passe, statistiques
│   └── uploads/     les photos envoyées depuis le tableau de bord
└── outils/node/     Node.js (version portable, sans installation)
```

**À sauvegarder régulièrement :** `data/` et `uploads/`.
Ces deux dossiers ne doivent **jamais** être mis sur GitHub : ils contiennent les coordonnées des clients et le mot de passe.

## Mettre en ligne plus tard

**Chez LWS :** le site est en ligne sur https://geisarl.com, voir [`HEBERGEMENT-LWS.md`](../HEBERGEMENT-LWS.md).

Il faut un hébergeur qui accepte **Node.js 18 ou plus** : LWS (cPanel L ou plus), un VPS, Render, Railway, o2switch, Hostinger, etc.

1. Envoyer les dossiers `Site_GEI` et `GEI_Serveur` côte à côte, sans `data/` si vous partez de zéro.
2. Lancer `node server.js` depuis `GEI_Serveur`.
3. Réglages possibles, par variables d'environnement :
   - `PORT` : le port, 8765 par défaut ;
   - `SITE_DIR` : le chemin du dossier du site, `../Site_GEI` par défaut ;
   - `ADMIN_USER` et `ADMIN_PASSWORD` : les identifiants du premier compte ;
   - `FORCE_HTTPS=1` : à mettre une fois le certificat SSL actif (cookie de connexion protégé).

Le serveur supporte que l'hébergeur lance plusieurs copies de lui-même (cas de cPanel/Passenger) :
les connexions et les données sont partagées par les fichiers de `data/`.
4. Mettre le site en **HTTPS**. La plupart des hébergeurs le font automatiquement.

Sur GitHub Pages ou Vercel, le site reste visible, mais **sans** tableau de bord : le formulaire ouvre simplement WhatsApp.
