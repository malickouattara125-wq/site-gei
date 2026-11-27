// Génère gestion-app/fichiers.txt : la liste des fichiers que DEMARRER met à jour automatiquement,
// avec une empreinte qui change dès qu'un fichier change. À lancer avant chaque commit :
//   node gestion-app/outils/manifeste.js
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const racine = path.join(__dirname, "..");
const exclus = /^(data|uploads|fichiers|node_modules|outils)\/|^fichiers\.txt$|^DEMARRER\.bat$|\.(md|gitignore)$/;
const liste = [];
(function parcours(dir) {
  for (const n of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, n), rel = path.relative(racine, p).split(path.sep).join("/");
    if (n.startsWith(".") || exclus.test(rel + (fs.statSync(p).isDirectory() ? "/" : ""))) continue;
    if (fs.statSync(p).isDirectory()) parcours(p); else liste.push(rel);
  }
})(racine);
const h = crypto.createHash("sha256");
for (const f of liste) h.update(f).update(fs.readFileSync(path.join(racine, f)));
fs.writeFileSync(path.join(racine, "fichiers.txt"), `# GEI Gestion - fichiers mis a jour automatiquement par DEMARRER\n# empreinte ${h.digest("hex").slice(0, 16)}\n${liste.join("\n")}\n`);
console.log(`${liste.length} fichiers`);
