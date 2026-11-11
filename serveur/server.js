// Serveur du site Global Empire Immobilier + tableau de bord.
// Aucune dépendance : uniquement Node.js (version 18 ou plus).
// Démarrer :  node server.js      puis ouvrir http://localhost:8765  et  http://localhost:8765/admin
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const store = require("./lib/store");
const auth = require("./lib/auth");
const stats = require("./lib/stats");
const R = require("./lib/render");

const PORT = +process.env.PORT || 8765;
// Dossier du site : variable SITE_DIR, sinon ../Site_GEI (sur ton ordinateur), sinon le dossier parent (dépôt GitHub : site + serveur/)
const SITE = path.resolve(process.env.SITE_DIR ||
  (fs.existsSync(path.join(__dirname, "..", "Site_GEI", "index.html")) ? path.join(__dirname, "..", "Site_GEI") : path.join(__dirname, "..")));
const ADMIN = path.join(__dirname, "admin");
const UPLOADS = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4", ".txt": "text/plain; charset=utf-8",
};

auth.ensureAdmin();

/* ---------------- Outils ---------------- */
const programmes = () => store.load("programmes", []);
const visibles = () => programmes().filter((p) => p.visible !== false).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
const actualites = () => store.load("actualites", []);
const publiees = () => actualites().filter((a) => a.publie !== false).sort((a, b) => String(b.date).localeCompare(String(a.date)));
const enLigne = (name) => store.load(name, []).filter((x) => x.publie !== false).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

function ip(req) { return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || ""; }

function cookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((c) => { const i = c.indexOf("="); if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim()); });
  return out;
}

function send(res, status, body, type = "text/html; charset=utf-8", extra = {}) {
  res.writeHead(status, {
    "Content-Type": type, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN", ...extra,
  });
  res.end(body);
}
const json = (res, status, data, extra) => send(res, status, JSON.stringify(data), "application/json; charset=utf-8", { "Cache-Control": "no-store", ...extra });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error("Fichier trop lourd"), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch { reject(Object.assign(new Error("Données invalides"), { status: 400 })); } });
    req.on("error", reject);
  });
}

function sendFile(res, file, req) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    // Images et vidéos : gardées 1 jour. Pages, styles et scripts : revérifiés à chaque visite.
    const longCache = /\.(jpe?g|png|webp|svg|ico|mp4)$/.test(ext);
    const lastMod = st.mtime.toUTCString();
    const headers = { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": longCache ? "public, max-age=86400" : "no-cache", "Last-Modified": lastMod, "Accept-Ranges": "bytes" };
    const since = req.headers["if-modified-since"];
    if (since && !req.headers.range && Math.floor(st.mtimeMs / 1000) <= Math.floor(Date.parse(since) / 1000)) { res.writeHead(304, headers); return res.end(); }
    // Lecture par morceaux pour les vidéos (avance rapide)
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? +range[1] : 0;
      const end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, "Content-Length": st.size });
    fs.createReadStream(file).pipe(res);
  });
}

function safeJoin(root, urlPath) {
  const parts = urlPath.split("/").filter(Boolean);
  if (parts.some((p) => p.startsWith(".") || p.includes("\\"))) return null;   // pas de fichiers cachés ni ../
  const full = path.join(root, ...parts);
  if (!full.startsWith(root)) return null;
  // Le dossier du serveur (code, données, mot de passe) n'est jamais servi comme une page du site
  if (root === SITE && (full === __dirname || full.startsWith(__dirname + path.sep))) return null;
  return full;
}

function notFound(res) {
  const f = path.join(SITE, "404.html");
  send(res, 404, fs.existsSync(f) ? fs.readFileSync(f) : "Page introuvable");
}

/* ---------------- Pages publiques dynamiques ---------------- */
function page(name) { return fs.readFileSync(path.join(SITE, name), "utf8"); }

