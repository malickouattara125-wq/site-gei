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

const LISTES = {
  statutChantier: ["preparation", "en_cours", "pause", "termine"],
  statutMaison: ["disponible", "reservee", "vendue", "livree"],
  categorieDepense: ["materiaux", "main_oeuvre", "transport", "location", "administratif", "autre"],
  modePaiement: ["especes", "virement", "cheque", "mobile_money", "autre"],
};

const COLLECTIONS = {
  chantiers: (b) => {
    const c = {
      nom: str(b.nom, 120), lieu: str(b.lieu, 80), client: str(b.client, 120), type: str(b.type, 80),
      budget: montant(b.budget), dateDebut: date(b.dateDebut), dateFin: date(b.dateFin),
      statut: pick(b.statut, LISTES.statutChantier, "en_cours"),
      etapes: arr(b.etapes, 30).map((e) => ({ nom: str(e && e.nom, 80), avancement: Math.max(0, Math.min(100, Math.round(+((e && e.avancement) || 0)) || 0)) })).filter((e) => e.nom),
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
      notes: str(b.notes, 3000),
    };
    if (!m.programme || !m.lot) throw err("Le programme et le numéro du lot sont obligatoires.");
    return m;
  },
  depenses: (b) => {
    const d = {
      date: date(b.date) || new Date().toISOString().slice(0, 10), chantierId: id(b.chantierId),
      categorie: pick(b.categorie, LISTES.categorieDepense, "autre"), libelle: str(b.libelle, 160), fournisseur: str(b.fournisseur, 120),
      quantite: str(b.quantite, 30), montant: montant(b.montant), mode: pick(b.mode, LISTES.modePaiement, "especes"),
      paye: b.paye !== false, notes: str(b.notes, 1000),
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

module.exports = { COLLECTIONS, LISTES };
