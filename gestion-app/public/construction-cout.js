/* GEI Gestion — volet Construction, étapes 7 à 10 :
   coût réel par villa (dépenses directes + matériel sorti du stock + part des frais communs), tableau comparatif,
   finitions (gammes, options client, récapitulatif à signer), « Mettre à jour l'avancement » (téléphone),
   alertes de retard des villas, export des dépenses d'une villa, déplacer une dépense vers une autre villa. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G || !G.construction) return;
  const { api, esc, toast, fail, views, main, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a), K = G.construction;
  const today = () => new Date().toISOString().slice(0, 10);
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const fq = (n) => String(Math.round((+n || 0) * 100) / 100).replace(".", ",");
  const argent = () => G.me().role !== "chef";
  const charger = async (...n) => Object.fromEntries(await Promise.all(n.map(async (x) => [x, await api("/api/g/" + x).catch(() => [])])));
  const CAT = K.CAT || {};
  const triLot = (a, b) => String(a.lot).localeCompare(String(b.lot), "fr", { numeric: true });

  /* ---------- Étape 7 : coût réel d'une villa ---------- */
  // Frais communs du programme = dépenses sans villa (hors achats envoyés au stock, comptés à la sortie) + paie des ouvriers du programme
  function fraisCommuns(c, d) {
    const deps = d.depenses.filter((x) => x.chantierId === c.id && !x.villaId && x.destination !== "stock");
    return { total: sum(deps, (x) => x.montant) + G.calc.paieDe(d.pointages || [], d.ouvriers || [], (p) => p.chantierId === c.id), deps };
  }
  function coutVilla(v, d) {
    const c = d.chantiers.find((x) => x.id === v.chantierId) || { id: v.chantierId };
    const directes = d.depenses.filter((x) => x.villaId === v.id);
    const sorties = (d.stock || []).filter((s) => s.villaId === v.id && s.sens === "sortie");
    const valeurSortie = (s) => s.quantite * (K.prixMoyen ? K.prixMoyen(d.stock || [], d.articles || [], s.articleId, s.chantierId) : (s.prixUnitaire || 0));
    const vs = d.villas.filter((x) => x.chantierId === c.id);
    const surfTot = sum(vs, (x) => x.surface);
    const part = c.repartition === "surface" && surfTot && v.surface ? v.surface / surfTot : vs.length ? 1 / vs.length : 0;
    const communs = fraisCommuns(c, d).total * part;
    const parCat = {};
    directes.forEach((x) => { parCat[x.categorie] = (parCat[x.categorie] || 0) + (x.montant || 0); });
    const stockVal = sum(sorties, valeurSortie);
    if (stockVal) parCat.stock = stockVal;
    if (communs) parCat.communs = communs;
    const total = sum(directes, (x) => x.montant) + stockVal + communs;
    // Matériaux consommés : achats directs avec quantité + sorties de stock
    const mat = {};
    directes.filter((x) => x.articleId && x.qte).forEach((x) => { mat[x.articleId] = (mat[x.articleId] || 0) + x.qte; });
    sorties.forEach((s) => { mat[s.articleId] = (mat[s.articleId] || 0) + s.quantite; });
    return { total, directes, sorties, stockVal, communs, part, parCat, mat, valeurSortie };
  }
  K.coutVilla = coutVilla;
  const LIB_CAT = (k) => (k === "stock" ? "Matériel sorti du stock" : k === "communs" ? "Part des frais communs" : CAT[k] || k);
  const COUL = { materiaux: "#2F5A1F", stock: "#5B8A3C", main_oeuvre: "#B5CC5A", sous_traitance: "#C88A1E", transport: "#7B7FC4", location: "#8C6A4F", frais_chantier: "#4E8C8A", administratif: "#A9402D", autre: "#9AA090", communs: "#C9C2AE" };
  const ecart = (cout, budget) => (budget ? Math.round((cout - budget) / budget * 100) : null);
  const classeEcart = (e) => (e === null ? "" : e > 0 ? "t-bad" : e > -0 && e >= -10 ? "" : "");

  /* ---------- Étape 8 : finitions ---------- */
  const GAMMES_FIN = {
    standard: { Carrelage: "Carreaux 40x40 grès émaillé, plinthes assorties", Sanitaires: "WC à poser, lavabo sur colonne, douche carrelée, robinetterie chromée", Menuiseries: "Portes intérieures isoplanes, fenêtres aluminium, porte d'entrée métallique", Peinture: "Peinture acrylique blanche à l'intérieur, façade peinte", "Faux plafond": "Plâtre dans le séjour", Cuisine: "Plan de travail carrelé, évier inox 1 bac" },
    confort: { Carrelage: "Carreaux 60x60 grès cérame, faïence murale en cuisine et salles d'eau", Sanitaires: "WC suspendu, vasque sur meuble, douche à l'italienne, mitigeurs", Menuiseries: "Portes intérieures moulurées, fenêtres aluminium avec moustiquaires, porte d'entrée blindée", Peinture: "Peinture satinée intérieure (2 teintes au choix), façade crépi teinté", "Faux plafond": "Plâtre dans toutes les pièces avec spots LED", Cuisine: "Cuisine équipée : meubles bas et hauts, plan granit, évier 2 bacs" },
    premium: { Carrelage: "Carreaux grand format 80x80 ou marbre, faïence toute hauteur", Sanitaires: "Sanitaires suspendus haut de gamme, baignoire ou douche vitrée, robinetterie design", Menuiseries: "Portes en bois massif, baies vitrées aluminium à rupture de pont thermique, porte d'entrée design blindée", Peinture: "Peinture lessivable haut de gamme, enduit décoratif, façade en pierre ou bardage", "Faux plafond": "Faux plafond décoratif avec éclairage indirect", Cuisine: "Cuisine aménagée complète avec îlot, électroménager encastré" },
  };
  const finitionsGamme = (g) => Object.entries(GAMMES_FIN[g] || GAMMES_FIN.standard).map(([poste, choix]) => ({ poste, choix, option: false, surcout: 0 }));

  /* ---------- Bloc ajouté à la fiche villa ---------- */
  K.villaPlus = async (v, c, base) => {
    const box = $("#villaPlus"); if (!box) return;
    const d = await charger("depenses", "stock", "articles", "villas", "chantiers", "ouvriers", "pointages", ...(argent() ? [] : []));
    if (!argent()) d.depenses = [];
    const blocs = [];
    // Finitions (clé en main seulement)
    if (v.niveau !== "gros_oeuvre") {
      const fin = (v.finitions || []).length ? v.finitions : [];
      const sur = sum(fin, (f) => f.surcout);
      blocs.push(`<section class="panel" id="finBloc"><div class="sec__head"><span class="sec__n">${I("house")}</span><div><h2>Finitions — gamme ${esc((K.GAMMES || {})[v.gamme] || v.gamme)}</h2><p>${fin.length ? `${fin.filter((f) => !f.option).length} poste(s)${fin.some((f) => f.option) ? ` · ${fin.filter((f) => f.option).length} option(s) client` : ""}${argent() && sur ? ` · surcoût options ${fcfa(sur)}` : ""}` : "La liste se remplit à partir de la gamme choisie."}</p></div></div>
        ${fin.length ? `<div class="tbl-wrap"><table class="tbl fin-tbl" data-nopage><thead><tr><th>Poste</th><th>Choix</th>${argent() ? '<th class="num">Surcoût</th>' : ""}</tr></thead><tbody>${fin.map((f) => `<tr class="${f.option ? "fin--opt" : ""}"><td><b>${esc(f.poste)}</b>${f.option ? ' <span class="st st--reservee">Option client</span>' : ""}</td><td>${esc(f.choix)}</td>${argent() ? `<td class="num">${f.surcout ? fcfa(f.surcout) : "—"}</td>` : ""}</tr>`).join("")}</tbody></table></div>` : '<p class="muted">Aucune finition définie pour le moment.</p>'}
        ${argent() ? `<div class="pay-actions">${fin.length ? "" : `<button type="button" class="btn btn--primary btn--sm" id="finAppl">${I("check")}Remplir avec la gamme ${esc((K.GAMMES || {})[v.gamme] || v.gamme)}</button>`}<button type="button" class="btn btn--secondary btn--sm" id="finEdit">${I("pencil")}Modifier / ajouter une option</button>${fin.length ? `<button type="button" class="btn btn--tertiary btn--sm" id="finPrint">${I("printer")}Récapitulatif à signer</button>` : ""}</div>` : ""}</section>`);
    }
    // Dépenses de la villa (direction et comptable)
    if (argent()) {
      const k = coutVilla(v, d), e = ecart(k.total, v.budget), m = null;
      const maison = (base.maisons || []).find((x) => x.id === v.maisonId);
      const barres = Object.entries(k.parCat).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]);
      const art = (id) => (d.articles || []).find((a) => a.id === id) || { nom: "?", unite: "" };
      const autresVillas = d.villas.filter((x) => x.chantierId === v.chantierId && x.id !== v.id).sort(triLot);
      blocs.push(`<section class="panel"><div class="sec__head"><span class="sec__n">${I("receipt")}</span><div><h2>Dépenses de la villa</h2><p>Coût réel : dépenses directes, matériel sorti du stock et part des frais communs (${c.repartition === "surface" ? "selon la surface" : "à parts égales"}).</p></div>
          <details class="menu-p" style="margin-left:auto"><summary class="btn btn--tertiary btn--icon" aria-label="Autres actions">${I("more")}</summary><div class="menu-p__pop"><button type="button" id="xpVilla">${I("download")}Exporter les dépenses (Excel)</button><button type="button" id="prVilla">${I("printer")}Imprimer / PDF</button></div></details></div>
        <div class="kpis kpis--3">
          <div class="kpi"><small>Coût réel</small><b>${U.money(k.total)}</b><span>${v.surface && k.total ? `${fcfa(k.total / v.surface)} / m²` : "coût au m² : surface à indiquer"}</span></div>
          <div class="kpi"><small>Budget prévu</small><b>${v.budget ? U.money(v.budget) : "—"}</b><span>${maison && maison.prix ? `prix de vente ${fcfa(maison.prix)}` : "aucun prix de vente lié"}</span></div>
          <div class="kpi${e !== null && e > 0 ? " kpi--alert" : ""}"><small>Écart</small><b class="${e === null ? "" : e > 0 ? "t-bad" : e > -10 && K.avancementVilla(v) >= 100 ? "" : ""}">${e === null ? "—" : `${e > 0 ? "+" : ""}${fcfa(k.total - v.budget)}`}</b><span>${e === null ? "budget à indiquer" : `${e > 0 ? "+" : ""}${e} %${maison && maison.prix ? ` · marge ${fcfa(maison.prix - k.total)}` : ""}`}</span></div>
        </div>
        ${barres.length ? `<div class="cbar" role="img" aria-label="Répartition du coût">${barres.map(([cat, x]) => `<i style="flex:${x};background:${COUL[cat] || "#999"}" title="${esc(LIB_CAT(cat))} : ${fcfa(x)}"></i>`).join("")}</div>
          <div class="cleg">${barres.map(([cat, x]) => `<span><i style="background:${COUL[cat] || "#999"}"></i>${esc(LIB_CAT(cat))} <b>${fcfa(x)}</b> <em>${Math.round(x / k.total * 100)} %</em></span>`).join("")}</div>` : '<p class="muted">Aucune dépense pour cette villa pour le moment.</p>'}
        ${Object.keys(k.mat).length ? `<p class="cmat"><b>Matériaux consommés :</b> ${Object.entries(k.mat).map(([id, q]) => `${fq(q)} ${esc(art(id).unite)} de ${esc(art(id).nom)}`).join(" · ")}</p>` : ""}
        <details class="onglet onglet--in"${k.directes.length ? "" : ""}><summary>${I("chevright")}<b>Dépenses directes</b><span class="muted">${k.directes.length} · ${fcfa(sum(k.directes, (x) => x.montant))}</span></summary>
          ${k.directes.length ? `<div class="tbl-wrap"><table class="tbl" data-nopage><thead><tr><th>Date</th><th>Libellé</th><th>Matériau</th><th class="num">Montant</th><th class="num">Reste</th><th>Déplacer vers</th></tr></thead><tbody>${k.directes.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((x) => { const r = G.resteDep ? G.resteDep(x) : 0;
            return `<tr><td>${U.dateFr(x.date)}</td><td><a href="#g-depense/${x.id}"><b>${esc(x.libelle)}</b></a>${x.fournisseur ? `<br><small class="muted">${esc(x.fournisseur)}</small>` : ""}</td><td>${x.articleId ? `${esc(art(x.articleId).nom)}${x.qte ? ` · ${fq(x.qte)} ${esc(x.unite || art(x.articleId).unite)}` : ""}` : "—"}</td><td class="num">${fcfa(x.montant)}</td><td class="num">${r ? `<b class="t-bad">${fcfa(r)}</b>` : '<span class="t-ok">payé</span>'}</td>
              <td><select class="dep-move" data-dep="${x.id}" aria-label="Déplacer la dépense"><option value="">—</option><option value="commun">Commune au programme</option>${autresVillas.map((o) => `<option value="${o.id}">Villa ${esc(o.lot)}</option>`).join("")}</select></td></tr>`; }).join("")}</tbody></table></div>` : '<p class="muted">Aucune dépense directe. Utilisez « Nouvelle dépense » en haut de la page.</p>'}
        </details></section>`);
      // Étape 10 : export et impression des dépenses de la villa
      K._villaExport = () => G.calc.exporter(`depenses-villa-${v.lot}`, [["Date", (x) => x.date], ["Libellé", (x) => x.libelle], ["Catégorie", (x) => CAT[x.categorie] || x.categorie], ["Matériau", (x) => (x.articleId ? art(x.articleId).nom : "")], ["Quantité", (x) => x.qte || ""], ["Unité", (x) => x.unite || ""], ["Fournisseur", (x) => x.fournisseur || ""], ["Montant", (x) => x.montant], ["Payé", (x) => (G.verseDep ? G.verseDep(x) : "")], ["Reste", (x) => (G.resteDep ? G.resteDep(x) : "")]],
        [...k.directes, ...k.sorties.map((s) => ({ date: s.date, libelle: `Sortie de stock : ${art(s.articleId).nom}`, categorie: "materiaux", articleId: s.articleId, qte: s.quantite, unite: art(s.articleId).unite, montant: Math.round(k.valeurSortie(s)) })), ...(k.communs ? [{ date: today(), libelle: "Part des frais communs du programme", categorie: "autre", montant: Math.round(k.communs) }] : [])]);
    }
    box.innerHTML = blocs.join("");
    // Actions
    if ($("#finAppl")) $("#finAppl").onclick = () => enregistrerFin(v, finitionsGamme(v.gamme), "Finitions remplies");
    if ($("#finEdit")) $("#finEdit").onclick = () => editerFinitions(v, c);
    if ($("#finPrint")) $("#finPrint").onclick = () => imprimerFinitions(v, c);
    if ($("#xpVilla")) $("#xpVilla").onclick = () => K._villaExport();
    if ($("#prVilla")) $("#prVilla").onclick = () => print();
    $$(".dep-move", box).forEach((s) => s.addEventListener("change", async () => {
      if (!s.value) return; const cible = s.value === "commun" ? "commune au programme" : `villa ${(d.villas.find((x) => x.id === s.value) || {}).lot}`;
      if (!confirm(`Déplacer cette dépense vers la ${cible} ?`)) { s.value = ""; return; }
      try { await api(`/api/g/depenses/${s.dataset.dep}`, { method: "PUT", body: s.value === "commun" ? { villaId: "", destination: "commun" } : { villaId: s.value, destination: "villa" } }); toast(`Dépense déplacée vers la ${cible}`); views["g-villa"](v.id); } catch (err) { fail(err); }
    }));
  };
  async function enregistrerFin(v, finitions, msg) { try { await api(`/api/g/villas/${v.id}`, { method: "PUT", body: { finitions } }); toast(msg || "Finitions enregistrées"); views["g-villa"](v.id); } catch (err) { fail(err); } }
  function editerFinitions(v, c) {
    const lignes = ((v.finitions || []).length ? v.finitions : finitionsGamme(v.gamme)).map((f) => ({ ...f }));
    const rendu = () => lignes.map((f, i) => `<div class="fin-l${f.option ? " fin-l--opt" : ""}" data-i="${i}"><div class="grid"><label class="field"><span>Poste</span><input data-k="poste" value="${esc(f.poste)}"></label><label class="field"><span>Surcoût ${f.option ? "" : "(option)"}</span><input data-k="surcout" inputmode="numeric" value="${f.surcout || ""}" placeholder="0"></label></div>
        <label class="field"><span>Choix</span><textarea data-k="choix" rows="2">${esc(f.choix)}</textarea></label><div class="fin-l__b"><label class="check"><input type="checkbox" data-k="option"${f.option ? " checked" : ""}> Option demandée par le client</label><button type="button" class="btn btn--tertiary btn--sm" data-rm="${i}">${I("trash")}Retirer</button></div></div>`).join("");
    const pn = K.panneau(`Finitions — villa ${v.lot}`, `<div class="fin-gam"><span class="lbl">Remplir avec une gamme</span><div class="seg">${Object.entries(K.GAMMES || { standard: "Standard", confort: "Confort", premium: "Premium" }).map(([g, l]) => `<button type="button" data-gam="${g}"${g === v.gamme ? ' class="is-on"' : ""}>${esc(l)}</button>`).join("")}</div></div><div id="finL">${rendu()}</div>
      <button type="button" class="btn btn--secondary" id="finAdd">${I("plus")}Ajouter une option client</button>`, { sous: esc(c.nom || ""), pied: `<button type="button" class="btn btn--secondary" data-pclose>Annuler</button><button type="button" class="btn btn--primary" id="finOk">${I("check")}Enregistrer</button>` });
    const box = $("#finL", pn);
    const lire = () => $$(".fin-l", box).forEach((el) => { const f = lignes[+el.dataset.i]; f.poste = $('[data-k="poste"]', el).value.trim(); f.choix = $('[data-k="choix"]', el).value.trim(); f.surcout = num($('[data-k="surcout"]', el).value); f.option = $('[data-k="option"]', el).checked; });
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (!b) return; lire(); lignes.splice(+b.dataset.rm, 1); box.innerHTML = rendu(); });
    $("#finAdd", pn).onclick = () => { lire(); lignes.push({ poste: "Option", choix: "", option: true, surcout: 0 }); box.innerHTML = rendu(); const l = $$(".fin-l", box).pop(); if (l) $('[data-k="poste"]', l).select(); };
    $$("[data-gam]", pn).forEach((b) => (b.onclick = () => { if (!confirm(`Remplacer les postes par ceux de la gamme ${b.textContent} ? Les options client sont gardées.`)) return; lire(); const opts = lignes.filter((f) => f.option); lignes.length = 0; lignes.push(...finitionsGamme(b.dataset.gam), ...opts); box.innerHTML = rendu(); $$("[data-gam]", pn).forEach((x) => x.classList.toggle("is-on", x === b)); v.gammeChoisie = b.dataset.gam; }));
    $("#finOk", pn).onclick = async () => {
      lire(); const fin = lignes.filter((f) => f.poste);
      try { await api(`/api/g/villas/${v.id}`, { method: "PUT", body: { finitions: fin, ...(v.gammeChoisie ? { gamme: v.gammeChoisie } : {}) } }); K.fermerPanneau(); toast("Finitions enregistrées"); views["g-villa"](v.id); } catch (err) { fail(err); }
    };
  }
  async function imprimerFinitions(v, c) {
    const w = open("", "_blank"); if (!w) return toast("Autorisez les fenêtres pour imprimer.", true);
    const e = await api("/api/g/entreprise").catch(() => ({})), p = e.pied || {};
    const d = await charger("maisons"); const m = d.maisons.find((x) => x.id === v.maisonId);
    const fin = v.finitions || [], sur = sum(fin, (f) => f.surcout);
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Finitions villa ${esc(v.lot)}</title><style>
      @page{size:A4;margin:16mm 16mm 30mm} body{font:11.5pt/1.5 Calibri,"Segoe UI",Arial,sans-serif;color:#111;max-width:180mm;margin:0 auto;padding:10mm 0 34mm}
      .ent{display:flex;align-items:center;gap:18px;border-bottom:2px solid #7B7FC4;padding-bottom:8px}.ent img{width:92px}.ent span{font:900 30pt/1 "Arial Black",Arial;color:#8E92D6;-webkit-text-stroke:1px #5A5FA8}
      h1{text-align:center;font-size:15pt;margin:22px 0 4px}.ref{text-align:center;color:#555;font-size:10pt;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #bbb;padding:7px 10px;text-align:left;vertical-align:top}th{background:#f1f1f8}.r{text-align:right;white-space:nowrap}.opt{background:#fff8e6}
      .sign{display:flex;justify-content:space-between;margin-top:40px}.sign div{width:45%;text-align:center;font-weight:700}.sign small{display:block;font-weight:400;color:#555}.sign .z{height:70px}
      .pied{position:fixed;bottom:0;left:0;right:0;border-top:2px solid #7B7FC4;padding-top:5px;text-align:center;font:9.5pt/1.35 "Times New Roman",serif;color:#333;background:#fff}
      .bar{text-align:center;margin:16px}.bar button{padding:10px 22px;border:0;border-radius:99px;background:#2F5A1F;color:#fff;font:600 14px sans-serif;cursor:pointer}@media print{.bar{display:none}body{padding:0}}</style></head><body>
      <div class="bar"><button onclick="print()">Imprimer / enregistrer en PDF</button></div>
      <div class="ent"><img src="${location.origin}/logo-gei.png" alt=""><span>${esc((p.activite || "Génie civil & BTP").toUpperCase())}</span></div>
      <h1>RÉCAPITULATIF DES FINITIONS</h1><p class="ref">${esc(c.nom || "")} · Villa ${esc(v.lot)}${v.type ? " · " + esc(v.type) : ""} · Gamme ${esc((K.GAMMES || {})[v.gamme] || v.gamme)}${m && m.clientNom ? " · Client : " + esc(m.clientNom) : ""}</p>
      <table><thead><tr><th>Poste</th><th>Choix retenu</th><th class="r">Surcoût</th></tr></thead><tbody>${fin.map((f) => `<tr class="${f.option ? "opt" : ""}"><td><b>${esc(f.poste)}</b>${f.option ? "<br><small>Option client</small>" : ""}</td><td>${esc(f.choix)}</td><td class="r">${f.surcout ? fcfa(f.surcout).replace(" F", " FCFA") : "—"}</td></tr>`).join("")}
      <tr><th colspan="2">Total des surcoûts (options client)</th><th class="r">${fcfa(sur).replace(" F", " FCFA")}</th></tr></tbody></table>
      <p>Les finitions ci-dessus sont acceptées par les deux parties. Toute modification ultérieure fera l'objet d'un avenant écrit et pourra entraîner un surcoût et un décalage du délai de livraison.</p><p>Fait à Abidjan, le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</p>
      <div class="sign"><div>Pour GEI<small>(signature et cachet)</small><div class="z"></div></div><div>Le client<small>(lu et approuvé, signature)</small><div class="z"></div></div></div>
      <div class="pied">Siège Social : ${esc(p.siege || "")}, ${esc(p.banque || "")}<br>RCCM : ${esc(p.rccm || "")} – Cel : ${esc(p.tel || "")}<br>Email : ${esc(p.email || "")}</div></body></html>`);
    w.document.close();
  }

  /* ---------- Tableau comparatif des villas (fiche programme) ---------- */
  K.progPlus = async (c, vs) => {
    const box = $("#progPlus"); if (!box || !argent() || !vs.length) return;
    const d = await charger("depenses", "stock", "articles", "villas", "chantiers", "ouvriers", "pointages");
    const lignes = vs.map((v) => { const k = coutVilla(v, d), a = K.avancementVilla(v), e = ecart(k.total, v.budget); return { v, k, a, e }; });
    const tot = sum(lignes, (l) => l.k.total), totB = sum(lignes, (l) => l.v.budget);
    const ecartTxt = (l) => { if (l.e === null) return "—"; if (l.a < 100 && l.k.total <= (l.v.budget || 0)) return '<span class="muted">en cours</span>'; const cl = l.e > 0 ? "t-bad" : l.e > -10 ? "" : "t-ok"; return `<b class="${l.e > 0 ? "t-bad" : Math.abs(l.e) > 10 ? "t-warn" : ""}">${l.e > 0 ? "+" : ""}${l.e} %</b>`; };
    box.innerHTML = `<details class="onglet" open><summary>${I("chevright")}<b>Comparer les villas</b><span class="muted">coût réel total ${fcfa(tot)}${totB ? ` sur ${fcfa(totB)} de budgets` : ""}</span></summary>
      <p class="t-help">Coût réel = dépenses directes + matériel sorti du stock + part des frais communs (${c.repartition === "surface" ? "selon la surface" : "à parts égales"}). Écart en ambre au-delà de 10 %, en rouge au-delà du budget.</p>
      <div class="tbl-wrap"><table class="tbl cmp-tbl" data-nopage><thead><tr><th>Villa</th><th class="num">Avancement</th><th class="num">Budget</th><th class="num">Coût réel</th><th class="num">Écart</th><th class="num">Coût au m²</th></tr></thead><tbody>
      ${lignes.map((l) => `<tr><td><a href="#g-villa/${l.v.id}"><b>${esc(l.v.lot)}</b></a>${l.v.type ? `<br><small class="muted">${esc(l.v.type)}</small>` : ""}</td><td class="num">${l.a} %</td><td class="num">${l.v.budget ? fcfa(l.v.budget) : "—"}</td><td class="num"><b>${fcfa(l.k.total)}</b></td><td class="num">${ecartTxt(l)}</td><td class="num">${l.a >= 100 && l.v.surface ? fcfa(l.k.total / l.v.surface) : "—"}</td></tr>`).join("")}
      </tbody></table></div></details>`;
  };

  /* ---------- Étape 9 : « Mettre à jour l'avancement » (téléphone) ---------- */
  views["g-avancement"] = async () => {
    const d = await charger("chantiers", "villas");
    const progs = d.chantiers.filter((c) => c.statut !== "termine" && d.villas.some((v) => v.chantierId === c.id));
    main.innerHTML = U.head("Mettre à jour l'avancement", "Choisissez la villa : vous pourrez cocher les phases, changer le pourcentage et ajouter une photo.", "", [["Chantiers", "#g-chantiers"], ["Avancement", ""]]) +
      (progs.length ? progs.map((c) => { const vs = d.villas.filter((v) => v.chantierId === c.id).sort(triLot);
        return `<section class="panel"><h2 class="av-t">${esc(c.nom)}</h2><div class="av-grid">${vs.map((v) => { const e = K.etatVilla(v), a = K.avancementVilla(v); return `<a class="av-v vt--${e}" href="#g-villa/${v.id}"><b>${esc(v.lot)}</b><span>${a} %</span><small>${esc(K.phaseEnCours(v))}</small></a>`; }).join("")}</div></section>`; }).join("")
        : U.vide("Aucune villa pour le moment. Les villas se créent dans Chantiers → programme → « Ajouter des villas ».", "house"));
  };

  /* ---------- Alertes : villas en retard ---------- */
  const alertesBase = G.alertes;
  G.alertes = async () => {
    const base = alertesBase ? await alertesBase() : [];
    const d = await charger("villas", "chantiers");
    const plus = [];
    d.chantiers.filter((c) => c.statut !== "termine").forEach((c) => {
      const tard = d.villas.filter((v) => v.chantierId === c.id && K.enRetardVilla(v));
      if (tard.length) plus.push({ niveau: "late", icone: "clock", titre: `Retard : ${c.nom}`, texte: `${tard.length} villa(s) en retard : ${tard.map((v) => v.lot).slice(0, 6).join(", ")}${tard.length > 6 ? "…" : ""}`, href: `#g-chantier/${c.id}` });
    });
    return base.concat(plus);
  };
})();