function dynamicPage(pathname) {
  if (pathname === "/" || pathname === "/index.html") {
    let html = R.between(page("index.html"), "programmes", R.projetsUne(visibles()));
    const s = enLigne("slides");
    if (s.length) html = R.between(html, "slides", R.slides(s));
    const sv = enLigne("services");
    if (sv.length) html = R.between(html, "services", R.servicesCards(sv.slice(0, 3)));
    return R.between(html, "realisations", R.realisationsCards(enLigne("realisations")));
  }
  if (pathname === "/realisations.html") {
    return R.between(page("realisations.html"), "realisations", R.realisations(enLigne("realisations")));
  }
  if (pathname === "/services.html") {
    const sv = enLigne("services");
    return sv.length ? R.between(page("services.html"), "services", R.servicesRows(sv)) : page("services.html");
  }
  if (pathname === "/programmes.html") {
    return R.between(page("programmes.html"), "programmes", R.cards(visibles()));
  }
  if (pathname === "/actualites.html") {
    return R.between(page("actualites.html"), "actualites", R.newsList(publiees()));
  }
  const m = /^\/programme-([a-z0-9-]+)\.html$/.exec(pathname);
  if (m) {
    const p = visibles().find((x) => x.slug === m[1]);
    return p ? R.programmePage(p, visibles()) : false;   // false = page introuvable
  }
  return null;  // pas une page dynamique
}

/* ---------------- API ---------------- */
const contactHits = new Map();
function contactLimited(addr) {
  const now = Date.now();
  const list = (contactHits.get(addr) || []).filter((t) => now - t < 3600000);
  list.push(now); contactHits.set(addr, list);
  return list.length > 10;
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const slugify = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const id = () => crypto.randomBytes(6).toString("hex");

function cleanProgramme(b, old = {}) {
  const n = (v) => { const x = parseFloat(String(v).replace(",", ".")); return isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0; };
  const list = (v, max) => (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, 30);
  const p = {
    slug: old.slug || slugify(b.slug || b.ville || b.nom),
    ville: str(b.ville, 60), nom: str(b.nom, 100),
    type: ["basse", "duplex", "eco", "autre"].includes(b.type) ? b.type : "autre",
    typeLabel: str(b.typeLabel, 40), pieces: str(b.pieces, 40), surface: str(b.surface, 40),
    statut: str(b.statut, 40), pill: str(b.pill, 80), badge: ["ok", "new", ""].includes(b.badge) ? b.badge : "",
    documents: str(b.documents, 40) || "ACD & permis",
    prixDes: n(b.prixDes),
    titre1: str(b.titre1, 80), titre2: str(b.titre2, 80), accroche: str(b.accroche, 400),
    sousTitre1: str(b.sousTitre1, 80), sousTitre2: str(b.sousTitre2, 80),
    paragraphes: list(b.paragraphes, 2000), points: list(b.points, 80),
    formules: (Array.isArray(b.formules) ? b.formules : []).map((f) => ({ label: str(f && f.label, 60), montant: n(f && f.montant) })).filter((f) => f.label).slice(0, 8),
    noteOffre: str(b.noteOffre, 200),
    image: str(b.image, 300), carte: str(b.carte, 300),
    galerie: (Array.isArray(b.galerie) ? b.galerie : []).map((g) => ({ src: str(g && g.src, 300), legende: str(g && g.legende, 80) })).filter((g) => g.src).slice(0, 60),
    video: b.video && str(b.video.src, 300) ? { src: str(b.video.src, 300), poster: str(b.video.poster, 300), titre: str(b.video.titre, 120), texte: str(b.video.texte, 400), format: b.video.format === "vertical" ? "vertical" : "horizontal" } : null,
    visible: b.visible !== false,
    ordre: Number.isInteger(+b.ordre) ? +b.ordre : 0,
  };
  if (!p.ville || !p.nom) throw Object.assign(new Error("La ville et le nom du programme sont obligatoires."), { status: 400 });
  if (!p.slug) throw Object.assign(new Error("Nom de page invalide."), { status: 400 });
  return p;
}

function cleanActu(b) {
  const a = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10),
    dateTexte: str(b.dateTexte, 40), titre: str(b.titre, 140), texte: str(b.texte, 2000),
    image: str(b.image, 300), lien: str(b.lien, 300), publie: b.publie !== false,
  };
  if (!a.titre) throw Object.assign(new Error("Le titre est obligatoire."), { status: 400 });
  if (a.lien && !/^(https?:\/\/|[a-z0-9-]+\.html)/i.test(a.lien)) a.lien = "";
  return a;
}

