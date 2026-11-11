# Mettre le site GEI en ligne chez LWS

Ce guide est fait pour quelqu'un qui n'est **pas informaticien**. Suivez les étapes dans l'ordre.
Comptez environ 30 minutes. À la fin, envoyez l'adresse du site à Claude pour qu'il vérifie tout.

> ⚠️ **Ne donnez jamais vos mots de passe** (LWS, tableau de bord) dans une conversation, un e-mail ou un message WhatsApp.

---

## ⭐ Méthode automatique (recommandée) : 5 informations à ranger, une seule fois

Avec cette méthode, **vous ne touchez pas au cPanel** : GitHub envoie le site chez LWS et l'active tout seul,
puis le remet à jour automatiquement à chaque modification.

### 1. Trouver vos informations chez LWS
Dans votre **Espace client LWS**, ouvrez votre hébergement. Notez :
- le **nom du serveur** cPanel (par exemple `xxxx.lws-hosting.com`, visible dans l'adresse du cPanel ou dans les informations FTP) ;
- l'**identifiant cPanel** ;
- le **mot de passe cPanel** ;
- votre **nom de domaine** (sans `https://` ni `www`, par exemple `gei-ci.com`).

### 2. Les ranger dans le coffre-fort de GitHub
1. Ouvrez https://github.com/malickouattara125-wq/site-gei/settings/secrets/actions
2. Pour chaque ligne ci-dessous, cliquez sur **New repository secret**, écrivez le **Name** exactement comme indiqué, collez la valeur, puis **Add secret** :

| Name | Valeur |
|---|---|
| `LWS_HOST` | le nom du serveur cPanel |
| `LWS_USER` | l'identifiant cPanel |
| `LWS_PASSWORD` | le mot de passe cPanel |
| `LWS_DOMAIN` | votre nom de domaine |
| `ADMIN_PASSWORD` | le mot de passe que vous voulez pour le tableau de bord (12 caractères ou plus, notez-le) |

Personne ne peut relire ces valeurs, pas même Claude : GitHub les utilise seulement pour la mise en ligne.

### 3. C'est tout
Dites à Claude « c'est rangé ». Il lance la mise en ligne, vérifie le site et corrige si besoin.

---

## Méthode manuelle (si la méthode automatique ne marche pas)

### Avant de commencer : la bonne offre

Le site a besoin de **Node.js** pour faire marcher le tableau de bord et enregistrer les demandes des clients.
Chez LWS, Node.js est disponible sur les hébergements **cPanel L, XL, 2XL, 3XL** (et CloudCP).

- Vérifiez sur lws.fr, dans la description de l'offre, la mention **« Node.js »**.
- Avec une offre plus petite, le site s'affiche, mais **sans** tableau de bord ni enregistrement des demandes.

Il vous faut aussi un **nom de domaine** (par exemple `gei-ci.com`), relié à l'hébergement. LWS le fait automatiquement si vous l'achetez avec l'offre.

---

### Étape 1 · Ouvrir le cPanel

1. Connectez-vous sur **lws.fr** → **Espace client**.
2. Cliquez sur votre hébergement, puis sur le bouton **cPanel**.

Toutes les étapes suivantes se font dans le cPanel.

---

### Étape 2 · Activer le cadenas HTTPS (certificat SSL gratuit)

1. Dans l'espace client LWS (ou dans le cPanel), cherchez **« SSL »** ou **« Let's Encrypt »**.
2. Activez le certificat **gratuit** pour votre domaine (avec et sans `www`).
3. Si une option **« Forcer HTTPS »** ou **« Rediriger vers HTTPS »** existe, activez-la.

L'activation peut prendre jusqu'à une heure. Vous pouvez continuer en attendant.

---

### Étape 3 · Copier le site depuis GitHub

1. Dans le cPanel, cherchez **« Git™ Version Control »** et ouvrez-le.
2. Cliquez sur **Create** (Créer).
3. Remplissez :
   | Champ | À écrire |
   |---|---|
   | **Clone a Repository** | activé |
   | **Clone URL** | `https://github.com/malickouattara125-wq/site-gei.git` |
   | **Repository Path** | `site-gei` |
   | **Repository Name** | `site-gei` |
4. Cliquez sur **Create**. Le site est copié dans le dossier `site-gei`.

> ❗ **Important :** le dossier doit être `site-gei`, **pas** `public_html/site-gei`.
> Le dossier `public_html` est visible par tout le monde : les données des clients ne doivent jamais s'y trouver.

*Si « Git Version Control » n'existe pas :* sur GitHub, bouton vert **Code** → **Download ZIP**.
Dans le cPanel, ouvrez le **Gestionnaire de fichiers**, créez le dossier `site-gei` à côté de `public_html` (pas dedans), envoyez-y le ZIP, puis faites **Extraire**.
Vérifiez qu'on trouve bien `site-gei/index.html` et `site-gei/serveur/server.js` (déplacez les fichiers si le ZIP a créé un sous-dossier).

---

### Étape 4 · Démarrer le serveur (Node.js)

1. Dans le cPanel, cherchez **« Setup Node.js App »** et ouvrez-le.
2. Cliquez sur **Create Application**.
3. Remplissez :
   | Champ | À choisir ou écrire |
   |---|---|
   | **Node.js version** | la plus récente proposée (au moins **18**) |
   | **Application mode** | `Production` |
   | **Application root** | `site-gei/serveur` |
   | **Application URL** | votre domaine (laisser la fin vide) |
   | **Application startup file** | `server.js` |
4. Dans **Environment variables**, cliquez sur **Add variable** et ajoutez ces deux lignes :
   | Nom | Valeur |
   |---|---|
   | `ADMIN_PASSWORD` | un mot de passe **à vous**, d'au moins 12 caractères (notez-le sur papier) |
   | `FORCE_HTTPS` | `1` |
5. Cliquez sur **Create**, puis sur **Restart** (Redémarrer).

Il n'y a **rien à installer** (pas besoin du bouton « Run NPM Install ») : le serveur n'utilise aucune bibliothèque.

---

### Étape 5 · Tester vous-même

1. Ouvrez `https://votre-domaine` : la page d'accueil GEI doit s'afficher, avec le cadenas 🔒.
2. Ouvrez `https://votre-domaine/admin` :
   - Identifiant : `admin`
   - Mot de passe : celui que vous avez mis dans `ADMIN_PASSWORD`.
3. Dans **Mon compte**, changez le mot de passe une fois.
4. Sur le site, envoyez une demande de test avec le formulaire de contact, puis vérifiez qu'elle apparaît dans **Demandes**.

**Ensuite, envoyez simplement l'adresse du site à Claude.** Il vérifiera toutes les pages, le cadenas, la protection des données et le formulaire.

---

## Plus tard

### Mettre à jour le site après une modification
1. cPanel → **Git™ Version Control** → **Manage** à côté de `site-gei` → onglet **Pull or Deploy** → **Update from Remote**.
2. cPanel → **Setup Node.js App** → **Restart** à côté de l'application.

Vos données (programmes modifiés, demandes, photos envoyées) ne sont **pas** effacées par une mise à jour.

### Sauvegarder les données (une fois par mois)
Dans le **Gestionnaire de fichiers**, faites un clic droit sur `site-gei/serveur/data` puis **Compress**, et téléchargez le fichier. Faites de même pour `site-gei/serveur/uploads`.
Ces dossiers contiennent les demandes des clients, les modifications faites dans le tableau de bord et le mot de passe.

### En cas de problème
| Ce que vous voyez | Que faire |
|---|---|
| Page blanche ou « Incomplete response » | **Setup Node.js App** → **Restart**. Vérifiez que *Application root* est bien `site-gei/serveur`. |
| « Index of / » ou liste de fichiers | Le site a été mis dans `public_html` par erreur : reprenez l'étape 3. |
| Le tableau de bord refuse le mot de passe | Après 5 erreurs, il faut attendre 15 minutes. |
| Mot de passe oublié | Supprimez le fichier `site-gei/serveur/data/admin.json`, puis **Restart** : le mot de passe redevient celui de `ADMIN_PASSWORD`. |
