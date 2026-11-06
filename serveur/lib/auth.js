// Connexion au tableau de bord : mot de passe haché (scrypt), sessions en mémoire, limite d'essais.
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const store = require("./store");

const SESSION_HOURS = 8;
const sessions = new Map();          // jeton -> { user, expire }
const failures = new Map();          // ip -> { count, until }

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

// Au premier démarrage : crée le compte admin.
// Mot de passe pris dans la variable ADMIN_PASSWORD, sinon généré et écrit dans data/premier-acces.txt
function ensureAdmin() {
  const admin = store.load("admin", null);
  if (admin) return;
  const user = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  const salt = crypto.randomBytes(16).toString("hex");
  store.save("admin", { user, salt, hash: hash(password, salt) });
  if (!process.env.ADMIN_PASSWORD) {
    const f = path.join(store.DATA, "premier-acces.txt");
    fs.writeFileSync(f, `Tableau de bord GEI\nIdentifiant : ${user}\nMot de passe : ${password}\n\n` +
      "Changez ce mot de passe dans l'onglet « Mon compte », puis supprimez ce fichier.\n", "utf8");
    console.log(`Compte admin créé. Identifiants dans : ${f}`);
  }
}

function tooMany(ip) {
  const f = failures.get(ip);
  return f && f.count >= 5 && f.until > Date.now();
}

function login(ip, user, password) {
  if (tooMany(ip)) return { error: "Trop d'essais. Réessayez dans 15 minutes." };
  const admin = store.load("admin", null);
  const ok = admin && typeof user === "string" && typeof password === "string" &&
    user === admin.user &&
    crypto.timingSafeEqual(Buffer.from(hash(password, admin.salt), "hex"), Buffer.from(admin.hash, "hex"));
  if (!ok) {
    const f = failures.get(ip) || { count: 0, until: 0 };
    f.count = f.until < Date.now() ? 1 : f.count + 1;
    f.until = Date.now() + 15 * 60 * 1000;
    failures.set(ip, f);
    return { error: "Identifiant ou mot de passe incorrect." };
  }
  failures.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { user, expire: Date.now() + SESSION_HOURS * 3600 * 1000 });
  return { token };
}

function check(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expire < Date.now()) { sessions.delete(token); return null; }
  return s;
}

function logout(token) { sessions.delete(token); }

function changePassword(current, next) {
  const admin = store.load("admin", null);
  if (hash(current || "", admin.salt) !== admin.hash) return { error: "Mot de passe actuel incorrect." };
  if (typeof next !== "string" || next.length < 10) return { error: "Le nouveau mot de passe doit faire au moins 10 caractères." };
  const salt = crypto.randomBytes(16).toString("hex");
  store.save("admin", { ...admin, salt, hash: hash(next, salt) });
  sessions.clear();
  const f = path.join(store.DATA, "premier-acces.txt");
  if (fs.existsSync(f)) fs.unlinkSync(f);
  return { ok: true };
}

module.exports = { ensureAdmin, login, check, logout, changePassword, SESSION_HOURS };
