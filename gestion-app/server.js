// GEI Gestion — application de gestion de Global Empire Immobilier (séparée du site internet).
// Aucune dépendance : uniquement Node.js (version 18 ou plus).
// Démarrer :  node server.js   puis ouvrir http://localhost:8780
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const store = require("./lib/store");
const auth = require("./lib/auth");
const gestion = require("./lib/gestion");
const xlsx = require("./lib/xlsx");

const PORT = +process.env.PORT || 8780;
const PUBLIC = path.join(__dirname, "public");
// Emplacement des données : voir lib/store.js (Documents\GEI-Gestion-Donnees sur un PC Windows, à côté de l'appli en ligne)
const UPLOADS = store.UPLOADS;     // photos de chantier (accès réservé aux comptes)
const FICHIERS = store.FICHIERS;   // pièces jointes (factures, contrats…)
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(FICHIERS, { recursive: true });

// Coordonnées imprimées sur les reçus (modifiables par variables d'environnement)
const ENTREPRISE = {
  nom: process.env.ENTREPRISE_NOM || "Global Empire Immobilier SARL",
  adresse: process.env.ENTREPRISE_ADRESSE || "Cocody, Cité des Arts (derrière la banque NSIA), Abidjan",
  telephones: (process.env.ENTREPRISE_TELEPHONES || "07 09 71 85 30, 07 04 75 53 06, 07 08 62 30 38").split(",").map((s) => s.trim()),
  email: process.env.ENTREPRISE_EMAIL || "contact@gei-sarl.ci",
  // Pied de page des contrats (coordonnées légales de GEI)
  pied: {
    activite: "Génie civil & BTP",
    siege: process.env.ENTREPRISE_SIEGE || "Cocody Cité des Arts",
    banque: process.env.ENTREPRISE_BANQUE || "N° du Compte Bancaire NSIA : 061822102201",
    rccm: process.env.ENTREPRISE_RCCM || "CI-ABJ-03-2023-B13-00068",
    tel: process.env.ENTREPRISE_TEL_CONTRAT || "(+225) 07 76 39 32 37 / 07 09 71 85 30",
    email: process.env.ENTREPRISE_EMAIL_CONTRAT || "laurentopulentangaman@gmail.com",
  },
};

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf", ".webmanifest": "application/manifest+json; charset=utf-8",
};

auth.ensureAdmin();

// Volet Construction : un achat de matériau envoyé « au stock du chantier » crée son entrée de stock,
// la met à jour si l'achat change, et la retire si l'achat est supprimé ou envoyé ailleurs.
function stockDepuisAchat(dep, supprime) {
  if (!dep || !dep.id) return;
  const stock = store.load("g-stock", []);
  const ancien = stock.find((s) => s.depenseId === dep.id);
  const reste = stock.filter((s) => s.depenseId !== dep.id);
  const garder = !supprime && dep.destination === "stock" && dep.articleId && dep.qte > 0;
  if (garder) {
    reste.push({ id: ancien ? ancien.id : crypto.randomBytes(6).toString("hex"), date: dep.date, articleId: dep.articleId, chantierId: dep.chantierId || "", villaId: "",
      sens: "entree", quantite: dep.qte, notes: `Achat : ${dep.libelle || ""}`.slice(0, 300), depenseId: dep.id,
      prixUnitaire: dep.montant && dep.qte ? Math.round(dep.montant / dep.qte) : 0, creePar: (ancien && ancien.creePar) || dep.creePar || "", creeLe: (ancien && ancien.creeLe) || new Date().toISOString() });
  }
  if (garder || ancien) store.save("g-stock", reste);
}
// Au démarrage : les achats déjà envoyés au stock reçoivent leur entrée s'ils n'en ont pas encore
for (const dep of store.load("g-depenses", [])) if (dep.destination === "stock" && dep.articleId && dep.qte > 0 && !store.load("g-stock", []).some((s) => s.depenseId === dep.id)) stockDepuisAchat(dep);

