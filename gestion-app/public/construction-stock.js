/* GEI Gestion — volet Construction, étape 6 : stock par programme, prix moyen d'achat, « Sortir du stock » vers une villa,
   page Stock simplifiée (une liste, filtre par programme, alertes de seuil). Les achats envoyés au stock entrent tout seuls (serveur). */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G || !G.construction) return;
  const { api, esc, toast, fail, views, main, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a), K = G.construction;
  const today = () => new Date().toISOString().slice(0, 10);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const q2 = (n) => Math.round((+n || 0) * 100) / 100;
  const fq = (n) => String(q2(n)).replace(".", ",");
  const argent = () => G.me().role !== "chef";
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const charger = async (...n) => Object.fromEntries(await Promise.all(n.map(async (x) => [x, await api("/api/g/" + x).catch(() => [])])));
  const triLot = (a, b) => String(a.lot).localeCompare(String(b.lot), "fr", { numeric: true });

  /* ---------- Calculs ---------- */
  // Quantités par matériau (pour un programme, ou pour tout GEI si chantierId est vide)
  function stockDe(stock, chantierId) {
    const r = {};
    stock.filter((s) => !chantierId || s.chantierId === chantierId).forEach((s) => {
      const o = r[s.articleId] || (r[s.articleId] = { entre: 0, sorti: 0, reste: 0 });
      if (s.sens === "entree") o.entre += s.quantite; else o.sorti += s.quantite;
      o.reste = q2(o.entre - o.sorti);
    });
    return r;
  }
  // Prix moyen d'achat d'un matériau : moyenne pondérée des achats du programme, sinon de tous les achats, sinon prix de l'article
  function prixMoyen(stock, articles, articleId, chantierId) {
    const achats = (cid) => stock.filter((s) => s.articleId === articleId && s.sens === "entree" && s.prixUnitaire > 0 && (!cid || s.chantierId === cid));
    const moy = (l) => { const q = l.reduce((t, s) => t + s.quantite, 0); return q ? Math.round(l.reduce((t, s) => t + s.quantite * s.prixUnitaire, 0) / q) : 0; };
    const a = (articles || []).find((x) => x.id === articleId);
    return moy(chantierId ? achats(chantierId) : []) || moy(achats("")) || (a && a.prixUnitaire) || 0;
  }
  K.stockDe = stockDe; K.prixMoyen = prixMoyen;
  const rafraichir = () => dispatchEvent(new HashChangeEvent("hashchange"));

  /* ---------- Sortir du stock : matériau, quantité, villa ---------- */
  async function sortirStock({ chantierId = "", villaId = "" } = {}) {
    const d = await charger("chantiers", "villas", "articles", "stock");
    const progs = d.chantiers.filter((c) => c.statut !== "termine" || c.id === chantierId);
    let cid = chantierId || (villaId && (d.villas.find((v) => v.id === villaId) || {}).chantierId) || (progs.length === 1 ? progs[0].id : "");
    const art = (id) => d.articles.find((a) => a.id === id) || { nom: "?", unite: "" };
    const optsMat = (c) => { const st = stockDe(d.stock, c), ids = Object.keys(st).filter((id) => st[id].reste > 0).sort((a, b) => art(a).nom.localeCompare(art(b).nom));
      return ids.length ? `<option value="">— Choisir —</option>${ids.map((id) => `<option value="${id}">${esc(art(id).nom)} — reste ${fq(st[id].reste)} ${esc(art(id).unite)}</option>`).join("")}` : '<option value="">Aucun matériau en stock sur ce programme</option>'; };
    const optsVilla = (c, v) => `<option value="">— Choisir la villa —</option>${d.villas.filter((x) => x.chantierId === c).sort(triLot).map((x) => `<option value="${x.id}"${x.id === v ? " selected" : ""}>Villa ${esc(x.lot)}${x.type ? " · " + esc(x.type) : ""}</option>`).join("")}`;
    const cible = d.villas.find((v) => v.id === villaId);
    const pn = K.panneau("Sortir du stock", `<form id="ss" class="grid grid--1" novalidate>
        <label class="field"><span>Programme</span><select name="chantierId"><option value="">— Choisir —</option>${progs.map((c) => `<option value="${c.id}"${c.id === cid ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label>
        <label class="field"><span>Matériau <i class="req">*</i></span><select name="articleId">${optsMat(cid)}</select></label>
        <label class="field"><span>Quantité <i class="req">*</i></span><input name="quantite" inputmode="decimal" placeholder="Ex. 40"></label>
        <p class="dm-pu" id="ssinfo"></p>
        <label class="field"><span>Villa <i class="req">*</i></span><select name="villaId">${optsVilla(cid, villaId)}</select></label>
        <div class="grid"><label class="field"><span>Date</span><input type="date" name="date" value="${today()}"></label><label class="field"><span>Note</span><input name="notes" placeholder="Facultatif"></label></div></form>`,
      { sous: cible ? `Villa ${esc(cible.lot)}` : "Matériel utilisé pour une villa", pied: `<button type="button" class="btn btn--secondary" data-pclose>Annuler</button><button type="button" class="btn btn--primary" id="ssok">${I("check")}Sortir du stock</button>` });
    const f = $("#ss", pn);
    const info = () => {
      const st = stockDe(d.stock, f.chantierId.value)[f.articleId.value], a = art(f.articleId.value), q = num(f.quantite.value);
      if (!st) return ($("#ssinfo", pn).innerHTML = "");
      const pm = prixMoyen(d.stock, d.articles, f.articleId.value, f.chantierId.value);
      $("#ssinfo", pn).innerHTML = `Reste en stock : <b>${fq(st.reste)} ${esc(a.unite)}</b>${q ? ` → après sortie : <b class="${q > st.reste ? "t-bad" : ""}">${fq(st.reste - q)} ${esc(a.unite)}</b>` : ""}${argent() && pm && q ? ` · valeur ${fcfa(q * pm)} (prix moyen ${fcfa(pm)})` : ""}`;
    };
    f.chantierId.addEventListener("change", () => { f.articleId.innerHTML = optsMat(f.chantierId.value); f.villaId.innerHTML = optsVilla(f.chantierId.value, ""); info(); });
    f.articleId.addEventListener("change", info); f.quantite.addEventListener("input", info);
    const err = (el, m) => { (el.closest("label") || el).classList.add("is-error"); el.focus(); toast(m, true); };
    $("#ssok", pn).onclick = async () => {
      $$(".is-error", f).forEach((e) => e.classList.remove("is-error"));
      const v = Object.fromEntries(new FormData(f)), q = num(v.quantite), st = stockDe(d.stock, v.chantierId)[v.articleId];
      if (!v.chantierId) return err(f.chantierId, "Choisissez le programme.");
      if (!v.articleId) return err(f.articleId, "Choisissez le matériau.");
      if (!q) return err(f.quantite, "Indiquez la quantité.");
      if (st && q > st.reste && !confirm(`Il ne reste que ${fq(st.reste)} ${art(v.articleId).unite} en stock. Enregistrer quand même ?`)) return;
      if (!v.villaId) return err(f.villaId, "Choisissez la villa qui utilise ce matériel.");
      const btn = $("#ssok", pn); btn.disabled = true;
      try {
        await api("/api/g/stock", { method: "POST", body: { sens: "sortie", articleId: v.articleId, chantierId: v.chantierId, villaId: v.villaId, quantite: q, date: v.date || today(), notes: v.notes, prixUnitaire: argent() ? prixMoyen(d.stock, d.articles, v.articleId, v.chantierId) : 0 } });
        K.fermerPanneau(); toast(`Sorti du stock : ${fq(q)} ${art(v.articleId).unite} de ${art(v.articleId).nom} → villa ${(d.villas.find((x) => x.id === v.villaId) || {}).lot || ""}`); rafraichir();
      } catch (e) { fail(e); btn.disabled = false; }
    };
  }
  /* ---------- Entrée de stock (livraison sans achat saisi, retour de matériel…) ---------- */
  async function entreeStock({ chantierId = "" } = {}) {
    const d = await charger("chantiers", "articles");
    const progs = d.chantiers.filter((c) => c.statut !== "termine" || c.id === chantierId);
    const pn = K.panneau("Entrée de stock", `<form id="es" class="grid grid--1" novalidate>
        <p class="t-help">Les achats saisis avec la destination « Stock du chantier » entrent tout seuls. Utilisez ce formulaire pour une livraison sans achat, un transfert ou un retour de matériel.</p>
        <label class="field"><span>Programme</span><select name="chantierId"><option value="">— Dépôt général —</option>${progs.map((c) => `<option value="${c.id}"${c.id === chantierId ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label>
        <label class="field"><span>Matériau <i class="req">*</i></span><select name="articleId"><option value="">— Choisir —</option>${d.articles.slice().sort((a, b) => a.nom.localeCompare(b.nom)).map((a) => `<option value="${a.id}">${esc(a.nom)} (${esc(a.unite)})</option>`).join("")}</select></label>
        <div class="grid"><label class="field"><span>Quantité <i class="req">*</i></span><input name="quantite" inputmode="decimal"></label><label class="field"><span>Date</span><input type="date" name="date" value="${today()}"></label></div>
        <label class="field"><span>Note</span><input name="notes" placeholder="Ex. bon de livraison n°…"></label></form>`,
      { pied: `<button type="button" class="btn btn--secondary" data-pclose>Annuler</button><button type="button" class="btn btn--primary" id="esok">${I("check")}Enregistrer l'entrée</button>` });
    $("#esok", pn).onclick = async () => {
      const v = Object.fromEntries(new FormData($("#es", pn))), q = num(v.quantite);
      if (!v.articleId) return toast("Choisissez le matériau.", true); if (!q) return toast("Indiquez la quantité.", true);
      try { await api("/api/g/stock", { method: "POST", body: { ...v, sens: "entree", quantite: q } }); K.fermerPanneau(); toast("Entrée de stock enregistrée"); rafraichir(); } catch (e) { fail(e); }
    };
  }
  G.sortirStock = sortirStock; G.entreeStock = entreeStock;

  /* ---------- Page Stock : une seule liste ---------- */
  views["g-stock"] = async (arg) => {
    const ouvrir = arg === "mouvement";
    const d = await charger("chantiers", "villas", "articles", "stock");
    const cid = !ouvrir && d.chantiers.some((c) => c.id === String(arg || "").split("|")[0]) ? String(arg).split("|")[0] : "";
    const st = stockDe(d.stock, cid);
    const art = (id) => d.articles.find((a) => a.id === id) || { nom: "?", unite: "", seuil: 0 };
    const ids = Object.keys(st).sort((a, b) => art(a).nom.localeCompare(art(b).nom));
    // Articles sans aucun mouvement : visibles dans la vue « Tous » pour pouvoir les suivre
    if (!cid) d.articles.forEach((a) => { if (!st[a.id]) { st[a.id] = { entre: 0, sorti: 0, reste: 0 }; ids.push(a.id); } });
    const bas = ids.filter((id) => art(id).seuil && st[id].reste <= art(id).seuil);
    const mvts = d.stock.filter((s) => !cid || s.chantierId === cid).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.creeLe || "").localeCompare(String(a.creeLe || ""))).slice(0, 150);
    const nomProg = (id) => (d.chantiers.find((c) => c.id === id) || {}).nom || "Dépôt général";
    const villa = (id) => d.villas.find((v) => v.id === id);
    const menu = argent() ? `<details class="menu-p"><summary class="btn btn--tertiary btn--icon" aria-label="Autres actions" title="Autres actions">${I("more")}</summary><div class="menu-p__pop"><a href="#g-article/nouveau">${I("plus")}Nouveau matériau (article)</a><button type="button" id="ent">${I("package")}Entrée de stock (livraison)</button></div></details>` : `<button type="button" class="btn btn--secondary" id="ent">${I("package")}Entrée</button>`;
    main.innerHTML = U.head("Stock de matériaux", cid ? `Stock du chantier : ${esc(nomProg(cid))}` : "Ce qui reste au stock, par matériau. Choisissez un programme pour voir son stock de chantier.",
      `${G.exp.bouton()}${menu}<button type="button" class="btn btn--primary" id="sortir">${I("package")}Sortir du stock</button>`, [["Opérations", "#g-stock"], ["Stock", ""]]) + `
      <div class="stk-bar"><label class="stk-prog"><span class="sr-only">Programme</span><select id="stp"><option value="">Tous les programmes</option>${d.chantiers.filter((c) => c.statut !== "termine" || c.id === cid).map((c) => `<option value="${c.id}"${c.id === cid ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label>
        ${bas.length ? `<span class="stk-alerte">${I("alertcircle")}${bas.length} matériau(x) sous le seuil</span>` : ""}</div>
      <section class="panel">${ids.length ? `<div class="tbl-wrap"><table class="tbl stk-tbl" data-nopage><thead><tr><th>Matériau</th><th class="num">Reste</th><th class="num">Entré</th><th class="num">Sorti</th><th class="num">Seuil d'alerte</th>${argent() ? '<th class="num">Prix moyen</th><th class="num">Valeur</th>' : ""}</tr></thead><tbody>
        ${ids.map((id) => { const a = art(id), o = st[id], alerte = a.seuil && o.reste <= a.seuil, pm = argent() ? prixMoyen(d.stock, d.articles, id, cid) : 0;
          // Sorties d'un programme plus grandes que ses entrées : le reste a été pris au dépôt général
          const depot = o.reste < 0 ? `<br><small class="muted">${fq(-o.reste)} ${esc(a.unite)} pris au dépôt général</small>` : "";
          return `<tr class="${alerte ? "stk--bas" : ""}"><td><b>${esc(a.nom)}</b>${alerte ? ` <span class="st st--pause">Stock bas</span>` : ""}</td><td class="num"><b class="stk-reste${alerte ? " t-bad" : ""}">${fq(Math.max(0, o.reste))}</b> ${esc(a.unite)}${depot}</td><td class="num">${fq(o.entre)}</td><td class="num">${fq(o.sorti)}</td><td class="num">${a.seuil ? `${fq(a.seuil)} ${esc(a.unite)}` : "—"}</td>${argent() ? `<td class="num">${pm ? fcfa(pm) : "—"}</td><td class="num">${pm ? fcfa(Math.max(0, o.reste) * pm) : "—"}</td>` : ""}</tr>`; }).join("")}
        </tbody></table></div>` : U.vide(cid ? "Aucun matériau dans le stock de ce chantier. Saisissez un achat avec la destination « Stock du chantier »." : "Aucun matériau pour le moment.", "package")}</section>
      <details class="onglet"><summary>${I("chevright")}<b>Derniers mouvements</b><span class="muted">${mvts.length} mouvement(s)</span></summary>
        ${mvts.length ? U.tableau([["Date", (s) => U.dateFr(s.date)], ["Matériau", (s) => esc(art(s.articleId).nom)],
          ["Mouvement", (s) => (s.sens === "entree" ? `<span class="st st--disponible">${s.depenseId ? "Achat" : "Entrée"}</span>` : '<span class="st st--en_cours">Sortie</span>')],
          ["Quantité", (s) => `${fq(s.quantite)} ${esc(art(s.articleId).unite)}`, 1], ["Programme", (s) => esc(nomProg(s.chantierId))],
          ["Villa", (s) => { const v = villa(s.villaId); return v ? `<a href="#g-villa/${v.id}">Villa ${esc(v.lot)}</a>` : "—"; }], ["Note", (s) => esc(s.notes || "")], ["Par", (s) => esc(s.creePar || "")]], mvts) : '<p class="muted">Aucun mouvement.</p>'}
      </details>`;
    $("#stp").addEventListener("change", (e) => { location.hash = e.target.value ? `#g-stock/${e.target.value}` : "#g-stock"; });
    $("#sortir").onclick = () => sortirStock({ chantierId: cid });
    if ($("#ent")) $("#ent").onclick = () => entreeStock({ chantierId: cid });
    G.exp.brancher("xp", () => {
      const tousM = d.stock.filter((s) => !cid || s.chantierId === cid).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const pm = (id) => (argent() ? prixMoyen(d.stock, d.articles, id, cid) : 0);
      const colsE = [{ t: "Matériau" }, { t: "Unité" }, { t: "Entrées", type: "nombre", total: false }, { t: "Sorties", type: "nombre", total: false }, { t: "Stock", type: "nombre", total: false }, { t: "Seuil d'alerte", type: "nombre", total: false }, { t: "État" }];
      if (argent()) colsE.push({ t: "Prix moyen", type: "montant", total: false }, { t: "Valeur", type: "montant" });
      const valeur = sum(ids, (id) => Math.max(0, st[id].reste) * pm(id));
      return { fichier: `GEI_Stock_${G.exp.auj()}${cid ? "_" + G.exp.slug(nomProg(cid)) : ""}`, titre: "Stock de matériaux", orientation: "paysage",
        filtres: G.exp.filtres([["Programme", cid ? nomProg(cid) : "tous les programmes"]]),
        chiffres: (argent() ? [{ l: "Valeur du stock", v: valeur }] : []).concat([{ l: "Matériaux suivis", v: ids.length, type: "nombre" }, { l: "Sous le seuil", v: bas.length, type: "nombre", bad: bas.length > 0 }]),
        feuilles: [
          { nom: "État du stock", titre: "État du stock", colonnes: colsE, lignes: ids.map((id) => { const a = art(id), o = st[id]; return [a.nom, a.unite, o.entre, o.sorti, Math.max(0, o.reste), a.seuil || "", a.seuil && o.reste <= a.seuil ? "Stock bas" : "Normal"].concat(argent() ? [pm(id) || "", Math.round(Math.max(0, o.reste) * pm(id))] : []); }) },
          { nom: "Mouvements", titre: "Mouvements", colonnes: [{ t: "Date", type: "date" }, { t: "Matériau" }, { t: "Mouvement" }, { t: "Quantité", type: "nombre", total: false }, { t: "Unité" }, { t: "Programme" }, { t: "Villa" }, { t: "Note" }, { t: "Par" }],
            lignes: tousM.map((s) => { const v = villa(s.villaId); return [s.date, art(s.articleId).nom, s.sens === "entree" ? (s.depenseId ? "Achat" : "Entrée") : "Sortie", s.quantite, art(s.articleId).unite, nomProg(s.chantierId), v ? "Villa " + v.lot : "", s.notes, s.creePar]; }) },
        ] };
    });
    if (ouvrir) sortirStock({});
  };
})();
