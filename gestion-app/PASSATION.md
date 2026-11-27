# GEI Gestion — Passation (état au 25/11/2026)

Document à donner à Claude au début d'une nouvelle discussion :
« Lis `gestion-app/PASSATION.md` du dépôt `malickouattara125-wq/site-gei` (branche `claude/gifted-meitner-sl86x9`) et continue le travail sur l'application. »

---

## 1. Contexte et consignes

- **Entreprise** : Global Empire Immobilier Sarl (GEI), promotion immobilière en Côte d'Ivoire.
- **Utilisateur** : non technicien. **Toujours répondre en français**, en messages **courts et simples**, étape par étape (clic par clic).
- **Le site internet (geisarl.com) est terminé** : ne plus y toucher. On travaille **uniquement sur l'application GEI Gestion**.
- Le temps est compté : aller à l'essentiel, montrer le résultat (captures), éviter les longues explications.
- Ne jamais redemander ni écrire de mot de passe (cPanel, etc.) dans la conversation.

## 2. Où est le code

| Élément | Valeur |
|---|---|
| Dépôt GitHub | `malickouattara125-wq/site-gei` (public) |
| Branche de travail | `claude/gifted-meitner-sl86x9` |
| Dossier de l'application | `gestion-app/` (totalement séparé du site, qui est dans `serveur/`) |
| Pull request | PR n°1 ouverte (site + app), pas encore fusionnée |

## 3. Comment l'application tourne chez l'utilisateur

- Sur son **ordinateur Windows**, dans un dossier **GEI-Gestion** (très probablement sur le Bureau).
- Il double-clique sur **DEMARRER** → l'application s'ouvre sur **http://localhost:8780**.
- **Sans mot de passe sur l'ordinateur** : `DEMARRER.bat` met `GEI_LOCAL=1`, le serveur connecte automatiquement le DG pour les requêtes venant de l'ordinateur lui-même (127.0.0.1, sans en-tête de relais). En ligne, le mot de passe reste obligatoire.
- **Mise à jour automatique** : à chaque lancement, `DEMARRER.bat` appelle `MISE-A-JOUR.ps1`, qui lit `gestion-app/fichiers.txt` sur GitHub (raw.githubusercontent.com) et télécharge les fichiers modifiés. Les dossiers `data/`, `uploads/`, `fichiers/` et `DEMARRER.bat` ne sont jamais touchés. **Testé et validé par l'utilisateur.**
- ⚠️ **Après toute modification de l'app, avant de pousser** : lancer `node gestion-app/outils/manifeste.js` (régénère `fichiers.txt` avec une empreinte), sinon les ordinateurs ne voient pas la nouvelle version. Puis dire à l'utilisateur : « fermez la fenêtre noire et relancez DEMARRER ».
- Les **données** sont dans `GEI-Gestion/data/` sur son PC (fichiers JSON). Conseil donné : copier ce dossier régulièrement sur clé USB / Drive.
- L'accès direct de Claude aux dossiers de son PC (Remote Control) **ne fonctionne pas** (dossiers « not_available »).

## 4. Architecture technique

- **Node.js sans dépendance**, stockage en fichiers JSON (`lib/store.js`), mots de passe scrypt, sessions (cookie `gei_g`).
- `server.js` : fichiers statiques de `public/`, API sous `/api/g/*` (login, me, password, entreprise, listes, images, upload, comptes, sauvegarde, fichiers privés, import, collections).
- `lib/gestion.js` : modèle et validation des collections — `chantiers` (étapes avec % et dates, photos, documents), `maisons` (échéancier, paiements clients), `depenses`, `ouvriers`, `pointages`, `mouvements` (trésorerie), `articles` et `stock`.
- **Rôles** : `dg` (tout), `comptable` (tout sauf comptes/sauvegarde), `chef` (chantiers, planning, stock, pointage ; **ne voit jamais les montants**, refus côté serveur).
- **Dépenses avec avances** : chaque dépense a `paiements: [{date, montant, mode}]` ; `paye` = total versé ≥ montant ; montant 0 autorisé (« prix à compléter ») ; anciennes dépenses sans liste = payées en totalité si `paye`. Trésorerie : chaque avance est une sortie à sa date. Import CSV : colonne « Avance payée ».

