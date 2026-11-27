// Générateur de fichiers Excel (.xlsx) sans bibliothèque.
// Un .xlsx est une archive ZIP de fichiers XML (Office Open XML) : on écrit ces XML puis l'archive (zlib + écrivain ZIP minimal).
//
// Description attendue (un « classeur ») :
// { titre, filtres, entreprise, edition: "jj/mm/aaaa", auteur,
//   feuilles: [{ nom, titre?, colonnes: [{ t: "Montant", type: "texte"|"montant"|"date"|"nombre"|"pct", total?: bool }],
//               lignes: [[valeur, …], …], total?: bool }] }
// Une cellule peut aussi être { v, type } pour changer le type d'une seule cellule (ex. une synthèse).
"use strict";
const zlib = require("zlib");

/* ---------- ZIP ---------- */
const TABLE_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = TABLE_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function zip(fichiers) {
  const locaux = [], central = [];
  let offset = 0;
  const now = new Date();
  const heure = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const jour = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [nom, contenu] of fichiers) {
    const nomB = Buffer.from(nom, "utf8"), data = Buffer.from(contenu, "utf8");
    const comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(heure, 10); h.writeUInt16LE(jour, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nomB.length, 26); h.writeUInt16LE(0, 28);
    locaux.push(h, nomB, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(heure, 12); c.writeUInt16LE(jour, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nomB.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nomB);
    offset += h.length + nomB.length + comp.length;
  }
  const cd = Buffer.concat(central), fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locaux, cd, fin]);
}

