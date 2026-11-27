/* GEI Gestion — volet Construction, étape 5 : dépense rapide dans un panneau, et champs « matériau, quantité, unité,
   prix unitaire, destination (villa / commun / stock) » partagés avec le formulaire complet. Le système avance puis solde est inchangé. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G || !G.construction) return;
  const { api, esc, toast, fail, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a), K = G.construction;
  const today = () => new Date().toISOString().slice(0, 10);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const argent = () => G.me().role !== "chef";
  const opts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const sans = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const CAT = K.CAT || { materiaux: "Matériaux", main_oeuvre: "Main-d'œuvre", sous_traitance: "Sous-traitance", transport: "Transport", location: "Engins et outillage", frais_chantier: "Frais de chantier", administratif: "Études et administratif", autre: "Divers" };
  const MODES = { especes: "Espèces", virement: "Virement", cheque: "Chèque", mobile_money: "Mobile Money", autre: "Autre" };
  const UNITES = ["sac", "tonne", "barre", "m³", "voyage", "pièce", "kg", "litre", "m²", "mètre", "rouleau", "paquet", "unité"];
  // Matériaux proposés même s'ils n'existent pas encore dans le stock (créés automatiquement au premier achat)
  const SUGGESTIONS = [["Ciment CPJ 45", "sac"], ["Fer à béton de 8", "barre"], ["Fer à béton de 10", "barre"], ["Fer à béton de 12", "barre"], ["Parpaings de 15", "pièce"], ["Parpaings de 20", "pièce"],
    ["Sable", "voyage"], ["Gravier", "voyage"], ["Tôles", "pièce"], ["Carreaux", "m²"], ["Peinture", "litre"], ["Bois de coffrage", "pièce"], ["Fil d'attache", "kg"], ["Pointes", "kg"]];

  const nomsMateriaux = (articles) => { const vus = new Set(articles.map((a) => sans(a.nom))); return [...articles.map((a) => [a.nom, a.unite]), ...SUGGESTIONS.filter(([n]) => !vus.has(sans(n)))]; };
  const trouverArticle = (articles, nom) => articles.find((a) => sans(a.nom) === sans(nom));
  const destDe = (x) => (x.villaId ? x.villaId : x.destination === "stock" ? "stock" : "commun");
  const optsDest = (villas, chantierId, v) => `<option value="commun"${v === "commun" ? " selected" : ""}>Commune au programme (clôture, gardiennage…)</option><option value="stock"${v === "stock" ? " selected" : ""}>Stock du chantier</option>${
    villas.filter((x) => x.chantierId === chantierId).sort((a, b) => String(a.lot).localeCompare(String(b.lot), "fr", { numeric: true })).map((x) => `<option value="${x.id}"${x.id === v ? " selected" : ""}>Villa ${esc(x.lot)}${x.type ? " · " + esc(x.type) : ""}</option>`).join("")}`;

  // Champs à insérer dans une grille de formulaire
  function champs(x, ctx) {
    const art = (ctx.articles || []).find((a) => a.id === x.articleId);
    const noms = nomsMateriaux(ctx.articles || []);
    return `<label class="full"><span>Destination</span><select name="dest">${optsDest(ctx.villas || [], x.chantierId, destDe(x))}</select></label>
      <label class="full dm-mat"><span>Matériau <small class="muted">(pour un achat de matériaux)</small></span><input name="materiau" list="dm-mats" value="${esc(art ? art.nom : "")}" placeholder="Ex. Ciment CPJ 45, fer de 12, sable…" autocomplete="off"><datalist id="dm-mats">${noms.map(([n]) => `<option value="${esc(n)}">`).join("")}</datalist></label>
      <label><span>Quantité</span><input name="qte" inputmode="decimal" value="${x.qte || ""}" placeholder="Ex. 100"></label>
      <label><span>Unité</span><select name="unite"><option value="">—</option>${UNITES.map((u) => `<option value="${u}"${u === (x.unite || (art && art.unite) || "") ? " selected" : ""}>${u}</option>`).join("")}</select></label>
      <p class="full dm-pu" aria-live="polite"></p>`;
  }
  // Comportements : destinations du programme choisi, unité et dernier fournisseur du matériau, prix unitaire, libellé proposé
  function brancher(f, ctx) {
    const noms = nomsMateriaux(ctx.articles || []);
    let libAuto = !f.libelle.value;
    f.libelle.addEventListener("input", () => { libAuto = !f.libelle.value; });
    const pu = () => {
      const q = num(f.qte.value), m = num(f.montant && f.montant.value), u = f.unite.value || "unité";
      $(".dm-pu", f).innerHTML = q && m ? `Prix unitaire : <b>${fcfa(Math.round(m / q))}</b> / ${esc(u)}` : q ? "Le prix unitaire se calcule dès que le montant est saisi." : "";
      if (libAuto && f.materiau.value.trim()) { f.libelle.value = `${f.materiau.value.trim()}${q ? ` — ${String(q).replace(".", ",")} ${u}${q > 1 && !/s$|³|²/.test(u) ? "s" : ""}` : ""}`; }
    };
    f.materiau.addEventListener("change", () => {
      const n = f.materiau.value.trim(); if (!n) return pu();
      const s = noms.find(([x]) => sans(x) === sans(n)); if (s && s[1] && !f.unite.value) f.unite.value = s[1];
      const a = trouverArticle(ctx.articles || [], n);
      if (a && f.fournisseur && !f.fournisseur.value) {
        const der = (ctx.depenses || []).filter((d) => d.articleId === a.id && d.fournisseur).sort((p, q) => String(q.date).localeCompare(String(p.date)))[0];
        if (der) { f.fournisseur.value = der.fournisseur; toast(`Dernier fournisseur pour ce matériau : ${der.fournisseur}`); }
      }
      if (f.categorie && f.categorie.value !== "materiaux") f.categorie.value = "materiaux";
      pu();
    });
    ["qte", "unite"].forEach((k) => f[k].addEventListener("input", pu)); f.unite.addEventListener("change", pu);
    if (f.montant) f.montant.addEventListener("input", pu);
    const ch = f.chantierId;
    if (ch) ch.addEventListener("change", () => { const v = f.dest.value; f.dest.innerHTML = optsDest(ctx.villas || [], ch.value, v); });
    pu();
  }
  // Avant l'enregistrement : destination → villa / commun / stock ; matériau → article (créé s'il est nouveau)
  async function completer(b, ctx) {
    const r = { ...b }, dest = r.dest || "commun";
    r.villaId = dest !== "commun" && dest !== "stock" ? dest : ""; r.destination = dest === "stock" ? "stock" : dest === "commun" ? "commun" : "villa";
    const nom = String(r.materiau || "").trim(); r.qte = num(r.qte);
    if (nom) {
      let a = trouverArticle(ctx.articles || [], nom);
      if (!a) { a = await api("/api/g/articles", { method: "POST", body: { nom, unite: r.unite || (SUGGESTIONS.find(([n]) => sans(n) === sans(nom)) || [])[1] || "unité" } }); (ctx.articles || (ctx.articles = [])).push(a); }
      r.articleId = a.id; if (!r.unite) r.unite = a.unite;
      if (r.qte && !r.quantite) r.quantite = `${String(r.qte).replace(".", ",")} ${r.unite}`;
    } else r.articleId = "";
    delete r.dest; delete r.materiau;
    return r;
  }
  G.depenseMat = { champs, brancher, completer };

  /* ---------- Nouvelle dépense rapide (panneau) ---------- */
  async function nouvelleDepense({ chantierId = "", villaId = "" } = {}) {
    if (!argent()) return;
    const ctx = Object.fromEntries(await Promise.all(["chantiers", "villas", "articles", "depenses"].map(async (n) => [n, await api("/api/g/" + n).catch(() => [])])));
    const progs = ctx.chantiers.filter((c) => c.statut !== "termine" || c.id === chantierId);
    const x = { chantierId: chantierId || (progs.length === 1 ? progs[0].id : ""), villaId, destination: villaId ? "villa" : "commun" };
    const fours = [...new Set(ctx.depenses.map((d) => d.fournisseur).filter(Boolean))].sort();
    const cible = villaId ? ctx.villas.find((v) => v.id === villaId) : null;
    const pn = K.panneau("Nouvelle dépense", `<form id="dq" class="grid grid--1" novalidate>
        <label class="field"><span>Programme <i class="req">*</i></span><select name="chantierId"><option value="">— Choisir —</option>${progs.map((c) => `<option value="${c.id}"${c.id === x.chantierId ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label>
        <div class="grid dq__mat">${champs(x, ctx)}</div>
        <label class="field"><span>Montant total <i class="req">*</i></span><input name="montant" inputmode="numeric" placeholder="Ex. 550000"></label>
        <label class="field"><span>Libellé <i class="req">*</i></span><input name="libelle" placeholder="Ex. Ciment CPJ 45 — 100 sacs" autocomplete="off"></label>
        <div class="grid"><label class="field"><span>Catégorie</span><select name="categorie">${opts(CAT, "materiaux")}</select></label><label class="field"><span>Date</span><input type="date" name="date" value="${today()}"></label></div>
        <label class="field"><span>Fournisseur / artisan</span><input name="fournisseur" list="dq-fours" placeholder="Rechercher ou saisir un nom"><datalist id="dq-fours">${fours.map((y) => `<option value="${esc(y)}">`).join("")}</datalist></label>
        <fieldset class="dq__pay"><legend>Paiement</legend>
          <div class="seg" role="radiogroup"><button type="button" class="is-on" data-pay="tout">Tout payé</button><button type="button" data-pay="avance">Avance</button><button type="button" data-pay="rien">Pas encore</button></div>
          <div class="grid"><label class="field" data-av hidden><span>Avance versée</span><input name="avance" inputmode="numeric" placeholder="Ex. 200000"></label><label class="field" data-mode><span>Mode</span><select name="mode">${opts(MODES, "especes")}</select></label></div>
        </fieldset>
        <p class="t-help">Pour joindre une facture ou saisir plusieurs paiements : <a href="#g-depense/nouvelle/${x.chantierId || ""}${villaId ? "/" + villaId : ""}" data-complet id="dq-full">formulaire complet</a>.</p></form>`,
      { sous: cible ? `Villa ${esc(cible.lot)} · ${esc((ctx.chantiers.find((c) => c.id === cible.chantierId) || {}).nom || "")}` : "Achat de matériaux, main-d'œuvre, transport…",
        pied: `<button type="button" class="btn btn--secondary" data-pclose>Annuler</button><button type="button" class="btn btn--primary" id="dqok">${I("check")}Enregistrer</button>` });
    const f = $("#dq", pn); let mode = "tout";
    brancher(f, ctx);
    $$("[data-pay]", pn).forEach((b) => (b.onclick = () => { mode = b.dataset.pay; $$("[data-pay]", pn).forEach((y) => y.classList.toggle("is-on", y === b)); $("[data-av]", pn).hidden = mode !== "avance"; $("[data-mode]", pn).hidden = mode === "rien"; }));
    f.chantierId.addEventListener("change", () => { $("#dq-full", pn).setAttribute("href", `#g-depense/nouvelle/${f.chantierId.value}`); });
    const champErr = (el, msg) => { (el.closest("label") || el).classList.add("is-error"); el.focus(); toast(msg, true); };
    $("#dqok", pn).onclick = async () => {
      $$(".is-error", f).forEach((e) => e.classList.remove("is-error"));
      const v = Object.fromEntries(new FormData(f)), montant = num(v.montant), avance = num(v.avance);
      if (!v.chantierId) return champErr(f.chantierId, "Choisissez le programme.");
      if (!montant) return champErr(f.montant, "Indiquez le montant total.");
      if (!String(v.libelle || "").trim()) return champErr(f.libelle, "Indiquez un libellé.");
      if (mode === "avance" && (!avance || avance > montant)) return champErr(f.avance, avance > montant ? "L'avance dépasse le montant total." : "Indiquez le montant de l'avance.");
      const paye = mode === "tout" ? montant : mode === "avance" ? avance : 0;
      const btn = $("#dqok", pn); btn.disabled = true;
      try {
        const body = await completer({ ...v, montant, paiements: paye ? [{ date: v.date || today(), montant: paye, mode: v.mode }] : [] }, ctx);
        delete body.avance;
        await api("/api/g/depenses", { method: "POST", body });
        K.fermerPanneau(); G.setDirty(false);
        toast(`Dépense enregistrée : ${fcfa(montant)}${paye < montant ? ` · reste ${fcfa(montant - paye)}` : ""}`);
        dispatchEvent(new HashChangeEvent("hashchange")); // rafraîchit la page en cours
      } catch (err) { fail(err); btn.disabled = false; }
    };
    setTimeout(() => (f.chantierId.value ? f.materiau : f.chantierId).focus(), 320);
  }
  G.nouvelleDepense = nouvelleDepense;

  // Tous les liens « Nouvelle dépense » ouvrent le panneau (sauf le lien « formulaire complet »)
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#g-depense/nouvelle"]');
    if (!a || a.hasAttribute("data-complet") || e.ctrlKey || e.metaKey || e.shiftKey || !argent()) return;
    e.preventDefault();
    const [, , cid = "", vid = ""] = a.getAttribute("href").slice(1).split("/");
    nouvelleDepense({ chantierId: cid, villaId: vid });
  }, true);
})();
