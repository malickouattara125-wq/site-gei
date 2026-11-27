# GEI Gestion

Application de gestion de **Global Empire Immobilier**, **indépendante du site internet** :
chantiers et planning, maisons et clients (échéanciers, paiements, reçus, relances WhatsApp),
dépenses, trésorerie, stock de matériaux, équipes et paie, rapport mensuel, import Excel.
Mode d'emploi détaillé : [GESTION-GEI.md](GESTION-GEI.md).

Aucune bibliothèque à installer : seulement **Node.js 18 ou plus**.

## Sur un ordinateur Windows
1. Double-cliquez sur **DEMARRER**.
2. Le navigateur s'ouvre sur http://localhost:8780.
3. Première connexion : identifiant `admin`, mot de passe `gei-local-2026`, à changer dans **Mon compte**.

Mot de passe du DG oublié ou refusé : lancez **REINITIALISER-MOT-DE-PASSE**, puis **DEMARRER**.

## Sur un hébergement (VPS, cPanel avec Node.js, Render, Railway…)
- Commande de démarrage : `node server.js` (ou `npm start`). Le port est lu dans la variable `PORT` (8780 par défaut).
- Variables utiles :
  - `ADMIN_PASSWORD` : mot de passe du premier compte DG (sinon un mot de passe est généré dans `data/premier-acces.txt`) ;
  - `FORCE_HTTPS=1` une fois le certificat SSL actif ;
  - `ENTREPRISE_NOM`, `ENTREPRISE_ADRESSE`, `ENTREPRISE_TELEPHONES` (séparés par des virgules), `ENTREPRISE_EMAIL` : coordonnées imprimées sur les reçus.
- Mettre l'application sur une adresse à part, par exemple **gestion.geisarl.com**.

## Données à sauvegarder
| Dossier | Contenu |
|---|---|
| `data/` | comptes, chantiers, maisons, paiements, dépenses, trésorerie, stock, ouvriers, pointages |
| `uploads/` | photos de chantier |
| `fichiers/` | documents joints (factures, contrats, plans) |

Ces dossiers ne doivent **jamais** être publiés (ils sont exclus de Git). Sauvegarde rapide : **Mon compte** → **Télécharger la sauvegarde** (DG).

## Mise à jour automatique

À chaque lancement, **DEMARRER** télécharge depuis GitHub les fichiers de l'application qui ont changé (liste : `fichiers.txt`). Les données (`data/`, `uploads/`, `fichiers/`) ne sont jamais touchées. Sans Internet, la version actuelle est utilisée.

Pour les développeurs : après toute modification de l'application, lancer `node gestion-app/outils/manifeste.js` avant de pousser, sinon les ordinateurs ne verront pas la nouvelle version.
