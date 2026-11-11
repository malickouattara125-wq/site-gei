# Le site GEI chez LWS

Le site est en ligne sur **https://geisarl.com** depuis le 11 novembre 2026.
Tableau de bord : **https://geisarl.com/admin**

> ⚠️ Ne donnez jamais vos mots de passe (LWS, cPanel, tableau de bord) dans une conversation, un e-mail ou un message WhatsApp.

---

## Comment c'est installé

| Élément | Réglage |
|---|---|
| Hébergement | LWS cPanel M2, serveur `web57.lws-hosting.com`, compte `c2904714c` |
| Code du site | dossier `site-gei` (copie Git du dépôt GitHub), **en dehors** de `public_html` |
| Serveur | cPanel → **Setup Node.js App** : Node.js 22, racine `site-gei/serveur`, fichier `server.js`, adresse `geisarl.com/`, mode Production |
| Variables | `FORCE_HTTPS=1`, `NODE_ENV=production` |
| HTTPS | Certificat Let's Encrypt (automatique) ; `public_html/.htaccess` redirige tout vers `https://` |
| Page par défaut LWS | renommée en `public_html/index-lws-defaut.html.bak` |
| Données | `site-gei/serveur/data/` (programmes, actualités, demandes, mot de passe) et `site-gei/serveur/uploads/` (photos envoyées) |

---

## Mettre à jour le site après une modification sur GitHub

1. cPanel → **Git™ Version Control** → **Manage** à côté de `site-gei` → onglet **Pull or Deploy** → **Update from Remote**.
2. cPanel → **Setup Node.js App** → bouton **Restart** à côté de `geisarl.com/`.

Les données (programmes modifiés, demandes, photos) ne sont **pas** effacées par une mise à jour.

## Sauvegarder les données (une fois par mois)

cPanel → **Gestionnaire de fichiers** → clic droit sur `site-gei/serveur/data` → **Compress** → téléchargez le fichier.
Faites de même pour `site-gei/serveur/uploads` (s'il existe).

## En cas de problème

| Ce que vous voyez | Que faire |
|---|---|
| Page d'erreur ou page blanche | cPanel → **Setup Node.js App** → **Restart**. |
| Page « Bravo ! Votre domaine… » de LWS | Quelqu'un a remis un fichier `index.html` dans `public_html` : supprimez-le. |
| Le tableau de bord refuse le mot de passe | Après 5 erreurs, il faut attendre 15 minutes. |
| Mot de passe du tableau de bord oublié | Gestionnaire de fichiers : supprimez `site-gei/serveur/data/admin.json`, puis **Restart**. Un nouveau mot de passe est écrit dans `site-gei/serveur/data/premier-acces.txt`. |