/* ---------- Outils XML ---------- */
// Caractères interdits en XML retirés, puis échappement
const x = (s) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lettre = (i) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const serieDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000 : null; };
const nombre = (v) => { if (typeof v === "number") return isFinite(v) ? v : null; const n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : null; };
const nomFeuille = (s, deja) => { let n = String(s || "Feuille").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Feuille"; let k = 2; const base = n; while (deja.has(n.toLowerCase())) n = `${base.slice(0, 28)} ${k++}`; deja.add(n.toLowerCase()); return n; };

/* ---------- Styles ---------- */
const BLEU = "FF0D2299", BLEU_FONCE = "FF0B1560";
// Index des styles de cellule (cellXfs), dans l'ordre où ils sont écrits plus bas
const S = { defaut: 0, entreprise: 1, titre: 2, info: 3, entete: 4 };
const TYPES = ["texte", "montant", "date", "nombre", "pct"];
TYPES.forEach((t, i) => { S[t + "0"] = 5 + i * 2; S[t + "1"] = 6 + i * 2; });   // 0 = ligne paire, 1 = ligne teintée
S.totalTexte = 15; S.totalMontant = 16; S.totalNombre = 17; S.totalPct = 18;

function styles() {
  const fmt = { montant: 164, date: 165, nombre: 0, pct: 167 };
  const xf = (numFmt, font, fill, border, align) => `<xf numFmtId="${numFmt}" fontId="${font}" fillId="${fill}" borderId="${border}" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`;
  const gauche = '<alignment vertical="center"/>', droite = '<alignment horizontal="right" vertical="center"/>', centre = '<alignment horizontal="center" vertical="center" wrapText="1"/>';
  const lignes = [];
  TYPES.forEach((t) => [0, 1].forEach((alt) => {
    const nf = t === "texte" ? 49 : fmt[t];
    lignes.push(xf(nf, 0, alt ? 3 : 0, 1, t === "texte" ? '<alignment vertical="center" wrapText="1"/>' : t === "date" ? '<alignment horizontal="center" vertical="center"/>' : droite));
  }));
  const xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>',
    xf(0, 1, 0, 0, gauche), xf(0, 2, 0, 0, gauche), xf(0, 3, 0, 0, gauche), xf(0, 4, 2, 1, centre),
    ...lignes,
    xf(49, 5, 4, 2, gauche), xf(fmt.montant, 5, 4, 2, droite), xf(fmt.nombre, 5, 4, 2, droite), xf(fmt.pct, 5, 4, 2, droite),
  ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0&quot; FCFA&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="167" formatCode="0&quot; %&quot;"/></numFmts>
<fonts count="6">
<font><sz val="10"/><color rgb="FF1F2328"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><color rgb="${BLEU_FONCE}"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="12"/><color rgb="FF1F2328"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF5F6670"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="10"/><color rgb="${BLEU_FONCE}"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${BLEU}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4F6FC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE3E8F7"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="3">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD3D8E4"/></left><right style="thin"><color rgb="FFD3D8E4"/></right><top style="thin"><color rgb="FFD3D8E4"/></top><bottom style="thin"><color rgb="FFD3D8E4"/></bottom><diagonal/></border>
<border><left style="thin"><color rgb="FFD3D8E4"/></left><right style="thin"><color rgb="FFD3D8E4"/></right><top style="medium"><color rgb="${BLEU}"/></top><bottom style="thin"><color rgb="FFD3D8E4"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

/* ---------- Une feuille ---------- */
const ENTETE = 6; // ligne des en-têtes du tableau (1 à 4 : bloc titre, 5 : vide)

function cellule(ref, valeur, type, alt) {
  let v = valeur, t = type;
  if (v && typeof v === "object" && "v" in v) { t = v.type || t; v = v.v; }
  const s = S[t + (alt ? "1" : "0")] != null ? S[t + (alt ? "1" : "0")] : S["texte" + (alt ? "1" : "0")];
  if (v == null || v === "") return `<c r="${ref}" s="${s}"/>`;
  if (t === "date") { const n = serieDate(v); if (n != null) return `<c r="${ref}" s="${s}"><v>${n}</v></c>`; return `<c r="${ref}" s="${S["texte" + (alt ? "1" : "0")]}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`; }
  if (t === "montant" || t === "nombre" || t === "pct") { const n = nombre(v); if (n != null) return `<c r="${ref}" s="${s}"><v>${n}</v></c>`; }
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`;
}

function feuille(f, cl) {
  const cols = (f.colonnes || []).map((c) => ({ t: String(c.t || ""), type: TYPES.includes(c.type) ? c.type : "texte", total: c.total }));
  const lignes = Array.isArray(f.lignes) ? f.lignes : [];
  const nc = Math.max(1, cols.length), der = lettre(nc - 1);
  const rows = [];
  const texte = (r, s, val) => `<row r="${r}"><c r="A${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${x(val)}</t></is></c></row>`;
  rows.push(texte(1, S.entreprise, cl.entreprise || "Global Empire Immobilier Sarl"));
  rows.push(texte(2, S.titre, f.titre || cl.titre || f.nom || ""));
  rows.push(texte(3, S.info, cl.filtres || "Toutes les données"));
  rows.push(texte(4, S.info, `Édité le ${cl.edition || ""}${cl.auteur ? ` par ${cl.auteur}` : ""}`));
  rows.push(`<row r="${ENTETE}" ht="30" customHeight="1">${cols.map((c, i) => `<c r="${lettre(i)}${ENTETE}" s="${S.entete}" t="inlineStr"><is><t xml:space="preserve">${x(c.t)}</t></is></c>`).join("")}</row>`);
  lignes.forEach((l, k) => {
    const r = ENTETE + 1 + k;
    rows.push(`<row r="${r}">${cols.map((c, i) => cellule(`${lettre(i)}${r}`, Array.isArray(l) ? l[i] : "", c.type, k % 2 === 1)).join("")}</row>`);
  });
  const premiere = ENTETE + 1, derniere = ENTETE + lignes.length;
  const avecTotal = f.total !== false && lignes.length > 0 && cols.some((c) => c.type === "montant" || c.total);
  if (avecTotal) {
    const r = derniere + 1;
    rows.push(`<row r="${r}">${cols.map((c, i) => {
      const ref = `${lettre(i)}${r}`;
      if (i === 0) return `<c r="${ref}" s="${S.totalTexte}" t="inlineStr"><is><t>Total</t></is></c>`;
      if ((c.type === "montant" && c.total !== false) || (c.total && (c.type === "nombre" || c.type === "pct"))) {
        const somme = lignes.reduce((t, l) => { const n = nombre(l && l[i] && typeof l[i] === "object" ? l[i].v : l && l[i]); return t + (n || 0); }, 0);
        const st = c.type === "montant" ? S.totalMontant : S.totalNombre;
        return `<c r="${ref}" s="${st}"><f>SUM(${lettre(i)}${premiere}:${lettre(i)}${derniere})</f><v>${Math.round(somme * 1000) / 1000}</v></c>`;
      }
      return `<c r="${ref}" s="${S.totalTexte}"/>`;
    }).join("")}</row>`);
  }
  // Largeur des colonnes selon le contenu (bornée)
  const largeurs = cols.map((c, i) => {
    let m = Math.min(28, c.t.length + 2);
    for (const l of lignes.slice(0, 500)) {
      let v = Array.isArray(l) ? l[i] : ""; if (v && typeof v === "object") v = v.v;
      const n = c.type === "date" ? 11 : c.type === "montant" ? String(Math.round(nombre(v) || 0)).length * 1.35 + 6 : String(v == null ? "" : v).length;
      if (n > m) m = n;
    }
    return Math.max(8, Math.min(c.type === "texte" ? 50 : 22, Math.ceil(m + 2)));
  });
  const filtre = lignes.length ? `<autoFilter ref="A${ENTETE}:${der}${derniere}"/>` : "";
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr filterMode="0"><pageSetUpPr fitToPage="1"/></sheetPr>
<dimension ref="A1:${der}${Math.max(ENTETE, derniere + (avecTotal ? 1 : 0))}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${ENTETE}" topLeftCell="A${ENTETE + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${ENTETE + 1}" sqref="A${ENTETE + 1}"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="16"/>
<cols>${largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>
<sheetData>${rows.join("")}</sheetData>
${filtre}
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="${nc > 6 ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;L${x("GEI Gestion")}&amp;RPage &amp;P / &amp;N</oddFooter></headerFooter>
</worksheet>`;
  return { xml, filtre: lignes.length ? `$A$${ENTETE}:$${der}$${derniere}` : null };
}

/* ---------- Classeur complet ---------- */
function classeur(cl) {
  const feuilles = (Array.isArray(cl.feuilles) && cl.feuilles.length ? cl.feuilles : [{ nom: "Feuille", colonnes: [], lignes: [] }]).slice(0, 20);
  const deja = new Set();
  const noms = feuilles.map((f) => nomFeuille(f.nom, deja));
  const faites = feuilles.map((f) => feuille(f, cl));
  const fichiers = [];
  fichiers.push(["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${noms.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`]);
  fichiers.push(["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`]);
  const iso = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  fichiers.push(["docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(cl.titre || "")}</dc:title><dc:creator>${x(cl.auteur || "GEI Gestion")}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`]);
  fichiers.push(["docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>GEI Gestion</Application><Company>${x(cl.entreprise || "Global Empire Immobilier Sarl")}</Company></Properties>`]);
  fichiers.push(["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${noms.map((n, i) => `<sheet name="${x(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets><definedNames>${faites.map((f, i) => f.filtre ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${x(noms[i].replace(/'/g, "''"))}'!${f.filtre}</definedName>` : "").join("")}${faites.map((f, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${x(noms[i].replace(/'/g, "''"))}'!$${ENTETE}:$${ENTETE}</definedName>`).join("")}</definedNames></workbook>`]);
  fichiers.push(["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${noms.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${noms.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  fichiers.push(["xl/styles.xml", styles()]);
  faites.forEach((f, i) => fichiers.push([`xl/worksheets/sheet${i + 1}.xml`, f.xml]));
  return zip(fichiers);
}

module.exports = { classeur, zip, crc32 };
