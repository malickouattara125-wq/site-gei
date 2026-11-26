/* GEI Gestion — exports PDF et Excel aux couleurs de GEI.
   Une page décrit son export une seule fois (titre, filtres, chiffres clés, tableaux) ; ce module en fait :
   - un PDF : gabarit HTML d'impression ouvert dans un nouvel onglet (A4, en-tête GEI, pied « Page X / Y »),
     l'utilisateur choisit « Enregistrer en PDF » ;
   - un Excel : fichier .xlsx natif fabriqué par le serveur (/api/g/export/xlsx).
   Description : { fichier, titre, filtres, orientation: "portrait"|"paysage", chiffres: [{ l, v, type, bad }],
                   feuilles: [{ nom, titre, colonnes: [{ t, type, total }], lignes: [[…]], total, emargement, pdf }] } */
(() => {
  const G = window.GEI;
  const esc = G.esc, toast = G.toast;
  const I = (n, c = "") => window.GEI_ICON(n, c);
  const BLEU = "#0D2299", BLEU_FONCE = "#0B1560";

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const auj = () => iso(new Date());
  const dateFr = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || ""); };
  const moisFr = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const num = (v) => { if (typeof v === "number") return isFinite(v) ? v : null; const n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : null; };
  const sep = (n) => Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ");
  const fcfa = (n) => `${sep(n)} FCFA`;
  const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  // Valeur d'une cellule pour l'affichage PDF
  function texte(val, type) {
    let v = val, t = type;
    if (v && typeof v === "object" && "v" in v) { t = v.type || t; v = v.v; }
    if (v == null || v === "") return "";
    if (t === "montant") { const n = num(v); return n == null ? esc(v) : fcfa(n); }
    if (t === "nombre") { const n = num(v); return n == null ? esc(v) : n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }); }
    if (t === "pct") { const n = num(v); return n == null ? esc(v) : `${Math.round(n)} %`; }
    if (t === "date") return esc(dateFr(v));
    return esc(v);
  }
  const aDroite = (t) => t === "montant" || t === "nombre" || t === "pct";
  const brut = (c) => (c && typeof c === "object" && "v" in c ? c.v : c);

  /* ---------- Libellé des filtres ---------- */
  function filtres(paires) {
    const l = (paires || []).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k} : ${v}`);
    return l.length ? l.join(" · ") : "Toutes les données";
  }

  /* ---------- PDF ---------- */
  function htmlPdf(doc) {
    const paysage = doc.orientation === "paysage";
    const edition = dateFr(auj());
    const feuilles = (doc.feuilles || []).filter((f) => f.pdf !== false);
    const tableau = (f) => {
      const cols = (f.colonnes || []).concat(f.emargement ? [{ t: "Émargement", type: "texte", emarg: true }] : []);
      const lignes = f.lignes || [];
      const totalOk = f.total !== false && lignes.length && cols.some((c) => c.type === "montant" || c.total);
      const tot = totalOk ? `<tr class="total">${cols.map((c, i) => {
        if (i === 0) return "<td>Total</td>";
        if ((c.type === "montant" && c.total !== false) || (c.total && (c.type === "nombre"))) return `<td class="n">${texte(lignes.reduce((s, l) => s + (num(brut(l[i])) || 0), 0), c.type)}</td>`;
        return "<td></td>";
      }).join("")}</tr>` : "";
      if (!lignes.length) return '<p class="vide">Aucune donnée pour cette sélection.</p>';
      return `<table><thead><tr>${cols.map((c) => `<th class="${aDroite(c.type) ? "n" : ""}">${esc(c.t)}</th>`).join("")}</tr></thead>
        <tbody>${lignes.map((l) => `<tr>${cols.map((c, i) => c.emarg ? '<td class="emarg"></td>' : `<td class="${aDroite(c.type) ? "n" : c.type === "date" ? "d" : ""}">${texte(l[i], c.type)}</td>`).join("")}</tr>`).join("")}${tot}</tbody></table>`;
    };
    const chiffres = (doc.chiffres || []).length ? `<div class="kpis" style="grid-template-columns:repeat(${Math.min(4, doc.chiffres.length)},1fr)">${doc.chiffres.slice(0, 4).map((k) => `<div class="kpi${k.bad ? " bad" : ""}"><small>${esc(k.l)}</small><b>${texte(k.v, k.type || "montant")}</b>${k.s ? `<span>${esc(k.s)}</span>` : ""}</div>`).join("")}</div>` : "";
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.fichier || doc.titre || "GEI")}</title>
<style>
@page { size: A4 ${paysage ? "landscape" : "portrait"}; margin: 13mm 12mm 16mm;
  @bottom-left { content: "GEI Gestion – document généré le ${edition}"; font: 7.5pt "Inter", "Segoe UI", system-ui, sans-serif; color: #6b7280; }
  @bottom-right { content: "Page " counter(page) " / " counter(pages); font: 7.5pt "Inter", "Segoe UI", system-ui, sans-serif; color: #6b7280; } }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 11pt/1.4 "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; color: #1f2328; background: #fff; }
.ent { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 6px; border-bottom: 2.5px solid ${BLEU}; }
.ent img { height: 21mm; width: auto; margin: -2mm 0; }
.ent .devise { text-align: right; font-size: 9.5pt; color: ${BLEU_FONCE}; line-height: 1.35; }
.ent .devise b { font-size: 11pt; }
.titre { margin: 12px 0 10px; }
.titre h1 { margin: 0 0 3px; font-size: 16pt; color: ${BLEU_FONCE}; letter-spacing: -.01em; }
.titre p { margin: 0; font-size: 9pt; color: #5f6670; }
.kpis { display: grid; gap: 8px; margin: 0 0 12px; }
.kpi { border: 1px solid #d3d8e4; border-left: 3px solid ${BLEU}; border-radius: 6px; padding: 6px 9px; break-inside: avoid; }
.kpi small { display: block; font-size: 8pt; color: #5f6670; text-transform: uppercase; letter-spacing: .03em; }
.kpi b { display: block; font-size: 12.5pt; color: #1f2328; white-space: nowrap; }
.kpi span { font-size: 8pt; color: #5f6670; }
.kpi.bad { border-left-color: #b42318; } .kpi.bad b { color: #b42318; }
h2 { font-size: 11.5pt; color: ${BLEU_FONCE}; margin: 14px 0 6px; break-after: avoid; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
th { background: ${BLEU}; color: #fff; font-weight: 600; text-align: left; padding: 5px 6px; border: 1px solid ${BLEU}; vertical-align: bottom; }
td { padding: 4px 6px; border: 1px solid #d3d8e4; vertical-align: top; }
tbody tr:nth-child(even) td { background: #f4f6fc; }
.n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.d { white-space: nowrap; }
.emarg { min-width: 34mm; height: 11mm; }
tr.total td { font-weight: 700; background: #e3e8f7 !important; border-top: 1.5px solid ${BLEU}; color: ${BLEU_FONCE}; }
.vide { color: #5f6670; font-style: italic; }
.note { margin-top: 10px; font-size: 8.5pt; color: #5f6670; }
.bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; background: #fff; border-bottom: 1px solid #d3d8e4; font-size: 13px; color: #374151; }
.bar button { padding: 9px 16px; border: 0; border-radius: 8px; background: ${BLEU}; color: #fff; font: 600 14px system-ui, sans-serif; cursor: pointer; }
@media screen { body { background: #eceef3; } .feuille { width: min(100%, ${paysage ? "297mm" : "210mm"}); margin: 14px auto; background: #fff; padding: 12mm; box-shadow: 0 2px 12px rgba(0,0,0,.08); } }
@media screen and (max-width: 700px) { .feuille { padding: 14px; margin: 0; } .kpis { grid-template-columns: 1fr 1fr !important; } table { font-size: 8pt; } .tbl { overflow-x: auto; } }
@media print { .bar { display: none; } .feuille { padding: 0; } }
</style></head><body>
<div class="bar"><button type="button" onclick="print()">Imprimer / Enregistrer en PDF</button><span>Dans la fenêtre d'impression, choisissez <b>« Enregistrer en PDF »</b> comme imprimante.</span></div>
<div class="feuille">
<div class="ent"><img src="${location.origin}/logo-gei.png" alt="GEI"><div class="devise"><b>Global Empire Immobilier Sarl</b><br>Votre confiance, notre engagement</div></div>
<div class="titre"><h1>${esc(doc.titre || "")}</h1><p>${esc(doc.filtres || "Toutes les données")}</p><p>Édité le ${edition} par ${esc((G.me() || {}).user || "")}</p></div>
${chiffres}
${feuilles.map((f) => `${feuilles.length > 1 || f.titre ? `<h2>${esc(f.titre || f.nom || "")}</h2>` : ""}<div class="tbl">${tableau(f)}</div>`).join("")}
${doc.note ? `<p class="note">${esc(doc.note)}</p>` : ""}
</div>
<script>addEventListener("load", function () { setTimeout(function () { try { print(); } catch (e) {} }, 350); });<\/script>
</body></html>`;
  }

  function pdf(doc, fenetre) {
    const w = fenetre || open("", "_blank");
    if (!w) { toast("Votre navigateur a bloqué la nouvelle fenêtre : autorisez les fenêtres pour ce site.", true); return; }
    w.document.open(); w.document.write(htmlPdf(doc)); w.document.close();
    if (!localStorage.getItem("gei-astuce-pdf")) {
      localStorage.setItem("gei-astuce-pdf", "1");
      toast("Astuce : dans la fenêtre d'impression, choisissez « Enregistrer en PDF » comme imprimante.");
    }
  }

  /* ---------- Excel ---------- */
  async function excel(doc) {
    toast("Préparation du fichier Excel…");
    const corps = { fichier: doc.fichier, titre: doc.titre, filtres: doc.filtres, edition: dateFr(auj()), feuilles: (doc.feuilles || []).filter((f) => f.excel !== false).map((f) => ({ nom: f.nom, titre: f.titre ? `${doc.titre} — ${f.titre}` : doc.titre, colonnes: f.colonnes, lignes: f.lignes, total: f.total })) };
    const r = await fetch("/api/g/export/xlsx", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-gei": "1" }, body: JSON.stringify(corps) });
    if (!r.ok) { let m = "Le fichier Excel n'a pas pu être créé."; try { m = (await r.json()).error || m; } catch (_) {} throw new Error(m); }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${doc.fichier || "GEI_Export"}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Fichier Excel téléchargé");
  }

  /* ---------- Choix de la période (Trésorerie, Rapport mensuel) ---------- */
  function choisirPeriode(actuelle) {
    return new Promise((ok) => {
      const now = new Date(), m0 = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
      const pr = new Date(now.getFullYear(), now.getMonth() - 1, 15), m1 = `${pr.getFullYear()}-${pad(pr.getMonth() + 1)}`;
      const finMois = (m) => { const [y, mo] = m.split("-").map(Number); return iso(new Date(y, mo, 0)); };
      const dlg = document.createElement("dialog");
      dlg.className = "exp-dlg";
      dlg.innerHTML = `<form method="dialog" class="grid grid--1">
        <h2 style="margin:0">Période à exporter</h2>
        <label class="check"><input type="radio" name="p" value="aff" checked> ${esc(actuelle || "Ce qui est affiché")}</label>
        <label class="check"><input type="radio" name="p" value="m0"> Mois en cours (${esc(moisFr(m0))})</label>
        <label class="check"><input type="radio" name="p" value="m1"> Mois précédent (${esc(moisFr(m1))})</label>
        <label class="check"><input type="radio" name="p" value="perso"> Période personnalisée</label>
        <div class="exp-dates" hidden><label><span>Du</span><input type="date" name="du" value="${m0}-01"></label><label><span>Au</span><input type="date" name="au" value="${auj()}"></label></div>
        <div class="exp-dlg__pied"><button type="button" class="btn btn--secondary" value="annuler">Annuler</button><button type="submit" class="btn btn--primary" value="ok">Exporter</button></div>
      </form>`;
      document.body.appendChild(dlg);
      const f = dlg.querySelector("form");
      f.addEventListener("change", () => { dlg.querySelector(".exp-dates").hidden = f.p.value !== "perso"; });
      const fermer = (val) => { dlg.close(); dlg.remove(); ok(val); };
      dlg.querySelector('[value="annuler"]').onclick = () => fermer(undefined);
      dlg.addEventListener("cancel", (e) => { e.preventDefault(); fermer(undefined); });
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const p = f.p.value;
        if (p === "aff") return fermer(null);
        if (p === "m0") return fermer({ du: `${m0}-01`, au: finMois(m0), libelle: moisFr(m0), mois: m0 });
        if (p === "m1") return fermer({ du: `${m1}-01`, au: finMois(m1), libelle: moisFr(m1), mois: m1 });
        const du = f.du.value, au = f.au.value;
        if (!du || !au || du > au) { toast("Indiquez une date de début et une date de fin valides.", true); return; }
        fermer({ du, au, libelle: `du ${dateFr(du)} au ${dateFr(au)}` });
      });
      dlg.showModal();
    });
  }

  /* ---------- Bouton « Exporter » + menu PDF / Excel ---------- */
  // Le chef de chantier n'a que le PDF (le serveur lui refuse l'Excel, et ses exports n'ont aucun montant)
  const bouton = (id = "xp") => { const xl = ((G.me() || {}).role) !== "chef"; return `<details class="menu-p exp" id="${id}"><summary class="btn btn--secondary">${I("download")}Exporter</summary><div class="menu-p__pop"><button type="button" data-f="pdf">${I("printer")}PDF (imprimer)</button>${xl ? `<button type="button" data-f="xlsx">${I("sheet")}Excel (.xlsx)</button>` : ""}</div></details>`; };

  // fabrique(periode) → description (ou promesse). periode : null = ce qui est affiché, sinon { du, au, libelle, mois? }
  function brancher(id, fabrique, opts = {}) {
    const box = document.getElementById(id);
    if (!box) return;
    box.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", async () => {
      box.open = false;
      const format = b.dataset.f;
      let periode = null;
      if (opts.periode) { periode = await choisirPeriode(opts.libelleAffiche); if (periode === undefined) return; }
      // La fenêtre du PDF s'ouvre tout de suite (sinon le navigateur la bloque), puis on la remplit
      const w = format === "pdf" ? open("", "_blank") : null;
      if (format === "pdf" && !w) { toast("Votre navigateur a bloqué la nouvelle fenêtre : autorisez les fenêtres pour ce site.", true); return; }
      if (w) w.document.write('<p style="font:15px system-ui;padding:24px">Préparation du document…</p>');
      try {
        const doc = await fabrique(periode);
        if (!doc) { if (w) w.close(); return; }
        if (format === "pdf") pdf(doc, w); else await excel(doc);
      } catch (e) { if (w) w.close(); toast((e && e.message) || "L'export n'a pas pu être créé.", true); }
    }));
  }
  // Fermer le menu en cliquant ailleurs
  document.addEventListener("click", (e) => { document.querySelectorAll("details.exp[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });

  /* ---------- Export « simple » à partir d'une liste de colonnes [titre, (ligne) => valeur] ---------- */
  // Type de chaque colonne deviné d'après son titre et ses valeurs (montant, date, %, nombre, texte)
  function deviner(titre, valeurs) {
    const t = String(titre).toLowerCase();
    const vs = valeurs.filter((v) => v !== "" && v != null);
    if (/%|avancement|écart/.test(t) && vs.every((v) => num(v) != null)) return "pct";
    if (vs.length && vs.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)))) return "date";
    if (/montant|budget|dépens|prix|payé|reste|coût|cout|valeur|tarif|à payer|entrée|sortie|surco|loyer|caution|salaire/.test(t) && vs.every((v) => num(v) != null)) return "montant";
    if (vs.length && vs.every((v) => typeof v === "number")) return "nombre";
    return "texte";
  }
  function simple(nom, cols, rows, opts = {}) {
    const lignes = rows.map((r) => cols.map((c) => { const v = c[1](r); return v == null ? "" : v; }));
    const colonnes = cols.map((c, i) => ({ t: c[0], type: deviner(c[0], lignes.map((l) => l[i])) }));
    const titre = opts.titre || String(nom).replace(/[-_]+/g, " ").replace(/^./, (x) => x.toUpperCase());
    return { fichier: `GEI_${slug(titre).replace(/-/g, "_")}_${auj()}`, titre, filtres: opts.filtres || "Toutes les données", orientation: colonnes.length > 7 ? "paysage" : "portrait",
      feuilles: [{ nom: titre.slice(0, 31), colonnes, lignes }] };
  }
  // Lance l'export d'une description : la fenêtre du PDF est ouverte tout de suite (clic de l'utilisateur)
  function lancer(doc, format = "xlsx") {
    if (format === "pdf") return pdf(doc);
    excel(doc).catch((e) => toast((e && e.message) || "L'export n'a pas pu être créé.", true));
  }

  G.exp = { bouton, brancher, pdf, excel, lancer, simple, filtres, dateFr, moisFr, slug, auj, choisirPeriode, htmlPdf };
})();
