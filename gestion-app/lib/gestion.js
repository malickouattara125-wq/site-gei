// Module « Gestion GEI » : chantiers, maisons et clients, dépenses, ouvriers et pointages.
// Données privées, gardées dans data/ (jamais publiées sur le site). Montants en FCFA (entiers).
"use strict";

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const montant = (v) => { const x = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(x) && x >= 0 ? Math.round(x) : 0; };
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const pick = (v, list, def) => (list.includes(v) ? v : def);
const arr = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
const id = (v) => (/^[a-f0-9]{4,24}$/.test(String(v || "")) ? String(v) : "");
// Quantité chiffrée (sacs, tonnes, m³…) : nombre positif à 2 décimales, 0 si vide
const qteNum = (v) => { const x = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(x) && x > 0 ? Math.round(x * 100) / 100 : 0; };
const pct = (v) => Math.max(0, Math.min(100, Math.round(+v || 0) || 0));
const err = (msg) => Object.assign(new Error(msg), { status: 400 });
// Pièces jointes : fichiers privés enregistrés par /api/g/fichiers (jamais publics)
const docs = (v) => arr(v, 50).map((d) => ({ nom: str(d && d.nom, 120), fichier: str(d && d.fichier, 120), date: date(d && d.date) }))
  .filter((d) => /^[a-z0-9-]+\.(pdf|jpg|png|webp)$/.test(d.fichier));

const LISTES = {
  statutChantier: ["preparation", "en_cours", "pause", "termine"],
  statutMaison: ["disponible", "reservee", "vendue", "livree", "louee"],
  // 8 catégories : les 6 d'origine (mêmes clés, libellés renommés à l'écran) + sous-traitance et frais de chantier
  categorieDepense: ["materiaux", "main_oeuvre", "sous_traitance", "transport", "location", "frais_chantier", "administratif", "autre"],
  niveauVilla: ["gros_oeuvre", "cle_en_main"],
  gammeVilla: ["standard", "confort", "premium"],
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
      // Volet Construction : répartition des frais communs entre les villas du programme
      repartition: pick(b.repartition, ["egale", "surface"], "egale"),
      // Chantier de particulier (construction ou rénovation pour un client) : prix convenu, échéancier et versements du client
      nature: pick(b.nature, ["", "particulier"], ""), travaux: pick(b.travaux, ["construction", "renovation"], "construction"),
      clientTel: str(b.clientTel, 40), prix: montant(b.prix),
      echeancier: arr(b.echeancier, 60).map((e) => ({ date: date(e && e.date), libelle: str(e && e.libelle, 80), montant: montant(e && e.montant) })).filter((e) => e.montant),
      paiements: arr(b.paiements, 200).map((p) => ({ date: date(p && p.date), montant: montant(p && p.montant), mode: pick(p && p.mode, LISTES.modePaiement, "autre"), reference: str(p && p.reference, 80) })).filter((p) => p.montant),
    };
    if (!c.nom) throw err("Le nom du chantier est obligatoire.");
    return c;
  },
  maisons: (b) => {
    const m = {
      bien: pick(b.bien, ["maison", "magasin"], "maison"),
      programme: str(b.programme, 120), lot: str(b.lot, 40), type: str(b.type, 80), superficie: str(b.superficie, 40),
      prix: montant(b.prix), statut: pick(b.statut, LISTES.statutMaison, "disponible"), chantierId: id(b.chantierId),
      clientNom: str(b.clientNom, 120), clientTel: str(b.clientTel, 40), clientEmail: str(b.clientEmail, 120), clientPays: str(b.clientPays, 60),
      echeancier: arr(b.echeancier, 60).map((e) => ({ date: date(e && e.date), libelle: str(e && e.libelle, 80), montant: montant(e && e.montant) })).filter((e) => e.montant),
      paiements: arr(b.paiements, 200).map((p) => ({ date: date(p && p.date), montant: montant(p && p.montant), mode: pick(p && p.mode, LISTES.modePaiement, "autre"), reference: str(p && p.reference, 80) })).filter((p) => p.montant),
      notes: str(b.notes, 3000), documents: docs(b.documents),
    };
    if (!m.programme || !m.lot) throw err("Le programme (ou quartier) et le numéro du lot (ou nom du bien) sont obligatoires.");
    return m;
  },
  depenses: (b) => {
    const d = {
      date: date(b.date) || new Date().toISOString().slice(0, 10), chantierId: id(b.chantierId),
      categorie: pick(b.categorie, LISTES.categorieDepense, "autre"), libelle: str(b.libelle, 160), fournisseur: str(b.fournisseur, 120),
      quantite: str(b.quantite, 60), montant: montant(b.montant), mode: pick(b.mode, LISTES.modePaiement, "especes"),
      // Volet Construction : villa concernée, matériau acheté (quantité chiffrée + unité), destination (villa ou stock du chantier)
      villaId: id(b.villaId), articleId: id(b.articleId), qte: qteNum(b.qte), unite: str(b.unite, 20),
      destination: pick(b.destination, ["", "villa", "stock", "commun"], ""),
      notes: str(b.notes, 1000), documents: docs(b.documents),
    };
    // Paiements (avances puis solde). Anciennes dépenses sans liste : « payée » = payée en totalité à la date de la dépense.
    const liste = Array.isArray(b.paiements) ? b.paiements : (b.paye !== false && d.montant ? [{ date: d.date, montant: d.montant, mode: d.mode }] : []);
    d.paiements = arr(liste, 100).map((p) => ({ date: date(p && p.date) || d.date, montant: montant(p && p.montant), mode: pick(p && p.mode, LISTES.modePaiement, d.mode) })).filter((p) => p.montant);
    const verse = d.paiements.reduce((s, p) => s + p.montant, 0);
    if (d.montant && verse > d.montant) throw err("Les paiements dépassent le montant total de la dépense.");
    d.paye = d.montant > 0 && verse >= d.montant;
    if (!d.libelle) throw err("Le libellé de la dépense est obligatoire.");
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
    sens: pick(b.sens, ["entree", "sortie"], "sortie"), quantite: isFinite(q) && q > 0 ? Math.round(q * 100) / 100 : 0, notes: str(b.notes, 300),
    // Volet Construction : villa qui utilise le matériel (sortie), achat d'origine et prix unitaire (entrée depuis une dépense)
    villaId: id(b.villaId), depenseId: id(b.depenseId), prixUnitaire: montant(b.prixUnitaire) };
  if (!m.articleId) throw err("Choisissez l'article.");
  if (!m.quantite) throw err("La quantité doit être supérieure à 0.");
  return m;
};

