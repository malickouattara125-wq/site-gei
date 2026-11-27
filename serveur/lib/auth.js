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

// Comptes : le DG est dans data/admin.json (compte principal, rôle « dg ») ;
// les autres comptes (comptable…) sont dans data/comptes.json.
const ROLES = { dg: "Directeur (accès complet)", comptable: "Comptable (gestion, sans les comptes)", chef: "Chef de chantier (avancement, photos, pointage, stock ; sans l'argent)" };
const same = (pw, acc) => typeof pw === "string" && acc && acc.salt && crypto.timingSafeEqual(Buffer.from(hash(pw, acc.salt), "hex"), Buffer.from(acc.hash, "hex"));
function findAccount(user) {
  const admin = store.load("admin", null);
  if (admin && user === admin.user) return { ...admin, role: "dg", principal: true };
  const c = store.load("comptes", []).find((x) => x.user === user);
  return c ? { ...c, principal: false } : null;
}

function login(ip, user, password) {
  if (tooMany(ip)) return { error: "Trop d'essais. Réessayez dans 15 minutes." };
  const acc = typeof user === "string" ? findAccount(user) : null;
  if (!acc || !same(password, acc)) {
    const f = failures.get(ip) || { count: 0, until: 0 };
    f.count = f.until < Date.now() ? 1 : f.count + 1;
    f.until = Date.now() + 15 * 60 * 1000;
    failures.set(ip, f);
    return { error: "Identifiant ou mot de passe incorrect." };
  }
  failures.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  const list = sessions();
  list[sid(token)] = { user, role: acc.role, expire: Date.now() + SESSION_HOURS * 3600 * 1000 };
  saveSessions(list);
  return { token };
}

function check(token) {
  if (!token || typeof token !== "string") return null;
  const list = sessions();
  const s = list[sid(token)];
  if (!s) return null;
  if (s.expire < Date.now()) { delete list[sid(token)]; saveSessions(list); return null; }
  // Compte supprimé entre-temps : la session n'est plus valable
  const acc = findAccount(s.user);
  if (!acc) { delete list[sid(token)]; saveSessions(list); return null; }
  return { user: s.user, role: acc.role || "dg", expire: s.expire };
}

function logout(token) {
  if (!token) return;
  const list = sessions();
  delete list[sid(token)];
  saveSessions(list);
}

function endSessionsOf(user) {
  const list = sessions();
  for (const k of Object.keys(list)) if (list[k].user === user) delete list[k];
  saveSessions(list);
}

function changePassword(user, current, next) {
  const acc = findAccount(user);
  if (!acc || !same(current || "", acc)) return { error: "Mot de passe actuel incorrect." };
  if (typeof next !== "string" || next.length < 10) return { error: "Le nouveau mot de passe doit faire au moins 10 caractères." };
  const salt = crypto.randomBytes(16).toString("hex");
  if (acc.principal) {
    const admin = store.load("admin", null);
    store.save("admin", { ...admin, salt, hash: hash(next, salt) });
    const f = path.join(store.DATA, "premier-acces.txt");
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } else {
    store.save("comptes", store.load("comptes", []).map((c) => (c.user === user ? { ...c, salt, hash: hash(next, salt) } : c)));
  }
  endSessionsOf(user);
  return { ok: true };
}

// Gestion des comptes par le DG
function listAccounts() {
  const admin = store.load("admin", null);
  return [{ user: admin.user, role: "dg", principal: true }].concat(store.load("comptes", []).map((c) => ({ user: c.user, role: c.role, principal: false })));
}
function addAccount(user, password, role) {
  user = typeof user === "string" ? user.trim().toLowerCase() : "";
  if (!/^[a-z0-9._-]{3,30}$/.test(user)) return { error: "Identifiant : 3 à 30 lettres ou chiffres, sans espace ni accent." };
  if (!ROLES[role]) return { error: "Rôle inconnu." };
  if (typeof password !== "string" || password.length < 10) return { error: "Le mot de passe doit faire au moins 10 caractères." };
  if (findAccount(user)) return { error: "Cet identifiant existe déjà." };
  const salt = crypto.randomBytes(16).toString("hex");
  store.save("comptes", store.load("comptes", []).concat({ user, role, salt, hash: hash(password, salt) }));
  return { ok: true };
}
function removeAccount(user) {
  const acc = findAccount(user);
  if (!acc) return { error: "Compte introuvable." };
  if (acc.principal) return { error: "Le compte principal du DG ne peut pas être supprimé." };
  store.save("comptes", store.load("comptes", []).filter((c) => c.user !== user));
  endSessionsOf(user);
  return { ok: true };
}
function resetPassword(user, next) {
  const acc = findAccount(user);
  if (!acc || acc.principal) return { error: "Compte introuvable." };
  if (typeof next !== "string" || next.length < 10) return { error: "Le mot de passe doit faire au moins 10 caractères." };
  const salt = crypto.randomBytes(16).toString("hex");
  store.save("comptes", store.load("comptes", []).map((c) => (c.user === user ? { ...c, salt, hash: hash(next, salt) } : c)));
  endSessionsOf(user);
  return { ok: true };
}

module.exports = { ensureAdmin, login, check, logout, changePassword, listAccounts, addAccount, removeAccount, resetPassword, ROLES, SESSION_HOURS };