## 5. Interface (refonte premium terminée et validée)

Fichiers dans `gestion-app/public/` :

| Fichier | Rôle |
|---|---|
| `ds.css` | Design system : variables (couleurs, typo, espacements, rayons, ombres), **mode sombre**, composants de base |
| `app.css` | Mise en page de tous les écrans, responsive (menu bas sur téléphone, tableaux en cartes), impression |
| `icons.js` | Icônes Lucide en sprite (`GEI_ICON(nom)`), une par module |
| `ui.js` | Briques partagées (`G.ui.head` avec fil d'Ariane auto, `G.ui.tableau` avec pagination/état vide, `money`, `spark`, `ring`, `valider`), champs stylés automatiques (calendrier jj/mm/aaaa, listes avec recherche, montants « 730 000 FCFA »), recherche **Ctrl+K**, **notifications** (alertes calculées), thème clair/sombre, menu rétractable, skeleton |
| `core.js` | Socle : connexion, navigation par `#hash`, toasts, photos |
| `gestion.js` | Tableau de gestion (KPI + variation + courbe, cartes chantiers, graphique dépenses par chantier/catégorie, activité, alertes), chantiers, maisons, **dépenses** (liste avec chips Payé/Partiel/Impayé + formulaire en sections avec récapitulatif sticky), équipes et paie, comptes |
| `gestion-plus.js` | Trésorerie (`G.operations`), stock, planning (Gantt), rapport mensuel imprimable, import Excel (CSV) |
| `guide-style.html` | Guide de style validé par l'utilisateur (`/guide-style.html`) |

- **Polices** : Plus Jakarta Sans (titres, chiffres) + Inter (interface), via Google Fonts (police de secours sans Internet).
- **Palette** : vert forêt `#14200F` (menu), vert de marque `#2F5A1F` (boutons), olive `#B5CC5A` (actif), neutres chauds ; bleu marine supprimé. Statuts : payé (vert), partiel (ambre), impayé (rouge brique), en retard (orange).
- Principe : les champs d'origine restent dans les formulaires (cachés) avec leur nom et leur valeur → aucune logique métier modifiée.

## 6. Comment tester

- Copier l'app dans un dossier temporaire, lancer `GEI_LOCAL=1 ADMIN_PASSWORD=x PORT=8790 node server.js`, créer des données de test via l'API (`POST /api/g/<collection>` avec l'en-tête `x-gei: 1`).
- Playwright (préinstallé) pour les captures (bureau 1440 px, téléphone 390 px, mode sombre) et les tests de bout en bout (saisie dépense + avance + « Payer le reste », fiches chantier/maison, pointage, stock, filtres, Ctrl+K, notifications, rôle chef).
- Envoyer les captures à l'utilisateur ; ne jamais lui envoyer de longues explications techniques.

## 7. Prochaines étapes possibles (à faire choisir par l'utilisateur)

1. **Mettre l'app en ligne** (hébergement séparé du site, par ex. `gestion.geisarl.com`) pour le comptable et les chefs de chantier sur téléphone. L'utilisateur doit dire où héberger.
2. **Importer directement les fichiers Excel (.xlsx)** de l'assistante (ex. « Tableau chantiers Bingerville » : N°, Désignation, Quantité/Détail, Date, Montant total, Avance payée, Reste à payer ; titre en ligne 1, en-têtes en ligne 3). Aujourd'hui l'import ne lit que le CSV.
3. **Refaire la fiche Chantier** comme la page Dépense (sections, récapitulatif à droite).
4. **Guide de formation** simple, écran par écran, pour l'équipe.
5. Intégrer les polices en local (fonctionnement hors ligne).

## 8. Historique utile

- Le tableau Excel de l'assistante (chantiers Bingerville ADOHA et ADJIN) a servi de modèle pour les avances ; **ne pas créer les chantiers à la place de l'utilisateur** : il les crée lui-même dans l'app.
- Le site geisarl.com (LWS cPanel, Node.js) est en ligne et terminé ; voir `HEBERGEMENT-LWS.md` si besoin, mais ne pas y toucher sans demande.