/* ---------- Volet Construction : villas d'un programme ---------- */
// Modèle de phases appliqué automatiquement à chaque nouvelle villa (gros œuvre puis second œuvre et finitions)
const PHASES = [
  ["implantation", "Installation et implantation", "gros"], ["fondations", "Fondations", "gros"], ["elevation", "Élévation des murs", "gros"],
  ["dalle", "Dalle", "gros"], ["toiture", "Toiture", "gros"],
  ["menuiseries", "Menuiseries", "second"], ["plomberie", "Plomberie et électricité", "second"], ["enduits", "Enduits et faux plafonds", "second"],
  ["carrelage", "Carrelage et peinture", "second"], ["remise", "Sanitaires, nettoyage et remise des clés", "second"],
];
const photo = (p) => ({ src: str(p && p.src, 300), date: date(p && p.date), legende: str(p && p.legende, 120) });
COLLECTIONS.villas = (b) => {
  const recues = Array.isArray(b.phases) ? b.phases : [];
  const v = {
    chantierId: id(b.chantierId), lot: str(b.lot, 40), type: str(b.type, 80), surface: qteNum(b.surface),
    niveau: pick(b.niveau, LISTES.niveauVilla, "cle_en_main"), gamme: pick(b.gamme, LISTES.gammeVilla, "standard"),
    budget: montant(b.budget), maisonId: id(b.maisonId),
    // Les 10 phases du modèle sont toujours présentes, dans le même ordre ; on garde l'avancement, les dates et les photos reçus
    phases: PHASES.map(([cle, nom, bloc]) => {
      const p = recues.find((x) => x && x.cle === cle) || {};
      return { cle, nom, bloc, avancement: pct(p.avancement), dateDebut: date(p.dateDebut), dateFin: date(p.dateFin),
        photos: arr(p.photos, 100).map(photo).filter((x) => /^(uploads|assets\/img)\//.test(x.src)) };
    }),
    finitions: arr(b.finitions, 80).map((f) => ({ poste: str(f && f.poste, 80), choix: str(f && f.choix, 200), option: !!(f && f.option), surcout: montant(f && f.surcout) })).filter((f) => f.poste),
    notes: str(b.notes, 3000), documents: docs(b.documents),
  };
  if (!v.chantierId) throw err("Choisissez le programme de la villa.");
  if (!v.lot) throw err("Le numéro de lot de la villa est obligatoire (ex. A01).");
  return v;
};

// Contrats : location de maison, travail (personnel), ouvrier / tâcheron, autre
LISTES.typeContrat = ["location", "travail", "ouvrier", "autre"];
LISTES.statutContrat = ["brouillon", "actif", "termine", "resilie"];
COLLECTIONS.contrats = (b) => {
  const c = {
    type: pick(b.type, LISTES.typeContrat, "autre"), statut: pick(b.statut, LISTES.statutContrat, "brouillon"),
    reference: str(b.reference, 40), titre: str(b.titre, 160),
    partie: str(b.partie, 120), partieTel: str(b.partieTel, 40), partieAdresse: str(b.partieAdresse, 200),
    partiePiece: str(b.partiePiece, 80), partieNaissance: str(b.partieNaissance, 120), metier: str(b.metier, 60),
    objet: str(b.objet, 300), lieu: str(b.lieu, 120), chantierId: id(b.chantierId), maisonId: id(b.maisonId),
    contratType: str(b.contratType, 40), dateSignature: date(b.dateSignature), dateDebut: date(b.dateDebut), dateFin: date(b.dateFin),
    essai: str(b.essai, 60), montant: montant(b.montant), periodicite: pick(b.periodicite, ["mensuel", "unique", "journalier", "hebdomadaire", "trimestriel"], "mensuel"),
    caution: montant(b.caution), avance: montant(b.avance), delai: str(b.delai, 80),
    paiements: arr(b.paiements, 400).map((p) => ({ date: date(p && p.date), montant: montant(p && p.montant), mode: pick(p && p.mode, LISTES.modePaiement, "especes"), libelle: str(p && p.libelle, 120),
      nature: pick(p && p.nature, ["loyer", "caution", "salaire", "avance", "autre"], ""), mois: /^\d{4}-\d{2}$/.test(String((p && p.mois) || "")) ? p.mois : "" })).filter((p) => p.montant),
    texte: str(b.texte, 60000), documents: docs(b.documents), notes: str(b.notes, 3000),
  };
  if (!c.partie) throw err("Indiquez le nom de l'autre partie (locataire, salarié, ouvrier…).");
  return c;
};
// Modèles de contrat (texte par défaut de chaque type, modifiable par la direction)
COLLECTIONS.modeles = (b) => {
  const m = { type: pick(b.type, LISTES.typeContrat, "autre"), metier: str(b.metier, 60), titre: str(b.titre, 160), texte: str(b.texte, 60000) };
  if (!m.texte) throw err("Le texte du modèle est vide.");
  return m;
};

// Import depuis Excel (CSV) : une ligne = un élément ; « montantPaye » crée un paiement de reprise
function depuisImport(nom, row) {
  if (nom === "maisons") {
    const paye = montant(row.montantPaye);
    return { ...row, paiements: paye ? [{ date: date(row.datePaiement) || new Date().toISOString().slice(0, 10), montant: paye, mode: "autre", reference: "Reprise Excel" }] : [] };
  }
  if (nom === "depenses") {
    const total = montant(row.montant), avance = montant(row.avance);
    const toutPaye = /^(oui|yes|1|true|x)$/i.test(String(row.paye || "").trim());
    const verse = avance ? Math.min(avance, total || avance) : (toutPaye ? total : 0);
    return { ...row, paiements: verse ? [{ date: date(row.date) || new Date().toISOString().slice(0, 10), montant: verse, mode: row.mode }] : [] };
  }
  if (nom === "ouvriers") return { ...row, actif: !/^(non|no|0|false)$/i.test(String(row.actif || "oui").trim()) };
  // Contrat de location repris d'Excel : caution + loyers payés mois par mois (colonnes m01 à m12 = janvier à décembre de l'année « annee »)
  if (nom === "contrats") {
    const annee = /^\d{4}$/.test(String(row.annee || "")) ? String(row.annee) : String(new Date().getFullYear());
    const debut = date(row.dateDebut), fin = date(row.dateFin), auj = new Date().toISOString().slice(0, 10);
    const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    const paiements = [];
    const caution = montant(row.caution);
    if (caution) paiements.push({ date: debut || auj, montant: caution, mode: row.mode, nature: "caution", libelle: "Caution (reprise Excel)" });
    for (let i = 1; i <= 12; i++) {
      const v = montant(row["m" + String(i).padStart(2, "0")]);
      if (v) paiements.push({ date: `${annee}-${String(i).padStart(2, "0")}-05`, montant: v, mode: row.mode, nature: "loyer", mois: `${annee}-${String(i).padStart(2, "0")}`, libelle: `Loyer de ${MOIS[i - 1]} ${annee} (reprise Excel)` });
    }
    return { ...row, type: "location", statut: fin && fin < auj ? "termine" : "actif", periodicite: "mensuel", caution, paiements };
  }
  return row;
}

module.exports = { COLLECTIONS, LISTES, PHASES, depuisImport };
