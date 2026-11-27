// Stockage simple en fichiers JSON (aucune dépendance).
// Chaque collection = un fichier dans data/. Écriture atomique (fichier temporaire puis renommage).
"use strict";
const fs = require("fs");
const path = require("path");

const os = require("os");
const APP = path.join(__dirname, "..");

/* ---------- Où ranger les données ----------
   - Variable GEI_DONNEES : ce dossier-là (prioritaire).
   - En ligne (cPanel / production) ou hors Windows : à côté de l'application, comme avant.
   - Sur un PC Windows : Documents\GEI-Gestion-Donnees, séparé du code (les mises à jour n'y touchent jamais).
   Au premier lancement, les données déjà présentes dans le dossier de l'application y sont COPIÉES (rien n'est effacé). */
function documentsWindows() {
  try {
    const out = require("child_process").execFileSync("reg", ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders", "/v", "Personal"], { encoding: "utf8", windowsHide: true, timeout: 5000 });
    const m = /Personal\s+REG_\w+\s+(.+)/.exec(out);
    if (m && fs.existsSync(m[1].trim())) return m[1].trim();
  } catch { /* on prend le dossier Documents habituel */ }
  return path.join(os.homedir(), "Documents");
}
function dossierDonnees() {
  if (process.env.GEI_DONNEES) return path.resolve(process.env.GEI_DONNEES);
  if (process.env.NODE_ENV === "production" || process.env.PASSENGER_APP_ENV || process.platform !== "win32") return APP;
  return path.join(documentsWindows(), "GEI-Gestion-Donnees");
}
const BASE = dossierDonnees();
const DATA = path.join(BASE, "data");
const UPLOADS = path.join(BASE, "uploads");     // photos de chantier
const FICHIERS = path.join(BASE, "fichiers");   // pièces jointes (factures, contrats…)
const SEED = path.join(APP, "seed");

// Copie unique des anciennes données (dossier de l'application → nouveau dossier), si le nouveau est encore vide
if (BASE !== APP && !fs.existsSync(path.join(DATA, "admin.json"))) {
  const anciens = path.join(APP, "data");
  if (fs.existsSync(anciens) && fs.readdirSync(anciens).some((f) => f.endsWith(".json"))) {
    for (const d of ["data", "uploads", "fichiers"]) {
      const src = path.join(APP, d);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(BASE, d), { recursive: true, force: false, errorOnExist: false });
    }
    try {
      fs.writeFileSync(path.join(anciens, "LISEZ-MOI-DONNEES-DEPLACEES.txt"),
        `Depuis le ${new Date().toLocaleDateString("fr-FR")}, les données de GEI Gestion sont rangées ici :\r\n${BASE}\r\n\r\n` +
        "Ce dossier-ci est une ancienne copie, gardée par sécurité. L'application ne s'en sert plus.\r\n", "utf8");
    } catch { /* simple note */ }
    console.log(`Données copiées vers : ${BASE}`);
  }
}
for (const d of [DATA, UPLOADS, FICHIERS]) fs.mkdirSync(d, { recursive: true });

const cache = {};
const timers = {};
const stamps = {};   // date de modification du fichier lu, pour relire si un autre processus l'a changé

function stamp(name) { try { return fs.statSync(file(name)).mtimeMs; } catch { return 0; } }

function file(name) { return path.join(DATA, name + ".json"); }

function load(name, fallback) {
  // Chez certains hébergeurs (LWS, cPanel…), plusieurs copies du serveur tournent en même temps :
  // on relit le fichier s'il a été modifié par une autre copie (sauf écriture en attente ici).
  if (cache[name] !== undefined && (timers[name] || stamps[name] === stamp(name))) return cache[name];
  let value = fallback;
  if (fs.existsSync(file(name))) {
    value = JSON.parse(fs.readFileSync(file(name), "utf8"));
  } else if (fs.existsSync(path.join(SEED, name + ".json"))) {
    value = JSON.parse(fs.readFileSync(path.join(SEED, name + ".json"), "utf8"));
    writeNow(name, value);
  }
  cache[name] = value;
  stamps[name] = stamp(name);
  return value;
}

function writeNow(name, value) {
  const tmp = file(name) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file(name));
  stamps[name] = stamp(name);
}

// Sauvegarde immédiate
function save(name, value) {
  cache[name] = value;
  writeNow(name, value);
}

// Sauvegarde regroupée (pour les statistiques, écrites très souvent)
function saveLater(name, value, ms = 10000) {
  cache[name] = value;
  if (timers[name]) return;
  timers[name] = setTimeout(() => { delete timers[name]; writeNow(name, cache[name]); }, ms);
}

function flushAll() {
  for (const name of Object.keys(timers)) {
    clearTimeout(timers[name]);
    delete timers[name];
    writeNow(name, cache[name]);
  }
}

module.exports = { load, save, saveLater, flushAll, DATA, UPLOADS, FICHIERS, BASE };
