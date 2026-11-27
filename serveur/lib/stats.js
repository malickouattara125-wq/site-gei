// Statistiques de visites, comptées par le site lui-même (aucun service extérieur).
// Les visiteurs sont reconnus par une empreinte anonyme (hachage) qui change chaque jour.
"use strict";
const crypto = require("crypto");
const store = require("./store");

const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|curl|wget|python|headless|lighthouse/i;
// Sel gardé dans data/ : le même pour toutes les copies du serveur, sinon un visiteur serait compté plusieurs fois.
function salt() {
  let s = store.load("stats-sel", null);
  if (!s) { s = crypto.randomBytes(16).toString("hex"); store.save("stats-sel", s); }
  return s;
}

function day(d = new Date()) { return d.toISOString().slice(0, 10); }

function record(req, pathname, addr) {
  const ua = req.headers["user-agent"] || "";
  if (!ua || BOTS.test(ua)) return;
  const stats = store.load("stats", { jours: {} });
  const k = day();
  const j = stats.jours[k] || (stats.jours[k] = { vues: 0, visiteurs: {}, pages: {} });
  j.vues++;
  const id = crypto.createHash("sha256").update(salt() + k + (addr || req.socket.remoteAddress || "") + ua).digest("hex").slice(0, 16);
  j.visiteurs[id] = 1;
  const page = pathname === "/" ? "/index.html" : pathname;
  j.pages[page] = (j.pages[page] || 0) + 1;
  // On garde 400 jours au maximum
  const keys = Object.keys(stats.jours).sort();
  while (keys.length > 400) delete stats.jours[keys.shift()];
  store.saveLater("stats", stats);
}

function summary(nbJours = 30) {
  const stats = store.load("stats", { jours: {} });
  const jours = [];
  const pages = {};
  let vues = 0, visiteurs = 0;
  for (let i = nbJours - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const k = day(d);
    const j = stats.jours[k];
    const v = j ? j.vues : 0;
    const u = j ? Object.keys(j.visiteurs).length : 0;
    jours.push({ jour: k, vues: v, visiteurs: u });
    vues += v; visiteurs += u;
    if (j) for (const [p, n] of Object.entries(j.pages)) pages[p] = (pages[p] || 0) + n;
  }
  const top = Object.entries(pages).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([page, vues]) => ({ page, vues }));
  const today = stats.jours[day()];
  return {
    jours, top, vues, visiteurs,
    aujourdhui: { vues: today ? today.vues : 0, visiteurs: today ? Object.keys(today.visiteurs).length : 0 },
  };
}

module.exports = { record, summary };