/* ---------------- Outils ---------------- */
const LOCAL = /^(127\.|::1$|::ffff:127\.)/;
function ip(req) {
  const direct = req.socket.remoteAddress || "";
  const fwd = (req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return LOCAL.test(direct) && fwd.length ? fwd[fwd.length - 1] : direct;
}
const isHttps = (req) => process.env.FORCE_HTTPS === "1" || req.headers["x-forwarded-proto"] === "https" || req.headers["x-forwarded-ssl"] === "on";
function cookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((c) => { const i = c.indexOf("="); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}
const HEADERS = { ...(process.env.FORCE_HTTPS === "1" ? { "Strict-Transport-Security": "max-age=31536000" } : {}), "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY", "X-Robots-Tag": "noindex, nofollow" };
function send(res, status, body, type = "text/html; charset=utf-8", extra = {}) { res.writeHead(status, { "Content-Type": type, ...HEADERS, ...extra }); res.end(body); }
const json = (res, status, data, extra) => send(res, status, JSON.stringify(data), "application/json; charset=utf-8", { "Cache-Control": "no-store", ...extra });
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error("Fichier trop lourd"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(Object.assign(new Error("Données invalides"), { status: 400 })); } });
    req.on("error", reject);
  });
}
function sendFile(res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Introuvable", "text/plain; charset=utf-8");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": cache || "no-cache", ...HEADERS });
    fs.createReadStream(file).pipe(res);
  });
}
function safeJoin(root, name) {
  if (!/^[\w.-]+$/.test(name) || name.startsWith(".")) return null;
  const full = path.join(root, name);
  return full.startsWith(root + path.sep) ? full : null;
}
// Utilisation sur l'ordinateur (lanceur DEMARRER, variable GEI_LOCAL=1) : connexion automatique du DG,
// uniquement pour les requêtes venant de cet ordinateur lui-même (jamais via un relais ni depuis Internet).
function sessionLocale(req) {
  // Jamais en ligne : hébergement cPanel (Passenger) ou mode production → mot de passe toujours obligatoire
  if (process.env.GEI_LOCAL !== "1" || process.env.NODE_ENV === "production" || process.env.PASSENGER_APP_ENV) return null;
  if (!LOCAL.test(req.socket.remoteAddress || "") || req.headers["x-forwarded-for"] || req.headers["x-real-ip"]) return null;
  const admin = store.load("admin", null);
  return admin ? { user: admin.user, role: "dg", locale: true } : null;
}
// Villas : une mise à jour qui n'envoie que certaines phases ne remet pas les autres à zéro (fusion par clé)
const fusionPhases = (avant, recues) => (Array.isArray(recues) ? (avant || []).map((p) => { const n = recues.find((x) => x && x.cle === p.cle); return n ? { ...p, ...n } : p; }).concat(recues.filter((x) => x && !(avant || []).some((p) => p.cle === x.cle))) : avant);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const id = () => crypto.randomBytes(6).toString("hex");

