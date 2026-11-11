// Connexion au tableau de bord : mot de passe haché (scrypt), sessions enregistrées dans data/, limite d'essais.
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const store = require("./store");

const SESSION_HOURS = 8;
// Sessions dans un fichier (et non en mémoire) : elles survivent aux redémarrages du serveur
// et sont partagées si l'hébergeur lance plusieurs copies. On n'y garde que l'empreinte du jeton.
const sid = (token) => crypto.createHash("sha256").update(token).digest("hex");
const sessions = () => store.load("sessions", {});
function saveSessions(list) {
  const now = Date.now();
  for (const k of Object.keys(list)) if (list[k].expire < now) delete list[k];
  store.save("sessions", list);
}
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
  const list = sessions();
  list[sid(token)] = { user, expire: Date.now() + SESSION_HOURS * 3600 * 1000 };
  saveSessions(list);
  return { token };
}

function check(token) {
  if (!token || typeof token !== "string") return null;
  const list = sessions();
  const s = list[sid(token)];
  if (!s) return null;
  if (s.expire < Date.now()) { delete list[sid(token)]; saveSessions(list); return null; }
  return s;
}

function logout(token) {
  if (!token) return;
  const list = sessions();
  delete list[sid(token)];
  saveSessions(list);
}

function changePassword(current, next) {
  const admin = store.load("admin", null);
  if (typeof current !== "string" || !crypto.timingSafeEqual(Buffer.from(hash(current, admin.salt), "hex"), Buffer.from(admin.hash, "hex"))) return { error: "Mot de passe actuel incorrect." };
  if (typeof next !== "string" || next.length < 10) return { error: "Le nouveau mot de passe doit faire au moins 10 caractères." };
  const salt = crypto.randomBytes(16).toString("hex");
  store.save("admin", { ...admin, salt, hash: hash(next, salt) });
  store.save("sessions", {});
  const f = path.join(store.DATA, "premier-acces.txt");
  if (fs.existsSync(f)) fs.unlinkSync(f);
  return { ok: true };
}

module.exports = { ensureAdmin, login, check, logout, changePassword, SESSION_HOURS };
