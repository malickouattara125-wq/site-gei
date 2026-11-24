// Module « Gestion GEI » : chantiers, maisons et clients, dépenses, ouvriers et pointages.
// Données privées, gardées dans data/ (jamais publiées sur le site). Montants en FCFA (entiers).
"use strict";

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const montant = (v) => { const x = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(x) && x >= 0 ? Math.round(x) : 0; };
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const pick = (v, list, def) => (list.includes(v) ? v : def);
const arr = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
const id = (v) => (/^[a-f0-9]{4,24}$/.test(String(v || "")) ? String(v) : "");
const err = (msg) => Object.assign(new Error(msg), { status: 400 });
// Pièces jointes : fichiers privés enregistrés par /api/g/fichiers (jamais publics)
const docs = (v) => arr(v, 50).map((d) => ({ nom: str(d && d.nom, 120), fichier: str(d && d.fichier, 120), date: date(d && d.date) }))
  .filter((d) => /^[a-z0-9-]+\.(pdf|jpg|png|webp)$/.test(d.fichier));

const LISTES = {
  statutChantier: ["preparation", "en_cours", "pause", "termine"],
  statutMaison: ["disponible", "reservee", "vendue", "livree"],
  categorieDepense: ["materiaux", "main_oeuvre", "transport", "location", "administratif", "autre"],
  modePaiement: ["especes", "virement", "cheque", "mobile_money", "autre"],
  compte: ["caisse", "banque", "mobile_money"],
  categorieMouvement: ["solde_initial", "apport", "vente_autre", "frais_generaux", "salaires", "loyer", "carburant", "impots", "banque", "autre"],
};

