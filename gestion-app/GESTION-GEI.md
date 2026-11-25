# GEI Gestion — mode d'emploi

Application **indépendante du site internet** (projet, hébergement et connexion séparés),
pour gérer l'entreprise : chantiers, planning, maisons et clients, dépenses, trésorerie, stock,
ouvriers et paie. Elle a sa propre connexion. Ses données ne sont **jamais** affichées sur le site public.

| Application | Adresse | Sert à |
|---|---|---|
| Tableau de bord du site | geisarl.com/admin | Modifier le site (programmes, actualités, photos…) — DG uniquement |
| **GEI Gestion** | sur son propre hébergement (ex. gestion.geisarl.com), ou http://localhost:8780 sur l'ordinateur | Gérer l'entreprise — DG, comptable, chefs de chantier |

Installation et hébergement : voir [README.md](README.md).

## Les comptes
| Compte | Voit et fait |
|---|---|
| **DG** (compte principal `admin`) | Tout ; crée les comptes et télécharge la sauvegarde |
| **Comptable** | Tout GEI Gestion, sauf les comptes et la sauvegarde |
| **Chef de chantier** | Chantiers (avancement, photos, notes), planning, pointage des ouvriers, entrées et sorties de stock. **Ne voit aucun montant** (budgets, ventes, dépenses, salaires) |

Créer un compte : **Mon compte** → « Comptes d'accès » → identifiant, mot de passe, rôle → **Créer le compte**.

## Au quotidien
| Je veux… | Où |
|---|---|
| Voir l'essentiel (argent, retards, budgets) | **Tableau de gestion** |
| Créer un chantier, mettre à jour l'avancement, ajouter des photos | **Chantiers** → le chantier → « Étapes et avancement » |
| Prévoir les dates de chaque étape | Le chantier → dates « Début prévu » et « Fin prévue » de chaque étape → voir **Planning** (retards en rouge) |
| Joindre un plan, un contrat, une facture (PDF ou photo) | Bloc **Documents** du chantier, de la maison ou de la dépense |
| Enregistrer un achat ou un frais de chantier | **Dépenses** → « + Nouvelle dépense » (« Enregistrer et en saisir une autre » pour aller vite) |
| Enregistrer une vente ou un paiement client | **Maisons et clients** → la maison → « + Enregistrer un paiement » |
| Imprimer un reçu pour le client | La maison → « Reçus » → cliquer sur le paiement → **Imprimer / enregistrer en PDF** |
| Relancer un client en retard | La maison → bouton **Relancer sur WhatsApp** (message déjà rédigé) |
| Prévoir les versements d'un client | La maison → « Échéancier prévu » (les retards s'affichent tout seuls) |
| Enregistrer le loyer, le carburant, les salaires du personnel fixe… | **Trésorerie** → « + Autre opération » |
| Voir l'argent disponible (caisse, banque, Mobile Money) | **Trésorerie** |
| Suivre le ciment, le fer, le sable… | **Stock de matériaux** (alerte quand le stock passe sous le seuil) |
| Noter les ouvriers présents | **Équipes et paie** → « Pointage du jour » |
| Calculer et enregistrer la paie de la semaine | **Équipes et paie** → « Paie de la semaine » → « Paie versée : l'enregistrer dans la caisse » |
| Résumé du mois pour la direction | **Rapport mensuel** → **Imprimer / PDF** |
| Ouvrir une liste dans Excel | Bouton **Exporter (Excel)** en haut de chaque liste |

**Bon à savoir :**
- Le coût d'un chantier = ses dépenses **+** la paie des ouvriers pointés sur ce chantier.
- **Dépenses avec avance** : indiquez le montant total, puis chaque avance versée (« + Ajouter une avance »). Le **reste à payer** se calcule tout seul, par dépense, par chantier et sur le tableau de gestion. « Payer le reste » enregistre le solde. Un achat dont le prix n'est pas encore connu peut être saisi sans montant.
- La trésorerie se remplit toute seule avec les paiements des clients et les avances et paiements des dépenses. Au départ, enregistrez une fois le **solde de départ** de chaque compte (caisse, banque, Mobile Money).

## Reprendre les fichiers Excel existants
1. Dans Excel : **Fichier** → **Enregistrer sous** → type **« CSV (séparateur : point-virgule) »**.
2. **Importer (Excel)** → choisir le type (maisons et clients, dépenses, ouvriers, chantiers) et le fichier.
3. Vérifier que les colonnes sont bien reconnues, puis **Importer**. Les lignes incomplètes sont signalées avec leur numéro.

Pour les maisons, la colonne « Déjà payé » crée un paiement « Reprise Excel » du montant total déjà versé.

## Sauvegarde (une fois par mois)
- **Mon compte** → « Sauvegarde de la gestion » → **Télécharger la sauvegarde**. Gardez le fichier en lieu sûr (Google Drive, clé USB).
- Les photos de chantier (`uploads/`) et les documents joints (`fichiers/`) sont à sauvegarder aussi (copie des dossiers depuis l'hébergement).
