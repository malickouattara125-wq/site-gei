// Stockage simple en fichiers JSON (aucune dépendance).
// Chaque collection = un fichier dans data/. Écriture atomique (fichier temporaire puis renommage).
"use strict";
const fs = require("fs");
const path = require("path");

const DATA = path.join(__dirname, "..", "data");
const SEED = path.join(__dirname, "..", "seed");
fs.mkdirSync(DATA, { recursive: true });

const cache = {};
const timers = {};

function file(name) { return path.join(DATA, name + ".json"); }

function load(name, fallback) {
  if (cache[name] !== undefined) return cache[name];
  let value = fallback;
  if (fs.existsSync(file(name))) {
    value = JSON.parse(fs.readFileSync(file(name), "utf8"));
  } else if (fs.existsSync(path.join(SEED, name + ".json"))) {
    value = JSON.parse(fs.readFileSync(path.join(SEED, name + ".json"), "utf8"));
    writeNow(name, value);
  }
  cache[name] = value;
  return value;
}

function writeNow(name, value) {
  const tmp = file(name) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(tmp, file(name));
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

module.exports = { load, save, saveLater, flushAll, DATA };