// Slides de l'accueil et réalisations : petites collections gérées depuis le tableau de bord
const okLink = (v) => { const s = str(v, 300); return /^(https?:\/\/|[a-z0-9-]+\.html(#[\w-]*)?$|#[\w-]+$)/i.test(s) ? s : ""; };
const COLLECTIONS = {
  slides: (b) => {
    const s = { image: str(b.image, 300), alt: str(b.alt, 160), kicker: str(b.kicker, 80), titre1: str(b.titre1, 60), titre2: str(b.titre2, 60),
      texte: str(b.texte, 200), bouton: str(b.bouton, 40), lien: okLink(b.lien), publie: b.publie !== false, ordre: Number.isInteger(+b.ordre) ? +b.ordre : 0 };
    if (!s.image || !s.titre1) throw Object.assign(new Error("La photo et le titre sont obligatoires."), { status: 400 });
    return s;
  },
  realisations: (b) => {
    const r = { titre: str(b.titre, 120), lieu: str(b.lieu, 60), date: str(b.date, 60), texte: str(b.texte, 600), image: str(b.image, 300),
      chiffres: (Array.isArray(b.chiffres) ? b.chiffres : []).map((x) => str(x, 40)).filter(Boolean).slice(0, 6),
      lien: okLink(b.lien), publie: b.publie !== false, ordre: Number.isInteger(+b.ordre) ? +b.ordre : 0 };
    if (!r.titre) throw Object.assign(new Error("Le titre est obligatoire."), { status: 400 });
    return r;
  },
  services: (b) => {
    const list = (v, n, max) => (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, n);
    const s = { titre1: str(b.titre1, 60), titre2: str(b.titre2, 60), resume: str(b.resume, 220), paragraphes: list(b.paragraphes, 6, 1500),
      points: list(b.points, 12, 60), image: str(b.image, 300), publie: b.publie !== false, ordre: Number.isInteger(+b.ordre) ? +b.ordre : 0 };
    if (!s.titre1) throw Object.assign(new Error("Le titre est obligatoire."), { status: 400 });
    return s;
  },
};

async function api(req, res, pathname) {
  const method = req.method;

  // --- Public : formulaire de contact ---
  if (pathname === "/api/contact" && method === "POST") {
    const b = await readBody(req, 20000);
    if (str(b.site, 10)) return json(res, 200, { ok: true });                // robot (champ piège rempli)
    if (contactLimited(ip(req))) return json(res, 429, { error: "Trop de demandes. Réessayez plus tard." });
    const d = { id: id(), date: new Date().toISOString(), nom: str(b.nom, 120), tel: str(b.tel, 40),
      programme: str(b.programme, 140), message: str(b.message, 2000), page: str(b.page, 120), traitee: false };
    if (!d.nom || !d.tel) return json(res, 400, { error: "Nom et téléphone obligatoires." });
    const list = store.load("demandes", []);
    list.unshift(d);
    store.save("demandes", list.slice(0, 5000));
    return json(res, 200, { ok: true });
  }

  // --- Connexion ---
  if (pathname === "/api/login" && method === "POST") {
    const b = await readBody(req, 5000);
    const r = auth.login(ip(req), b.user, b.password);
    if (r.error) return json(res, 401, { error: r.error });
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return json(res, 200, { ok: true }, { "Set-Cookie": `gei_sid=${r.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${auth.SESSION_HOURS * 3600}${secure}` });
  }

  // --- Tout le reste demande d'être connecté ---
  const token = cookies(req).gei_sid;
  const session = auth.check(token);
  if (!session) return json(res, 401, { error: "Non connecté" });
  // Protection contre les requêtes venant d'un autre site
  if (method !== "GET" && req.headers["x-gei"] !== "1") return json(res, 403, { error: "Requête refusée" });

  if (pathname === "/api/logout" && method === "POST") {
    auth.logout(token);
    return json(res, 200, { ok: true }, { "Set-Cookie": "gei_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }
  if (pathname === "/api/me") return json(res, 200, { user: session.user });

  if (pathname === "/api/password" && method === "POST") {
    const b = await readBody(req, 5000);
    const r = auth.changePassword(b.current, b.next);
    return r.error ? json(res, 400, r) : json(res, 200, { ok: true }, { "Set-Cookie": "gei_sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0" });
  }

  if (pathname === "/api/stats") {
    const d = store.load("demandes", []);
    return json(res, 200, { ...stats.summary(30), demandes: { total: d.length, nonTraitees: d.filter((x) => !x.traitee).length },
      programmes: programmes().length, actualites: actualites().length });
  }

  // Demandes de contact
  if (pathname === "/api/demandes" && method === "GET") return json(res, 200, store.load("demandes", []));
  let m = /^\/api\/demandes\/([a-f0-9]+)$/.exec(pathname);
  if (m) {
    const list = store.load("demandes", []);
    const i = list.findIndex((x) => x.id === m[1]);
    if (i < 0) return json(res, 404, { error: "Introuvable" });
    if (method === "PATCH") { const b = await readBody(req, 5000); list[i].traitee = !!b.traitee; list[i].note = str(b.note, 1000) || list[i].note || ""; }
    else if (method === "DELETE") list.splice(i, 1);
    else return json(res, 405, { error: "Méthode non permise" });
    store.save("demandes", list);
    return json(res, 200, { ok: true });
  }

  // Programmes
  if (pathname === "/api/programmes" && method === "GET") return json(res, 200, programmes());
  if (pathname === "/api/programmes" && method === "POST") {
    const b = await readBody(req, 200000);
    const p = cleanProgramme(b);
    const list = programmes();
    let s = p.slug, k = 2;
    while (list.some((x) => x.slug === s)) s = `${p.slug}-${k++}`;
    p.slug = s;
    list.push(p); store.save("programmes", list);
    return json(res, 200, p);
  }
  m = /^\/api\/programmes\/([a-z0-9-]+)$/.exec(pathname);
  if (m) {
    const list = programmes();
    const i = list.findIndex((x) => x.slug === m[1]);
    if (i < 0) return json(res, 404, { error: "Introuvable" });
    if (method === "PUT") { list[i] = cleanProgramme(await readBody(req, 200000), list[i]); }
    else if (method === "DELETE") list.splice(i, 1);
    else return json(res, 405, { error: "Méthode non permise" });
    store.save("programmes", list);
    return json(res, 200, list[i] || { ok: true });
  }

  // Actualités
  if (pathname === "/api/actualites" && method === "GET") return json(res, 200, actualites());
  if (pathname === "/api/actualites" && method === "POST") {
    const a = { id: id(), ...cleanActu(await readBody(req, 50000)) };
    const list = actualites(); list.push(a); store.save("actualites", list);
    return json(res, 200, a);
  }
  m = /^\/api\/actualites\/([a-f0-9]+)$/.exec(pathname);
  if (m) {
    const list = actualites();
    const i = list.findIndex((x) => x.id === m[1]);
    if (i < 0) return json(res, 404, { error: "Introuvable" });
    if (method === "PUT") list[i] = { id: list[i].id, ...cleanActu(await readBody(req, 50000)) };
    else if (method === "DELETE") list.splice(i, 1);
    else return json(res, 405, { error: "Méthode non permise" });
    store.save("actualites", list);
    return json(res, 200, list[i] || { ok: true });
  }

  // Slides et réalisations
  m = /^\/api\/(slides|realisations|services)(?:\/([a-f0-9]+))?$/.exec(pathname);
  if (m) {
    const name = m[1], clean = COLLECTIONS[name];
    const list = store.load(name, []);
    if (!m[2]) {
      if (method === "GET") return json(res, 200, list);
      if (method === "POST") { const x = { id: id(), ...clean(await readBody(req, 60000)) }; list.push(x); store.save(name, list); return json(res, 200, x); }
      return json(res, 405, { error: "Méthode non permise" });
    }
    const i = list.findIndex((x) => x.id === m[2]);
    if (i < 0) return json(res, 404, { error: "Introuvable" });
    if (method === "PUT") list[i] = { id: list[i].id, ...clean(await readBody(req, 60000)) };
    else if (method === "DELETE") list.splice(i, 1);
    else return json(res, 405, { error: "Méthode non permise" });
    store.save(name, list);
    return json(res, 200, list[i] || { ok: true });
  }

  // Envoi de photos (déjà réduites par le navigateur, envoyées en base64)
  if (pathname === "/api/upload" && method === "POST") {
    const b = await readBody(req, 12 * 1024 * 1024);
    const mm = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.data || "");
    if (!mm) return json(res, 400, { error: "Image invalide (JPEG, PNG ou WebP)." });
    const buf = Buffer.from(mm[2], "base64");
    const sig = buf.subarray(0, 4).toString("hex");
    const okSig = { jpeg: /^ffd8ff/, png: /^89504e47/, webp: /^52494646/ }[mm[1]];
    if (!okSig.test(sig)) return json(res, 400, { error: "Le fichier n'est pas une vraie image." });
    const d = new Date();
    const name = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}-${slugify(b.name || "photo").slice(0, 30) || "photo"}-${crypto.randomBytes(3).toString("hex")}.${mm[1] === "jpeg" ? "jpg" : mm[1]}`;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return json(res, 200, { src: `uploads/${name}` });
  }

  // Liste des images disponibles (pour les choisir dans le formulaire)
  if (pathname === "/api/images" && method === "GET") {
    const list = (dir, prefix) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).map((f) => prefix + f) : []);
    return json(res, 200, [...list(UPLOADS, "uploads/").reverse(), ...list(path.join(SITE, "assets", "img"), "assets/img/").filter((f) => !/\.webp$/.test(f))]);
  }

  return json(res, 404, { error: "Introuvable" });
}

/* ---------------- Routeur ---------------- */
const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { return send(res, 400, "Requête invalide"); }

  try {
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);

    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Méthode non permise");

    if (pathname === "/admin") { res.writeHead(301, { Location: "/admin/" }); return res.end(); }
    if (pathname.startsWith("/admin/")) {
      const f = safeJoin(ADMIN, pathname.slice(7) || "index.html");
      if (!f) return notFound(res);
      return sendFile(res, pathname === "/admin/" ? path.join(ADMIN, "index.html") : f, req);
    }
    if (pathname.startsWith("/uploads/")) {
      const f = safeJoin(UPLOADS, pathname.slice(9));
      return f ? sendFile(res, f, req) : notFound(res);
    }

    const html = dynamicPage(pathname);
    if (html === false) return notFound(res);
    if (typeof html === "string") {
      stats.record(req, pathname);
      return send(res, 200, html, "text/html; charset=utf-8", { "Cache-Control": "no-cache" });
    }

    const f = safeJoin(SITE, pathname.endsWith("/") ? pathname + "index.html" : pathname);
    if (!f) return notFound(res);
    if (f.endsWith(".html") && fs.existsSync(f)) stats.record(req, pathname);
    return sendFile(res, f, req);
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (pathname.startsWith("/api/")) return json(res, status, { error: status === 500 ? "Erreur du serveur" : e.message });
    return send(res, status, "Erreur du serveur");
  }
});

server.listen(PORT, () => {
  console.log(`Site GEI       : http://localhost:${PORT}`);
  console.log(`Tableau de bord : http://localhost:${PORT}/admin`);
});

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { store.flushAll(); process.exit(0); });