/* ---------------- API (toujours sous /api/g/) ---------------- */
async function api(req, res, pathname) {
  const method = req.method;
  const secure = isHttps(req) ? "; Secure" : "";

  if (pathname === "/api/g/login" && method === "POST") {
    const b = await readBody(req, 5000);
    const r = auth.login(ip(req), b.user, b.password);
    if (r.error) return json(res, 401, { error: r.error });
    return json(res, 200, { ok: true }, { "Set-Cookie": `gei_g=${r.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${auth.SESSION_HOURS * 3600}${secure}` });
  }
  const token = cookies(req).gei_g;
  const session = auth.check(token) || sessionLocale(req);
  if (!session) return json(res, 401, { error: "Non connecté" });
  if (method !== "GET" && req.headers["x-gei"] !== "1") return json(res, 403, { error: "Requête refusée" });

  if (pathname === "/api/g/logout" && method === "POST") { auth.logout(token); return json(res, 200, { ok: true }, { "Set-Cookie": "gei_g=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" }); }
  if (pathname === "/api/g/me") return json(res, 200, { user: session.user, role: session.role });
  if (pathname === "/api/g/password" && method === "POST") {
    const b = await readBody(req, 5000);
    const r = auth.changePassword(session.user, b.current, b.next);
    return r.error ? json(res, 400, r) : json(res, 200, { ok: true }, { "Set-Cookie": "gei_g=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (pathname === "/api/g/entreprise") return json(res, 200, ENTREPRISE);
  if (pathname === "/api/g/listes") return json(res, 200, gestion.LISTES);

  // Photos de chantier
  if (pathname === "/api/g/images" && method === "GET") return json(res, 200, fs.readdirSync(UPLOADS).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).reverse().map((f) => "uploads/" + f));
  if (pathname === "/api/g/upload" && method === "POST") {
    const b = await readBody(req, 12 * 1024 * 1024);
    const mm = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.data || "");
    if (!mm) return json(res, 400, { error: "Image invalide (JPEG, PNG ou WebP)." });
    const buf = Buffer.from(mm[2], "base64");
    if (!{ jpeg: /^ffd8ff/, png: /^89504e47/, webp: /^52494646/ }[mm[1]].test(buf.subarray(0, 4).toString("hex"))) return json(res, 400, { error: "Le fichier n'est pas une vraie image." });
    const d = new Date();
    const name = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${slugify(b.name || "photo").slice(0, 30) || "photo"}-${crypto.randomBytes(3).toString("hex")}.${mm[1] === "jpeg" ? "jpg" : mm[1]}`;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return json(res, 200, { src: `uploads/${name}` });
  }

  // Comptes (DG)
  if (pathname.startsWith("/api/g/comptes") && session.role !== "dg") return json(res, 403, { error: "Accès réservé au Directeur." });
  if (pathname === "/api/g/comptes" && method === "GET") return json(res, 200, { comptes: auth.listAccounts(), roles: auth.ROLES });
  if (pathname === "/api/g/comptes" && method === "POST") { const b = await readBody(req, 5000); const r = auth.addAccount(b.user, b.password, b.role); return r.error ? json(res, 400, r) : json(res, 200, r); }
  const mc = /^\/api\/g\/comptes\/([a-z0-9._-]{3,30})(\/password)?$/.exec(pathname);
  if (mc) {
    if (method === "DELETE" && !mc[2]) { const r = auth.removeAccount(mc[1]); return r.error ? json(res, 400, r) : json(res, 200, r); }
    if (method === "POST" && mc[2]) { const b = await readBody(req, 5000); const r = auth.resetPassword(mc[1], b.password); return r.error ? json(res, 400, r) : json(res, 200, r); }
    return json(res, 405, { error: "Méthode non permise" });
  }

  const chef = session.role === "chef";
  if (chef && /^\/api\/g\/(maisons|depenses|mouvements|import|sauvegarde|contrats|modeles|export)/.test(pathname)) return json(res, 403, { error: "Accès réservé à la direction et à la comptabilité." });

  // Export Excel (.xlsx natif) : le navigateur envoie le tableau affiché (mêmes filtres), le serveur fabrique le fichier
  if (pathname === "/api/g/export/xlsx" && method === "POST") {
    const b = await readBody(req, 8 * 1024 * 1024);
    const nom = (String(b.fichier || "GEI_Export").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "GEI_Export") + ".xlsx";
    const buf = xlsx.classeur({ ...b, auteur: session.user, entreprise: ENTREPRISE.nom.replace(/SARL$/, "Sarl") });
    return send(res, 200, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", { "Content-Disposition": `attachment; filename="${nom}"`, "Cache-Control": "no-store" });
  }

  // Sauvegarde complète (DG)
  if (pathname === "/api/g/sauvegarde" && method === "GET") {
    if (session.role !== "dg") return json(res, 403, { error: "Accès réservé au Directeur." });
    const tout = { date: new Date().toISOString() };
    for (const n of Object.keys(gestion.COLLECTIONS)) tout[n] = store.load("g-" + n, []);
    return send(res, 200, JSON.stringify(tout, null, 2), "application/json; charset=utf-8", { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="sauvegarde-gestion-gei-${tout.date.slice(0, 10)}.json"` });
  }

  // Pièces jointes privées
  if (pathname === "/api/g/fichiers" && method === "POST") {
    if (chef) return json(res, 403, { error: "Accès réservé à la direction et à la comptabilité." });
    const b = await readBody(req, 12 * 1024 * 1024);
    const mm = /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.data || "");
    if (!mm) return json(res, 400, { error: "Fichier accepté : PDF, JPEG, PNG ou WebP." });
    const buf = Buffer.from(mm[2], "base64");
    const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mm[1]];
    if (!{ pdf: /^25504446/, jpg: /^ffd8ff/, png: /^89504e47/, webp: /^52494646/ }[ext].test(buf.subarray(0, 4).toString("hex"))) return json(res, 400, { error: "Le fichier ne correspond pas à son type." });
    if (buf.length > 8 * 1024 * 1024) return json(res, 413, { error: "Fichier trop lourd (8 Mo au maximum)." });
    const d = new Date();
    const nom = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${slugify(b.name || "document") || "document"}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(FICHIERS, nom), buf);
    return json(res, 200, { fichier: nom, nom: str(b.name, 120) || nom });
  }
  const mf = /^\/api\/g\/fichiers\/([a-z0-9-]+\.(pdf|jpg|png|webp))$/.exec(pathname);
  if (mf && method === "GET") {
    const fp = path.join(FICHIERS, mf[1]);
    if (!fs.existsSync(fp)) return json(res, 404, { error: "Fichier introuvable" });
    res.writeHead(200, { "Content-Type": TYPES["." + (mf[2] === "jpg" ? "jpg" : mf[2])], "Content-Disposition": `inline; filename="${mf[1]}"`, "Cache-Control": "private, no-store", ...HEADERS });
    return fs.createReadStream(fp).pipe(res);
  }

  // Import depuis Excel (CSV converti dans le navigateur)
  const mi = /^\/api\/g\/import\/(maisons|depenses|ouvriers|chantiers)$/.exec(pathname);
  if (mi && method === "POST") {
    const b = await readBody(req, 4 * 1024 * 1024);
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 3000) : [];
    const name = "g-" + mi[1], clean = gestion.COLLECTIONS[mi[1]];
    const list = store.load(name, []); const erreurs = []; let ajoutes = 0;
    rows.forEach((row, i) => {
      try { list.push({ id: id(), ...clean(gestion.depuisImport(mi[1], row || {})), creePar: session.user, creeLe: new Date().toISOString(), importe: true }); ajoutes++; }
      catch (e) { erreurs.push({ ligne: i + 2, message: e.message }); }
    });
    if (ajoutes) store.save(name, list);
    return json(res, 200, { ajoutes, erreurs: erreurs.slice(0, 50), nbErreurs: erreurs.length });
  }

  // Données : chantiers, maisons, dépenses, ouvriers, pointages, trésorerie, stock
  const mg = /^\/api\/g\/(chantiers|maisons|depenses|ouvriers|pointages|mouvements|articles|stock|contrats|modeles|villas)(?:\/([a-f0-9]+))?$/.exec(pathname);
  if (mg) {
    const name = "g-" + mg[1], clean = gestion.COLLECTIONS[mg[1]];
    const list = store.load(name, []);
    if (chef) {
      const lecture = { chantiers: (c) => ({ ...c, budget: undefined, prix: undefined, echeancier: undefined, paiements: undefined }), ouvriers: (o) => ({ ...o, tarifJour: undefined }), articles: (a) => ({ ...a, prixUnitaire: undefined }),
        stock: (m) => ({ ...m, prixUnitaire: undefined }),
        villas: (v) => ({ ...v, budget: undefined, finitions: (v.finitions || []).map((f) => ({ ...f, surcout: undefined })) }) };
      if (method === "GET" && !mg[2]) return json(res, 200, lecture[mg[1]] ? list.map(lecture[mg[1]]) : list);
      const ecriture = { chantiers: ["PUT"], villas: ["PUT"], pointages: ["POST", "PUT", "DELETE"], stock: ["POST"] };
      if (!(ecriture[mg[1]] || []).includes(method)) return json(res, 403, { error: "Accès réservé à la direction et à la comptabilité." });
      if (mg[1] === "chantiers" && mg[2]) {
        const i = list.findIndex((x) => x.id === mg[2]);
        if (i < 0) return json(res, 404, { error: "Introuvable" });
        const b = await readBody(req, 300000);
        const avant = list[i];
        list[i] = { ...avant, ...clean({ ...avant, statut: b.statut, etapes: b.etapes, photos: b.photos, notes: b.notes }), id: avant.id, creePar: avant.creePar, creeLe: avant.creeLe, modifiePar: session.user, modifieLe: new Date().toISOString() };
        store.save(name, list);
        return json(res, 200, lecture.chantiers(list[i]));
      }
      // Chef de chantier : met à jour seulement l'avancement, les dates et les photos des phases d'une villa
      if (mg[1] === "villas" && mg[2]) {
        const i = list.findIndex((x) => x.id === mg[2]);
        if (i < 0) return json(res, 404, { error: "Introuvable" });
        const b = await readBody(req, 600000);
        const avant = list[i];
        list[i] = { ...avant, ...clean({ ...avant, phases: fusionPhases(avant.phases, b.phases) }), id: avant.id, creePar: avant.creePar, creeLe: avant.creeLe, modifiePar: session.user, modifieLe: new Date().toISOString() };
        store.save(name, list);
        return json(res, 200, lecture.villas(list[i]));
      }
      // Chef de chantier : sortie de stock sans prix (il ne voit pas les montants)
      if (mg[1] === "stock" && method === "POST") {
        const b = await readBody(req, 300000);
        const x = { id: id(), ...clean({ ...b, prixUnitaire: 0, depenseId: "" }), creePar: session.user, creeLe: new Date().toISOString() };
        list.push(x); store.save(name, list); return json(res, 200, lecture.stock(x));
      }
    }
    if (!mg[2]) {
      if (method === "GET") return json(res, 200, list);
      if (method === "POST") { const x = { id: id(), ...clean(await readBody(req, 300000)), creePar: session.user, creeLe: new Date().toISOString() }; list.push(x); store.save(name, list); if (mg[1] === "depenses") stockDepuisAchat(x); return json(res, 200, x); }
      return json(res, 405, { error: "Méthode non permise" });
    }
    const i = list.findIndex((x) => x.id === mg[2]);
    if (i < 0) return json(res, 404, { error: "Introuvable" });
    const avantSuppr = list[i];
    // Modification : les champs absents de la requête gardent leur valeur (les anciens formulaires n'effacent pas les nouveaux champs)
    if (method === "PUT") { const corps = await readBody(req, 600000); if (mg[1] === "villas" && corps && corps.phases) corps.phases = fusionPhases(list[i].phases, corps.phases);
      list[i] = { id: list[i].id, ...clean({ ...list[i], ...corps }), creePar: list[i].creePar, creeLe: list[i].creeLe, modifiePar: session.user, modifieLe: new Date().toISOString() }; }
    else if (method === "DELETE") list.splice(i, 1);
    else return json(res, 405, { error: "Méthode non permise" });
    store.save(name, list);
    if (mg[1] === "depenses") stockDepuisAchat(method === "DELETE" ? avantSuppr : list[i], method === "DELETE");
    return json(res, 200, list[i] || { ok: true });
  }
  return json(res, 404, { error: "Introuvable" });
}