const COLLECTIONS = {
  chantiers: (b) => {
    const c = {
      nom: str(b.nom, 120), lieu: str(b.lieu, 80), client: str(b.client, 120), type: str(b.type, 80),
      budget: montant(b.budget), dateDebut: date(b.dateDebut), dateFin: date(b.dateFin),
      statut: pick(b.statut, LISTES.statutChantier, "en_cours"),
      etapes: arr(b.etapes, 30).map((e) => ({ nom: str(e && e.nom, 80), avancement: Math.max(0, Math.min(100, Math.round(+((e && e.avancement) || 0)) || 0)), dateDebut: date(e && e.dateDebut), dateFin: date(e && e.dateFin) })).filter((e) => e.nom),
      documents: docs(b.documents),
      photos: arr(b.photos, 200).map((p) => ({ src: str(p && p.src, 300), date: date(p && p.date), legende: str(p && p.legende, 120) })).filter((p) => /^(uploads|assets\/img)\//.test(p.src)),
      notes: str(b.notes, 3000),
    };
    if (!c.nom) throw err("Le nom du chantier est obligatoire.");
    return c;
  },
  maisons: (b) => {
    const m = {
      programme: str(b.programme, 120), lot: str(b.lot, 40), type: str(b.type, 80), superficie: str(b.superficie, 40),
      prix: montant(b.prix), statut: pick(b.statut, LISTES.statutMaison, "disponible"), chantierId: id(b.chantierId),
      clientNom: str(b.clientNom, 120), clientTel: str(b.clientTel, 40), clientEmail: str(b.clientEmail, 120), clientPays: str(b.clientPays, 60),
      echeancier: arr(b.echeancier, 60).map((e) => ({ date: date(e && e.date), libelle: str(e && e.libelle, 80), montant: montant(e && e.montant) })).filter((e) => e.montant),
      paiements: arr(b.paiements, 200).map((p) => ({ date: date(p && p.date), montant: montant(p && p.montant), mode: pick(p && p.mode, LISTES.modePaiement, "autre"), reference: str(p && p.reference, 80) })).filter((p) => p.montant),
      notes: str(b.notes, 3000), documents: docs(b.documents),
    };
    if (!m.programme || !m.lot) throw err("Le programme et le numéro du lot sont obligatoires.");
    return m;
  },
  depenses: (b) => {
    const d = {
      date: date(b.date) || new Date().toISOString().slice(0, 10), chantierId: id(b.chantierId),
      categorie: pick(b.categorie, LISTES.categorieDepense, "autre"), libelle: str(b.libelle, 160), fournisseur: str(b.fournisseur, 120),
      quantite: str(b.quantite, 30), montant: montant(b.montant), mode: pick(b.mode, LISTES.modePaiement, "especes"),
      paye: b.paye !== false, notes: str(b.notes, 1000), documents: docs(b.documents),
    };
    if (!d.libelle) throw err("Le libellé de la dépense est obligatoire.");
    if (!d.montant) throw err("Le montant doit être supérieur à 0.");
    return d;
  },
  ouvriers: (b) => {
    const o = { nom: str(b.nom, 120), tel: str(b.tel, 40), metier: str(b.metier, 60), tarifJour: montant(b.tarifJour), chantierId: id(b.chantierId), actif: b.actif !== false, notes: str(b.notes, 1000) };
    if (!o.nom) throw err("Le nom de l'ouvrier est obligatoire.");
    return o;
  },
  pointages: (b) => {
    const p = { date: date(b.date), chantierId: id(b.chantierId), presents: [...new Set(arr(b.presents, 500).map(id).filter(Boolean))], notes: str(b.notes, 1000) };
    if (!p.date || !p.chantierId) throw err("La date et le chantier sont obligatoires.");
    return p;
  },
};

// Trésorerie : opérations hors chantiers et hors ventes (frais généraux, salaires du personnel fixe, apports…)
COLLECTIONS.mouvements = (b) => {
  const m = { date: date(b.date) || new Date().toISOString().slice(0, 10), sens: pick(b.sens, ["entree", "sortie"], "sortie"),
    compte: pick(b.compte, LISTES.compte, "caisse"), categorie: pick(b.categorie, LISTES.categorieMouvement, "autre"),
    libelle: str(b.libelle, 160), montant: montant(b.montant), reference: str(b.reference, 80), notes: str(b.notes, 1000), documents: docs(b.documents) };
  if (!m.libelle) throw err("Le libellé est obligatoire.");
  if (!m.montant) throw err("Le montant doit être supérieur à 0.");
  return m;
};
// Stock de matériaux : articles et mouvements (entrées / sorties par chantier)
COLLECTIONS.articles = (b) => {
  const a = { nom: str(b.nom, 100), unite: str(b.unite, 20) || "unité", seuil: Math.max(0, +b.seuil || 0), prixUnitaire: montant(b.prixUnitaire), notes: str(b.notes, 500) };
  if (!a.nom) throw err("Le nom de l'article est obligatoire.");
  return a;
};
COLLECTIONS.stock = (b) => {
  const q = parseFloat(String(b.quantite || "").replace(",", "."));
  const m = { date: date(b.date) || new Date().toISOString().slice(0, 10), articleId: id(b.articleId), chantierId: id(b.chantierId),
    sens: pick(b.sens, ["entree", "sortie"], "sortie"), quantite: isFinite(q) && q > 0 ? Math.round(q * 100) / 100 : 0, notes: str(b.notes, 300) };
  if (!m.articleId) throw err("Choisissez l'article.");
  if (!m.quantite) throw err("La quantité doit être supérieure à 0.");
  return m;
};

// Import depuis Excel (CSV) : une ligne = un élément ; « montantPaye » crée un paiement de reprise
function depuisImport(nom, row) {
  if (nom === "maisons") {
    const paye = montant(row.montantPaye);
    return { ...row, paiements: paye ? [{ date: date(row.datePaiement) || new Date().toISOString().slice(0, 10), montant: paye, mode: "autre", reference: "Reprise Excel" }] : [] };
  }
  if (nom === "depenses") return { ...row, paye: !/^(non|no|0|false)$/i.test(String(row.paye || "oui").trim()) };
  if (nom === "ouvriers") return { ...row, actif: !/^(non|no|0|false)$/i.test(String(row.actif || "oui").trim()) };
  return row;
}

module.exports = { COLLECTIONS, LISTES, depuisImport };
