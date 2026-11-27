# Mettre GEI Gestion en ligne sur gestion.geisarl.com (cPanel LWS)

Durée : environ 15 minutes. Le site geisarl.com n'est **pas** modifié.

> ⚠️ Ne donnez jamais vos mots de passe (LWS, cPanel, application) dans une conversation ou un message.

---

## Étape 1 — Récupérer la dernière version

1. Connectez-vous à **cPanel**.
2. Cliquez sur **Git™ Version Control**.
3. À côté de `site-gei`, cliquez sur **Manage**.
4. Vérifiez la ligne **Checked-Out Branch** : elle doit indiquer `claude/gifted-meitner-sl86x9`.
   *Si ce n'est pas le cas, arrêtez-vous et prévenez Claude.*
5. Onglet **Pull or Deploy** → bouton **Update from Remote**.
6. Contrôle : **Gestionnaire de fichiers** → ouvrez `site-gei`. Le dossier **`gestion-app`** doit être là.

## Étape 2 — Créer le sous-domaine

1. cPanel → **Domaines** (ou **Sous-domaines**).
2. **Créer un nouveau domaine** (ou **Créer**).
3. Domaine : **`gestion.geisarl.com`**.
4. Laissez la racine du document proposée (par exemple `public_html/gestion` ou `gestion.geisarl.com`).
5. Cliquez sur **Créer**.

## Étape 3 — Lancer l'application

1. cPanel → **Setup Node.js App** → **Create Application**.
2. Remplissez :

| Champ | Valeur |
|---|---|
| Node.js version | **22** (la même que le site) |
| Application mode | **Production** |
| Application root | **`site-gei/gestion-app`** |
| Application URL | choisissez **`gestion.geisarl.com`**, laissez la case d'après vide |
| Application startup file | **`server.js`** |

3. **Environment variables** → **Add Variable** :
   - Nom `FORCE_HTTPS`, valeur `1`

   ⛔ N'ajoutez **jamais** la variable `GEI_LOCAL` en ligne.
4. Cliquez sur **Create**. *(Pas besoin de « Run NPM Install » : l'application n'a aucune bibliothèque.)*

## Étape 4 — Activer le cadenas HTTPS

1. cPanel → **SSL/TLS Status**.
2. Cochez `gestion.geisarl.com` → **Run AutoSSL**. Attendez quelques minutes que la ligne passe au vert.
3. Si cPanel propose **Force HTTPS Redirect** dans **Domaines**, activez-le pour `gestion.geisarl.com`.

## Étape 5 — Première connexion

1. Ouvrez **https://gestion.geisarl.com** : la page de connexion s'affiche.
2. Dans le **Gestionnaire de fichiers**, ouvrez `site-gei/gestion-app/data/premier-acces.txt` : il contient l'identifiant (`admin`) et le mot de passe de départ.
3. Connectez-vous, puis **Mon compte** → changez le mot de passe tout de suite.
4. Supprimez le fichier `premier-acces.txt`.
5. **Mon compte** → créez les comptes du comptable et des chefs de chantier (un compte par personne).

Sur téléphone, ouvrez l'adresse dans Chrome, puis **⋮** → **Ajouter à l'écran d'accueil** : l'application s'ouvre comme une appli.

---

## Mettre à jour l'application en ligne

1. cPanel → **Git™ Version Control** → **Manage** (`site-gei`) → **Pull or Deploy** → **Update from Remote**.
2. cPanel → **Setup Node.js App** → **Restart** à côté de `gestion.geisarl.com`.

Les données ne sont pas effacées par une mise à jour.

## Sauvegarder les données (une fois par semaine)

- Le plus simple : **Mon compte** → **Télécharger la sauvegarde** (compte DG).
- Ou bien dans le Gestionnaire de fichiers : clic droit sur `site-gei/gestion-app/data` → **Compress** → téléchargez le fichier. Faites de même pour `uploads` (photos) et `fichiers` (documents).

## En cas de problème

| Ce que vous voyez | Que faire |
|---|---|
| Page d'erreur ou page blanche | **Setup Node.js App** → **Restart** à côté de `gestion.geisarl.com`. |
| Pas de cadenas / « non sécurisé » | Refaites l'étape 4, puis **Restart**. |
| Connexion refusée après 5 essais | Attendez 15 minutes. |
| Mot de passe du DG oublié | Gestionnaire de fichiers : supprimez `site-gei/gestion-app/data/admin.json`, puis **Restart**. Un nouveau mot de passe est écrit dans `data/premier-acces.txt`. Les autres données restent. |