/* ---------------- Routeur ---------------- */
const server = http.createServer(async (req, res) => {
  // En ligne (FORCE_HTTPS=1) : toute visite en http:// est renvoyée vers https://
  if (process.env.FORCE_HTTPS === "1" && req.headers["x-forwarded-proto"] === "http" && req.headers.host) {
    res.writeHead(301, { Location: "https://" + req.headers.host + req.url }); return res.end();
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { return send(res, 400, "Requête invalide"); }
  try {
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Méthode non permise");
    // Photos de chantier : seulement pour les comptes connectés
    if (pathname.startsWith("/uploads/")) {
      if (!auth.check(cookies(req).gei_g) && !sessionLocale(req)) return send(res, 401, "Connexion requise", "text/plain; charset=utf-8");
      const f = safeJoin(UPLOADS, pathname.slice(9));
      return f ? sendFile(res, f, "private, max-age=3600") : send(res, 404, "Introuvable");
    }
    if (pathname === "/" || pathname === "/index.html") return sendFile(res, path.join(PUBLIC, "index.html"));
    const f = safeJoin(PUBLIC, pathname.slice(1));
    return f ? sendFile(res, f) : send(res, 404, "Introuvable", "text/plain; charset=utf-8");
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (pathname.startsWith("/api/")) return json(res, status, { error: status === 500 ? "Erreur du serveur" : e.message });
    return send(res, status, "Erreur du serveur");
  }
});
server.listen(PORT, () => console.log(`GEI Gestion : http://localhost:${PORT}\nDonnées : ${store.BASE}`));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { if (store.flushAll) store.flushAll(); process.exit(0); });
