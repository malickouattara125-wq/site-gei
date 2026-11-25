/* GEI Gestion — trésorerie, stock de matériaux, planning, rapport mensuel, import Excel. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G) return;
  const { api, esc, toast, fail, views, main, $, $$ } = G;
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const today = () => new Date().toISOString().slice(0, 10);
  const mois = (d) => String(d || "").slice(0, 7);
  const dfr = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const moisFr = (m) => new Date(m + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const load = async (...n) => Object.fromEntries(await Promise.all(n.map(async (x) => [x, await api("/api/g/" + x)])));
  const head = (...a) => G.ui.head(...a);
  const opts = (map, v, vide) => (vide ? `<option value="">${vide}</option>` : "") + Object.entries(map).map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const tableau = (...a) => G.ui.tableau(...a);
  const argent = () => G.me().role !== "chef";
  const nomChantier = (l, id) => (l.find((c) => c.id === id) || {}).nom || "—";
  const COMPTE = { caisse: "Caisse (espèces)", banque: "Banque", mobile_money: "Mobile Money" };
  const MODE_COMPTE = { especes: "caisse", virement: "banque", cheque: "banque", mobile_money: "mobile_money", autre: "caisse" };
  const CAT = { solde_initial: "Solde de départ", apport: "Apport / financement", vente_autre: "Autre recette", frais_generaux: "Frais généraux (bureau)", salaires: "Salaires", loyer: "Loyer", carburant: "Carburant / déplacements", impots: "Impôts et taxes", banque: "Frais bancaires", autre: "Autre" };
  const LIBCAT = { materiaux: "Matériaux", main_oeuvre: "Main-d'œuvre", sous_traitance: "Sous-traitance", transport: "Transport", location: "Engins et outillage", frais_chantier: "Frais de chantier", administratif: "Études et administratif", autre: "Divers" };
  function exporter(nom, cols, rows) {
    const cell = (v) => { const s = String(v == null ? "" : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = "﻿" + [cols.map((c) => cell(c[0])).join(";")].concat(rows.map((r) => cols.map((c) => cell(c[1](r))).join(";"))).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `${nom}-${today()}.csv`; a.click();
  }

  /* ---------- Trésorerie : toutes les entrées et sorties d'argent ---------- */
  function operations(d) {
    const ops = [];
    d.maisons.forEach((m) => (m.paiements || []).forEach((p) => ops.push({ date: p.date, sens: "entree", compte: MODE_COMPTE[p.mode] || "caisse", origine: "Vente", libelle: `Paiement ${m.clientNom || "client"} · ${m.programme} lot ${m.lot}`, montant: p.montant, href: `#g-maison/${m.id}` })));
    d.depenses.forEach((x) => (Array.isArray(x.paiements) ? x.paiements : x.paye !== false ? [{ date: x.date, montant: x.montant, mode: x.mode }] : []).forEach((p) => ops.push({ date: p.date, sens: "sortie", compte: MODE_COMPTE[p.mode] || "caisse", origine: "Dépense chantier", libelle: `${x.libelle}${x.fournisseur ? " · " + x.fournisseur : ""}`, montant: p.montant, href: `#g-depense/${x.id}` })));
    d.mouvements.forEach((x) => ops.push({ date: x.date, sens: x.sens, compte: x.compte, origine: CAT[x.categorie] || "Autre", libelle: x.libelle, montant: x.montant, href: `#g-mouvement/${x.id}` }));
    return ops.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  G.operations = operations;
  views["g-tresorerie"] = async (filtre) => {
    const d = await load("maisons", "depenses", "mouvements", "contrats");
    const [fm = "", fc = ""] = (filtre || "").split("|");
    const ops = (G.operations || operations)(d);
    const solde = (c) => sum(ops.filter((o) => o.compte === c), (o) => (o.sens === "entree" ? o.montant : -o.montant));
    const list = ops.filter((o) => (!fm || mois(o.date) === fm) && (!fc || o.compte === fc));
    const moisDispo = [...new Set(ops.map((o) => mois(o.date)).filter(Boolean))].sort().reverse();
    const ent = sum(list.filter((o) => o.sens === "entree"), (o) => o.montant), sor = sum(list.filter((o) => o.sens === "sortie"), (o) => o.montant);
    main.innerHTML = head("Trésorerie", "Tout l'argent qui entre et qui sort : ventes, dépenses de chantier, frais généraux, salaires…",
      '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button><a class="btn btn--primary" href="#g-mouvement/nouveau">+ Autre opération</a>') + `
      <div class="kpis">${Object.entries(COMPTE).map(([k, l]) => `<div class="kpi"><small>${l}</small><b>${fcfa(solde(k))}</b><span>solde actuel</span></div>`).join("")}
        <div class="kpi kpi--alert"><small>Total disponible</small><b>${fcfa(solde("caisse") + solde("banque") + solde("mobile_money"))}</b></div></div>
      <section class="panel"><p class="muted" style="margin-top:0">Les paiements des clients et les dépenses payées s'ajoutent tout seuls. Ici, enregistrez le reste : <b>solde de départ</b> de chaque compte, frais du bureau, salaires du personnel fixe, apports…</p>
        <div class="filters">
          <label>Mois<select id="fm"><option value="">Tous</option>${moisDispo.map((m) => `<option value="${m}"${m === fm ? " selected" : ""}>${moisFr(m)}</option>`).join("")}</select></label>
          <label>Compte<select id="fc">${opts(COMPTE, fc, "Tous")}</select></label>
        </div>
        ${tableau([["Date", (o) => dfr(o.date)], ["Compte", (o) => esc(COMPTE[o.compte])], ["Origine", (o) => esc(o.origine)], ["Libellé", (o) => esc(o.libelle)],
          ["Entrée", (o) => (o.sens === "entree" ? `<b style="color:#1e6b34">${fcfa(o.montant)}</b>` : ""), 1], ["Sortie", (o) => (o.sens === "sortie" ? `<b style="color:#a12a20">${fcfa(o.montant)}</b>` : ""), 1]],
          list, (o) => o.href, ["Total", "", "", `Solde de la période : <b>${fcfa(ent - sor)}</b>`, fcfa(ent), fcfa(sor)])}</section>`;
    const go = () => { location.hash = `#g-tresorerie/${encodeURIComponent($("#fm").value + "|" + $("#fc").value)}`; };
    $("#fm").onchange = go; $("#fc").onchange = go;
    $("#xp").onclick = () => exporter("tresorerie", [["Date", (o) => o.date], ["Compte", (o) => COMPTE[o.compte]], ["Origine", (o) => o.origine], ["Libellé", (o) => o.libelle], ["Entrée", (o) => (o.sens === "entree" ? o.montant : "")], ["Sortie", (o) => (o.sens === "sortie" ? o.montant : "")]], list);
  };
  views["g-mouvement"] = async (mid) => {
    const isNew = mid === "nouveau";
    const x = isNew ? { date: today(), sens: "sortie", compte: "caisse", categorie: "frais_generaux" } : (await api("/api/g/mouvements")).find((y) => y.id === mid);
    if (!x) { main.innerHTML = '<p class="empty">Opération introuvable.</p>'; return; }
    main.innerHTML = head(isNew ? "Nouvelle opération" : esc(x.libelle), "Opération de trésorerie hors chantier (bureau, salaires, apports, solde de départ…).", '<a class="btn btn--text" href="#g-tresorerie">← Retour</a>') + `
      <form class="form panel" id="f" novalidate style="max-width:860px"><div class="grid">
        <label><span>Date</span><input type="date" name="date" value="${esc(x.date || "")}"></label>
        <label><span>Entrée ou sortie</span><select name="sens">${opts({ sortie: "Sortie d'argent", entree: "Entrée d'argent" }, x.sens)}</select></label>
        <label><span>Compte</span><select name="compte">${opts(COMPTE, x.compte)}</select></label>
        <label><span>Catégorie</span><select name="categorie">${opts(CAT, x.categorie)}</select></label>
        <label class="full"><span>Libellé *</span><input name="libelle" value="${esc(x.libelle || "")}" placeholder="Ex. Loyer du bureau de novembre"></label>
        <label><span>Montant (FCFA) *</span><input name="montant" inputmode="numeric" value="${x.montant || ""}"></label>
        <label><span>Référence</span><input name="reference" value="${esc(x.reference || "")}" placeholder="Ex. n° de reçu"></label>
        <label class="full"><span>Notes</span><textarea name="notes" rows="2">${esc(x.notes || "")}</textarea></label>
      </div><div class="savebar">${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}<button type="submit" class="btn btn--primary">Enregistrer</button></div></form>`;
    const f = $("#f"); f.addEventListener("input", () => G.setDirty(true));
    f.addEventListener("submit", async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(f));
      try { await api(isNew ? "/api/g/mouvements" : `/api/g/mouvements/${x.id}`, { method: isNew ? "POST" : "PUT", body: { ...v, montant: num(v.montant), documents: x.documents || [] } }); G.setDirty(false); toast("Enregistré"); location.hash = "#g-tresorerie"; } catch (err) { fail(err); } });
    if ($("#del")) $("#del").onclick = async () => { if (!confirm("Supprimer cette opération ?")) return; try { await api(`/api/g/mouvements/${x.id}`, { method: "DELETE" }); G.setDirty(false); location.hash = "#g-tresorerie"; } catch (err) { fail(err); } };
  };

  /* ---------- Stock de matériaux ---------- */
  views["g-stock"] = async (arg) => {
    const d = await load("articles", "stock", "chantiers");
    const ouvrirMv = arg === "mouvement"; // action rapide du téléphone : ouvre directement le formulaire
    const [fc = ""] = (ouvrirMv ? "" : arg || "").split("|");
    const qte = (a, filtre = () => true) => sum(d.stock.filter((s) => s.articleId === a.id && filtre(s)), (s) => (s.sens === "entree" ? s.quantite : -s.quantite));
    const alerte = d.articles.filter((a) => a.seuil && qte(a) <= a.seuil);
    const mvts = d.stock.filter((s) => !fc || s.chantierId === fc).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 200);
    const art = (id) => d.articles.find((a) => a.id === id) || { nom: "?", unite: "" };
    main.innerHTML = head("Stock de matériaux", "Ciment, fer, sable, gravier… : ce qui entre au dépôt et ce qui part sur les chantiers.",
      (argent() ? '<a class="btn btn--ghost" href="#g-article/nouveau">+ Nouvel article</a>' : "") + '<button class="btn btn--primary" id="mv">+ Entrée / sortie</button>') + `
      ${alerte.length ? `<section class="panel">${alerte.map((a) => `<p class="alert alert--bad"><b>Stock bas</b> · ${esc(a.nom)} : il reste ${qte(a)} ${esc(a.unite)} (seuil : ${a.seuil}).</p>`).join("")}</section>` : ""}
      <section class="panel" id="form-mv" hidden><h2>Entrée ou sortie de stock</h2><form id="fm" class="grid" novalidate>
        <label><span>Date</span><input type="date" name="date" value="${today()}"></label>
        <label><span>Mouvement</span><select name="sens"><option value="sortie">Sortie vers un chantier</option><option value="entree">Entrée (livraison, achat)</option></select></label>
        <label><span>Article</span><select name="articleId">${d.articles.map((a) => `<option value="${a.id}">${esc(a.nom)} (${esc(a.unite)})</option>`).join("")}</select></label>
        <label><span>Quantité</span><input name="quantite" inputmode="decimal" placeholder="Ex. 25"></label>
        <label><span>Chantier</span><select name="chantierId"><option value="">— Dépôt / aucun —</option>${d.chantiers.map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join("")}</select></label>
        <label><span>Note</span><input name="notes" placeholder="Ex. bon de livraison n°…"></label>
        <div style="align-self:end"><button class="btn btn--primary" type="submit">Enregistrer</button></div></form></section>
      <section class="panel"><h2>Quantités en stock</h2>
        ${tableau([["Article", (a) => `<b>${esc(a.nom)}</b>`], ["En stock", (a) => `<b>${qte(a)}</b> ${esc(a.unite)}`, 1], ["Seuil d'alerte", (a) => (a.seuil ? `${a.seuil} ${esc(a.unite)}` : "—"), 1],
          ["Sorti ce mois", (a) => `${sum(d.stock.filter((s) => s.articleId === a.id && s.sens === "sortie" && mois(s.date) === mois(today())), (s) => s.quantite)} ${esc(a.unite)}`, 1]].concat(argent() ? [["Valeur du stock", (a) => fcfa(Math.max(0, qte(a)) * (a.prixUnitaire || 0)), 1]] : []),
          d.articles, argent() ? (a) => `#g-article/${a.id}` : null)}</section>
      <section class="panel"><h2>Derniers mouvements</h2><div class="filters"><label>Chantier<select id="fc"><option value="">Tous</option>${d.chantiers.map((c) => `<option value="${c.id}"${c.id === fc ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label></div>
        ${tableau([["Date", (s) => dfr(s.date)], ["Article", (s) => esc(art(s.articleId).nom)], ["Mouvement", (s) => (s.sens === "entree" ? '<span class="st st--disponible">Entrée</span>' : '<span class="st st--en_cours">Sortie</span>')],
          ["Quantité", (s) => `${s.quantite} ${esc(art(s.articleId).unite)}`, 1], ["Chantier", (s) => esc(nomChantier(d.chantiers, s.chantierId))], ["Note", (s) => esc(s.notes || "")], ["Saisi par", (s) => esc(s.creePar || "")]], mvts)}</section>`;
    $("#mv").onclick = () => { if (!d.articles.length) return toast(argent() ? "Créez d'abord un article (bouton « + Nouvel article »)." : "Demandez à la direction de créer les articles.", true); $("#form-mv").hidden = false; $("#form-mv").scrollIntoView({ behavior: "smooth" }); };
    $("#fc").onchange = () => { location.hash = `#g-stock/${$("#fc").value}`; };
    if (ouvrirMv) $("#mv").click();
    $("#fm").addEventListener("submit", async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.target));
      try { await api("/api/g/stock", { method: "POST", body: v }); toast("Mouvement enregistré"); views["g-stock"](fc); } catch (err) { fail(err); } });
  };
  views["g-article"] = async (aid) => {
    const isNew = aid === "nouveau";
    const a = isNew ? { unite: "sac", seuil: 0 } : (await api("/api/g/articles")).find((x) => x.id === aid);
    if (!a) { main.innerHTML = '<p class="empty">Article introuvable.</p>'; return; }
    main.innerHTML = head(isNew ? "Nouvel article" : esc(a.nom), "Matériau suivi en stock.", '<a class="btn btn--text" href="#g-stock">← Retour</a>') + `
      <form class="form panel" id="f" novalidate style="max-width:760px"><div class="grid">
        <label class="full"><span>Nom *</span><input name="nom" value="${esc(a.nom || "")}" list="arts" placeholder="Ex. Ciment CPJ 45"><datalist id="arts">${["Ciment CPJ 45", "Fer de 8", "Fer de 10", "Fer de 12", "Sable", "Gravier", "Parpaings de 15", "Parpaings de 20", "Carreaux", "Peinture", "Tôles"].map((x) => `<option value="${x}">`).join("")}</datalist></label>
        <label><span>Unité</span><input name="unite" value="${esc(a.unite || "")}" placeholder="sac, barre, m³, chargement…"></label>
        <label><span>Seuil d'alerte</span><input name="seuil" inputmode="decimal" value="${a.seuil || ""}" placeholder="Ex. 20"></label>
        <label><span>Prix unitaire (FCFA, facultatif)</span><input name="prixUnitaire" inputmode="numeric" value="${a.prixUnitaire || ""}"></label>
      </div><div class="savebar">${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}<button type="submit" class="btn btn--primary">Enregistrer</button></div></form>`;
    const f = $("#f"); f.addEventListener("input", () => G.setDirty(true));
    f.addEventListener("submit", async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(f));
      try { await api(isNew ? "/api/g/articles" : `/api/g/articles/${a.id}`, { method: isNew ? "POST" : "PUT", body: { ...v, seuil: num(v.seuil), prixUnitaire: num(v.prixUnitaire) } }); G.setDirty(false); toast("Enregistré"); location.hash = "#g-stock"; } catch (err) { fail(err); } });
    if ($("#del")) $("#del").onclick = async () => { if (!confirm("Supprimer cet article ? Ses mouvements de stock resteront enregistrés.")) return; try { await api(`/api/g/articles/${a.id}`, { method: "DELETE" }); G.setDirty(false); location.hash = "#g-stock"; } catch (err) { fail(err); } };
  };

  /* ---------- Planning (diagramme de Gantt) ---------- */
  // Jour (nombre entier) à partir d'une date AAAA-MM-JJ, sans décalage d'heure
  const J = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
  const iso = (y, m) => new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // 1er du mois (m de 0 à 11, débordement accepté)
  const ZOOMS = { mois: { px: 3, label: "Mois" }, trimestre: { px: 1.1, label: "Trimestre" }, annee: { px: 0.42, label: "Année" } };
  const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const memo = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };

  views["g-planning"] = async () => {
    const d = await load("chantiers", "villas");
    const tous = d.chantiers.filter((c) => c.statut !== "termine");
    // Volet Construction : villas dont les phases ont des dates
    const KC = G.construction;
    const villasDe = (c) => (d.villas || []).filter((v) => v.chantierId === c.id && (v.phases || []).some((x) => x.dateDebut || x.dateFin)).sort((a, b) => String(a.lot).localeCompare(String(b.lot), "fr", { numeric: true }));
    const bornesVilla = (v) => { const ds = (v.phases || []).flatMap((x) => [x.dateDebut, x.dateFin]).filter(Boolean).sort(); return [ds[0], ds[ds.length - 1]]; };
    const t = today();
    const enRetard = (e) => e.dateFin && e.dateFin < t && (e.avancement || 0) < 100;
    const retardJ = (fin) => J(t) - J(fin);
    let zoom = ZOOMS[memo("gei-plan-zoom")] ? memo("gei-plan-zoom") : "mois";
    let filtre = "";
    const plies = new Set(memo("gei-plan-plie") || []);

    main.innerHTML = head("Planning", "Les étapes de chaque chantier dans le temps. Survolez une barre pour le détail, cliquez pour modifier l'étape.") + `
      <section class="panel gt-alerts" id="gtr" hidden></section>
      <section class="panel">
        <div class="gt-bar">
          <div class="gt-bar__l">
            <label class="gt-filtre"><span class="sr-only">Chantier</span><select id="gtf"><option value="">Tous les chantiers</option>${tous.map((c) => `<option value="${c.id}">${esc(c.nom)}</option>`).join("")}</select></label>
            <div class="seg" role="group" aria-label="Échelle de temps">${Object.entries(ZOOMS).map(([k, z]) => `<button type="button" data-zoom="${k}"${k === zoom ? ' class="is-on" aria-pressed="true"' : ' aria-pressed="false"'}>${z.label}</button>`).join("")}</div>
            <button type="button" class="btn btn--secondary btn--sm" id="gtt">${G.ui.I("calendar")}Aujourd'hui</button>
          </div>
          <div class="gt-legend" aria-label="Légende"><span><i class="lg lg--done"></i>Réalisé</span><span><i class="lg lg--left"></i>Restant</span><span><i class="lg lg--late"></i>En retard</span><span><i class="lg lg--today"></i>Aujourd'hui</span></div>
        </div>
        <div id="gtp"></div>
      </section>`;

    const tip = document.createElement("div"); tip.className = "gt-tip"; tip.setAttribute("role", "tooltip"); main.appendChild(tip);

    function dessiner() {
      const ch = tous.filter((c) => !filtre || c.id === filtre);
      const dates = ch.flatMap((c) => [c.dateDebut, c.dateFin, ...(c.etapes || []).flatMap((e) => [e.dateDebut, e.dateFin]), ...villasDe(c).flatMap(bornesVilla)]).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x || "")).sort();
      // Retards : tous, pas seulement le premier
      const retards = ch.flatMap((c) => (c.etapes || []).map((e, i) => ({ c, e, i })).filter(({ e }) => enRetard(e)));
      $("#gtr").hidden = !retards.length;
      $("#gtr").innerHTML = retards.length ? `<div class="gt-alerts__head">${G.ui.I("alertcircle")}<b>${retards.length} étape(s) en retard</b></div><ul>${retards.map(({ c, e, i }) =>
        `<li><span><b>${esc(c.nom)}</b> — ${esc(e.nom)} : prévue pour le ${dfr(e.dateFin)}, réalisée à ${e.avancement || 0} % · <b>${retardJ(e.dateFin)} jour(s) de retard</b></span><button type="button" class="btn btn--tertiary btn--sm" data-goto="b-${c.id}-${i}" data-of="${c.id}">Voir</button></li>`).join("")}</ul>` : "";
      if (!ch.length || !dates.length) {
        $("#gtp").innerHTML = G.ui.vide(ch.length ? "Ajoutez des dates aux étapes de vos chantiers (fiche chantier → « Étapes et avancement ») pour voir le planning." : "Aucun chantier en cours.", "calendar");
        return;
      }
      const z = ZOOMS[zoom], px = z.px;
      // Bornes alignées sur l'échelle choisie, avec une marge, et toujours la date du jour incluse
      const lo = [dates[0], t].sort()[0], hi = [dates[dates.length - 1], t].sort()[1];
      let y0 = +lo.slice(0, 4), m0 = +lo.slice(5, 7) - 1, y1 = +hi.slice(0, 4), m1 = +hi.slice(5, 7) - 1;
      if (zoom === "mois") { m0 -= 1; m1 += 2; }
      else if (zoom === "trimestre") { m0 = Math.floor(m0 / 3) * 3 - 3; m1 = Math.floor(m1 / 3) * 3 + 6; }
      else { m0 = 0; m1 = 12; }
      const debut = iso(y0, m0), fin = iso(y1, m1), J0 = J(debut), W = Math.round((J(fin) - J0) * px);
      const X = (s) => Math.round((J(s) - J0) * px);
      // Repères : années (niveau haut) et mois / trimestres / années (niveau bas)
      const ticks = [], annees = [];
      for (let k = 0; ; k++) {
        const s = iso(y0, m0 + k); if (s >= fin) break;
        const y = +s.slice(0, 4), m = +s.slice(5, 7) - 1;
        if (m === 0 || k === 0) annees.push({ x: X(s), y });
        if (zoom === "mois") ticks.push({ x: X(s), l: MOIS_C[m] });
        else if (zoom === "trimestre" && m % 3 === 0) ticks.push({ x: X(s), l: `T${m / 3 + 1}` });
        else if (zoom === "annee" && m === 0) ticks.push({ x: X(s), l: String(y) });
      }
      const xT = X(t);
      const lien = (c, i) => `#g-chantier/${c.id}${i == null ? "" : `/etape/${i}`}`;
      const sansDates = (href) => `<a class="gt__nodate" href="${href}">${G.ui.I("calendar")}Dates à définir</a>`;
      const barre = (id, href, s, f, av, late, titre) => {
        if (!s || !f) return sansDates(href);
        if (f < s) [s, f] = [f, s];
        const x = X(s), w = Math.max(8, Math.round((J(f) - J(s) + 1) * px)), dedans = w >= 52;
        const info = `<b>${esc(titre)}</b><span>Début : ${dfr(s)}</span><span>Fin : ${dfr(f)}</span><span>Avancement : ${av} %</span>${late ? `<span class="is-bad">Retard : ${retardJ(f)} jour(s)</span>` : ""}`;
        return `<a class="gt__b${late ? " is-late" : ""}" id="${id}" href="${href}" style="left:${x}px;width:${w}px" data-tip="${esc(info)}" aria-label="${esc(titre)} : ${dfr(s)} au ${dfr(f)}, ${av} %"><i style="width:${av}%"></i>${dedans ? `<span class="gt__pct">${av} %</span>` : ""}</a>${dedans ? "" : `<span class="gt__pct gt__pct--out" style="left:${x + w + 6}px">${av} %</span>`}`;
      };
      const lignes = ch.map((c) => {
        const et = c.etapes || [];
        const av = et.length ? Math.round(sum(et, (e) => e.avancement) / et.length) : 0;
        const de = et.map((e) => e.dateDebut).filter(Boolean).sort(), fe = et.map((e) => e.dateFin).filter(Boolean).sort();
        const cd = c.dateDebut || de[0], cf = c.dateFin || fe[fe.length - 1], plie = plies.has(c.id);
        return `<div class="gt__row gt__row--ch" data-c="${c.id}"><div class="gt__nom">${et.length || villasDe(c).length ? `<button type="button" class="gt__chev" data-tog="${c.id}" aria-expanded="${!plie}" aria-label="${plie ? "Déplier" : "Replier"} les étapes">${G.ui.I("chevright")}</button>` : '<span class="gt__chev"></span>'}<a href="${lien(c)}">${esc(c.nom)}</a><span class="gt__av">${av} %</span></div>
          <div class="gt__track">${barre(`b-${c.id}`, lien(c), cd, cf, av, cf && cf < t && av < 100, c.nom)}</div></div>` +
          et.map((e, i) => `<div class="gt__row gt__row--et" data-of="${c.id}"${plie ? " hidden" : ""}><div class="gt__nom"><a href="${lien(c, i)}">${esc(e.nom)}</a></div>
            <div class="gt__track">${barre(`b-${c.id}-${i}`, lien(c, i), e.dateDebut, e.dateFin, e.avancement || 0, enRetard(e), `${e.nom} · ${c.nom}`)}</div></div>`).join("") +
          (KC ? villasDe(c).map((v) => { const [vs, vf] = bornesVilla(v);
            return `<div class="gt__row gt__row--et gt__row--villa" data-of="${c.id}"${plie ? " hidden" : ""}><div class="gt__nom"><a href="#g-villa/${v.id}"><b>Villa ${esc(v.lot)}</b> · ${esc(KC.phaseEnCours(v))}</a></div>
            <div class="gt__track">${barre(`b-${c.id}-v${v.id}`, `#g-villa/${v.id}`, vs, vf, KC.avancementVilla(v), KC.enRetardVilla(v), `Villa ${v.lot} · ${c.nom}`)}</div></div>`; }).join("") : "");
      }).join("");
      $("#gtp").innerHTML = `<div class="gt" id="gt"><div class="gt__in" style="width:calc(var(--gt-nom) + ${W}px)">
          <div class="gt__head"><div class="gt__nom gt__corner">Chantier / étape</div>
            <div class="gt__scale" style="width:${W}px">
              ${zoom === "annee" ? "" : `<div class="gt__years">${annees.map((a) => `<span style="left:${a.x}px">${a.y}</span>`).join("")}</div>`}
              <div class="gt__ticks">${ticks.map((k) => `<span style="left:${k.x}px">${k.l}</span>`).join("")}</div>
              <span class="gt__todaylbl" style="left:${xT}px">Aujourd'hui</span></div></div>
          <div class="gt__body">
            <div class="gt__grid" style="width:${W}px" aria-hidden="true">${ticks.map((k) => `<i style="left:${k.x}px"></i>`).join("")}<b class="gt__today" style="left:${xT}px"></b></div>
            ${lignes}
          </div></div></div>`;
      centrer(false);
    }
    const gt = () => $("#gt");
    function centrer(doux) {
      const el = gt(), lbl = el && $(".gt__todaylbl", el); if (!lbl) return;
      const nom = $(".gt__corner", el).offsetWidth;
      el.scrollTo({ left: Math.max(0, lbl.offsetLeft - (el.clientWidth - nom) / 2), behavior: doux ? "smooth" : "auto" });
    }

    // Commandes : filtre, échelle, aujourd'hui
    $("#gtf").addEventListener("change", (e) => { filtre = e.target.value; dessiner(); });
    $$("[data-zoom]").forEach((b) => (b.onclick = () => {
      zoom = b.dataset.zoom; memo("gei-plan-zoom", zoom);
      $$("[data-zoom]").forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", x === b); });
      dessiner();
    }));
    $("#gtt").onclick = () => centrer(true);

    // Replier / déplier un chantier ; « Voir » sur une alerte de retard
    const deplier = (id, ouvrir) => {
      const btn = $(`[data-tog="${id}"]`); if (!btn) return;
      ouvrir = ouvrir == null ? btn.getAttribute("aria-expanded") !== "true" : ouvrir;
      btn.setAttribute("aria-expanded", ouvrir); btn.setAttribute("aria-label", `${ouvrir ? "Replier" : "Déplier"} les étapes`);
      $$(`.gt__row--et[data-of="${id}"]`).forEach((r) => { r.hidden = !ouvrir; });
      ouvrir ? plies.delete(id) : plies.add(id); memo("gei-plan-plie", [...plies]);
    };
    const surClic = (e) => {
      const tog = e.target.closest("[data-tog]"); if (tog) { deplier(tog.dataset.tog); return; }
      const go = e.target.closest("[data-goto]"); if (!go) return;
      deplier(go.dataset.of, true);
      const b = document.getElementById(go.dataset.goto); if (!b) return;
      b.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      b.classList.remove("is-flash"); void b.offsetWidth; b.classList.add("is-flash");
      setTimeout(() => b.classList.remove("is-flash"), 2600);
    };
    $("#gtp").addEventListener("click", surClic); $("#gtr").addEventListener("click", surClic);

    // Info-bulle au survol (et au clavier)
    const montrer = (el, x, y) => { tip.innerHTML = el.dataset.tip; tip.classList.add("is-on"); const r = tip.getBoundingClientRect();
      tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x - r.width / 2)) + "px"; tip.style.top = (y - r.height - 12 < 8 ? y + 18 : y - r.height - 12) + "px"; };
    const cacher = () => tip.classList.remove("is-on");
    $("#gtp").addEventListener("mousemove", (e) => { const b = e.target.closest(".gt__b"); b ? montrer(b, e.clientX, e.clientY) : cacher(); });
    $("#gtp").addEventListener("focusin", (e) => { const b = e.target.closest(".gt__b"); if (!b) return; const r = b.getBoundingClientRect(); montrer(b, r.left + Math.min(r.width, 120) / 2, r.top); });
    $("#gtp").addEventListener("focusout", cacher);
    $("#gtp").addEventListener("scroll", cacher, true); $("#gtp").addEventListener("mouseleave", cacher);

    dessiner();
  };

  /* ---------- Rapport mensuel imprimable ---------- */
  views["g-rapport"] = async (m) => {
    m = m || mois(today());
    const d = await load("chantiers", "maisons", "depenses", "ouvriers", "pointages", "mouvements");
    const tarif = Object.fromEntries(d.ouvriers.map((o) => [o.id, o.tarifJour || 0]));
    const pts = d.pointages.filter((p) => mois(p.date) === m);
    const paie = sum(pts, (p) => sum(p.presents, (id) => tarif[id] || 0));
    const deps = d.depenses.filter((x) => mois(x.date) === m);
    const enc = d.maisons.flatMap((x) => (x.paiements || []).filter((p) => mois(p.date) === m).map((p) => ({ ...p, m: x })));
    const mv = d.mouvements.filter((x) => mois(x.date) === m && x.reference !== `paie-${""}`);
    const frais = sum(mv.filter((x) => x.sens === "sortie" && !String(x.reference || "").startsWith("paie-")), (x) => x.montant);
    const apports = sum(mv.filter((x) => x.sens === "entree" && x.categorie !== "solde_initial"), (x) => x.montant);
    const totalEnc = sum(enc, (p) => p.montant), totalDep = sum(deps, (x) => x.montant);
    const ventes = d.maisons.filter((x) => (x.paiements || []).length && mois(x.paiements[0].date) === m);
    const reste = sum(d.maisons, (x) => (["reservee", "vendue", "livree"].includes(x.statut) ? Math.max(0, (x.prix || 0) - sum(x.paiements || [], (p) => p.montant)) : 0));
    const moisDispo = [...new Set([mois(today()), ...d.depenses.map((x) => mois(x.date)), ...d.maisons.flatMap((x) => (x.paiements || []).map((p) => mois(p.date)))].filter(Boolean))].sort().reverse();
    main.innerHTML = head(`Rapport de ${moisFr(m)}`, "Résumé du mois pour la direction. Bouton « Imprimer » pour l'enregistrer en PDF.",
      `<label class="muted">Mois <select id="rm">${moisDispo.map((x) => `<option value="${x}"${x === m ? " selected" : ""}>${moisFr(x)}</option>`).join("")}</select></label><button class="btn btn--primary" onclick="print()">Imprimer / PDF</button>`) + `
      <div class="rapport">
        <div class="rapport__titre"><img src="/logo-gei.png" alt="" width="48" height="48"><div><b>Global Empire Immobilier SARL</b><br>Rapport de gestion · ${moisFr(m)}</div></div>
        <div class="kpis"><div class="kpi"><small>Encaissé (ventes)</small><b>${fcfa(totalEnc)}</b><span>${enc.length} paiement(s)</span></div>
          <div class="kpi"><small>Dépenses de chantier</small><b>${fcfa(totalDep)}</b><span>${deps.length} dépense(s)</span></div>
          <div class="kpi"><small>Paie des ouvriers</small><b>${fcfa(paie)}</b><span>${sum(pts, (p) => p.presents.length)} journées</span></div>
          <div class="kpi kpi--alert"><small>Résultat du mois</small><b>${fcfa(totalEnc + apports - totalDep - paie - frais)}</b><span>dont frais généraux ${fcfa(frais)}</span></div></div>
        <section class="panel"><h2>Chantiers</h2>${tableau([["Chantier", (c) => esc(c.nom)], ["Statut", (c) => esc({ preparation: "En préparation", en_cours: "En cours", pause: "En pause", termine: "Terminé" }[c.statut])], ["Avancement", (c) => `${(c.etapes || []).length ? Math.round(sum(c.etapes, (e) => e.avancement) / c.etapes.length) : 0} %`, 1],
          ["Dépenses du mois", (c) => fcfa(sum(deps.filter((x) => x.chantierId === c.id), (x) => x.montant) + sum(pts.filter((p) => p.chantierId === c.id), (p) => sum(p.presents, (id) => tarif[id] || 0))), 1],
          ["Budget utilisé (total)", (c) => (c.budget ? `${Math.round((sum(d.depenses.filter((x) => x.chantierId === c.id), (x) => x.montant) + sum(d.pointages.filter((p) => p.chantierId === c.id), (p) => sum(p.presents, (id) => tarif[id] || 0))) / c.budget * 100)} %` : "—"), 1]], d.chantiers.filter((c) => c.statut !== "termine"))}</section>
        <section class="panel"><h2>Dépenses par catégorie</h2>${tableau([["Catégorie", (r) => r[0]], ["Montant", (r) => fcfa(r[1]), 1]], Object.entries(LIBCAT).map(([k, l]) => [l, sum(deps.filter((x) => x.categorie === k), (x) => x.montant)]).filter((r) => r[1]).concat(paie ? [["Paie des ouvriers", paie]] : []).concat(frais ? [["Frais généraux, salaires du personnel, autres", frais]] : []), null, ["Total", fcfa(totalDep + paie + frais)])}</section>
        <section class="panel"><h2>Ventes et encaissements</h2>
          <p>${ventes.length} nouvelle(s) vente(s) ou réservation(s) ce mois · <b>${fcfa(reste)}</b> restent à encaisser au total.</p>
          ${tableau([["Date", (p) => dfr(p.date)], ["Client", (p) => esc(p.m.clientNom || "—")], ["Maison", (p) => `${esc(p.m.programme)} · lot ${esc(p.m.lot)}`], ["Montant", (p) => fcfa(p.montant), 1]], enc, null, ["Total", "", "", fcfa(totalEnc)])}</section>
      </div>`;
    $("#rm").onchange = () => { location.hash = `#g-rapport/${$("#rm").value}`; };
  };

  /* ---------- Import depuis Excel (fichier CSV) ---------- */
  const SANS = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const IMPORTS = {
    maisons: { titre: "Maisons et clients", champs: [["programme", "Programme *", ["programme", "cite", "projet"]], ["lot", "Lot *", ["lot", "numero", "villa", "n"]], ["type", "Type", ["type", "typologie"]], ["superficie", "Superficie", ["superficie", "surface", "m2"]],
      ["prix", "Prix", ["prix", "prixdevente", "montant", "cout"]], ["statut", "Statut", ["statut", "etat"]], ["clientNom", "Client", ["client", "nom", "nomduclient", "acquereur"]], ["clientTel", "Téléphone", ["telephone", "tel", "contact", "whatsapp"]],
      ["clientEmail", "E-mail", ["email", "mail", "courriel"]], ["clientPays", "Pays", ["pays", "residence"]], ["montantPaye", "Déjà payé (total)", ["paye", "dejapaye", "verse", "montantpaye", "totalverse", "avance"]]] },
    depenses: { titre: "Dépenses", champs: [["date", "Date", ["date"]], ["libelle", "Libellé *", ["libelle", "designation", "description", "objet", "article"]], ["montant", "Montant total", ["montant", "montanttotal", "montanttotalf", "total", "prix", "cout", "somme"]], ["avance", "Avance payée", ["avance", "avancepayee", "avancepayeef", "dejapaye", "montantpaye", "verse"]],
      ["categorie", "Catégorie", ["categorie", "type", "nature"]], ["fournisseur", "Fournisseur", ["fournisseur", "vendeur", "magasin"]], ["quantite", "Quantité / détail", ["quantite", "quantitedetail", "detail", "qte", "nombre"]], ["mode", "Mode de paiement", ["mode", "modedepaiement", "paiement"]], ["paye", "Tout payé (oui/non)", ["paye", "payee", "regle"]], ["chantier", "Chantier (nom)", ["chantier", "site", "projet"]]] },
    ouvriers: { titre: "Ouvriers", champs: [["nom", "Nom *", ["nom", "nomprenoms", "ouvrier", "nomsetprenoms"]], ["metier", "Métier", ["metier", "fonction", "poste", "specialite"]], ["tel", "Téléphone", ["telephone", "tel", "contact"]], ["tarifJour", "Tarif / jour", ["tarif", "tarifjour", "journalier", "salairejour", "prixjour"]]] },
    chantiers: { titre: "Chantiers", champs: [["nom", "Nom *", ["nom", "chantier", "projet"]], ["lieu", "Lieu", ["lieu", "ville", "localisation"]], ["client", "Client", ["client", "proprietaire"]], ["budget", "Budget", ["budget", "montant", "cout"]], ["dateDebut", "Début (AAAA-MM-JJ)", ["debut", "datedebut"]], ["dateFin", "Fin prévue", ["fin", "datefin"]]] },
  };
  // Modèles d'exemple à télécharger : titres reconnus automatiquement à l'import + 2 lignes d'exemple
  const MODELES = {
    maisons: [["Programme", "Lot", "Type", "Superficie", "Prix", "Statut", "Client", "Téléphone", "E-mail", "Pays", "Déjà payé"],
      ["Villas ADOHA", "A-01", "Duplex 5 pièces", "300 m²", "65000000", "Vendue", "Awa Diallo", "0700000001", "awa@exemple.com", "France", "20000000"],
      ["Villas ADOHA", "A-02", "Duplex 5 pièces", "300 m²", "65000000", "Disponible", "", "", "", "", "0"]],
    depenses: [["Date", "Désignation", "Quantité / détail", "Montant total", "Avance payée", "Catégorie", "Fournisseur", "Mode de paiement", "Chantier"],
      ["03/11/2026", "Ciment CPJ 45", "200 sacs", "1100000", "1100000", "Matériaux", "SOCOCIM", "Espèces", "Villas ADOHA"],
      ["06/11/2026", "Fer à béton de 12", "300 barres", "2450000", "1500000", "Matériaux", "Quincaillerie Abobo", "Virement", "Villas ADOHA"]],
    ouvriers: [["Nom", "Métier", "Téléphone", "Tarif jour"],
      ["Traoré Moussa", "Maçon", "0700000002", "8000"], ["Kouassi Jean", "Charpentier", "0700000003", "9000"]],
    chantiers: [["Nom", "Lieu", "Client", "Budget", "Date début", "Date fin"],
      ["Villas ADOHA", "Bingerville", "Programme GEI", "180000000", "01/06/2026", "30/03/2027"],
      ["Résidence ADJIN", "Bingerville", "Programme GEI", "95000000", "10/08/2026", "30/05/2027"]],
  };
  function telechargerModele(type) {
    const cell = (v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = "﻿" + MODELES[type].map((r) => r.map(cell).join(";")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `modele-${type}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const VALEURS = {
    statut: { disponible: "disponible", libre: "disponible", reservee: "reservee", reserve: "reservee", vendue: "vendue", vendu: "vendue", livree: "livree", livre: "livree" },
    categorie: { materiaux: "materiaux", materiel: "materiaux", maindoeuvre: "main_oeuvre", mainduvre: "main_oeuvre", transport: "transport", location: "location", engins: "location", enginsetoutillage: "location", administratif: "administratif", admin: "administratif", etudes: "administratif", etudesetadministratif: "administratif", soustraitance: "sous_traitance", fraisdechantier: "frais_chantier", frais: "frais_chantier", divers: "autre", autre: "autre" },
    mode: { especes: "especes", cash: "especes", virement: "virement", cheque: "cheque", mobilemoney: "mobile_money", orangemoney: "mobile_money", mtnmoney: "mobile_money", moovmoney: "mobile_money", wave: "mobile_money" },
  };
  // Lecture d'un fichier CSV : séparateur point-virgule, virgule ou tabulation, détecté sur la ligne des titres
  function lireCSV(texte) {
    texte = texte.replace(/^﻿/, "");
    const l1 = texte.split(/\r?\n/)[0].replace(/"[^"]*"/g, "");
    const sep = [";", "\t", ","].map((s) => [s, l1.split(s).length - 1]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (q) { if (c === '"' && texte[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && texte[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  // Texte du fichier : UTF-8, sinon Windows-1252 (accents des fichiers enregistrés par Excel)
  async function texteFichier(file) {
    const buf = await file.arrayBuffer();
    try { return { texte: new TextDecoder("utf-8", { fatal: true }).decode(buf), enc: "UTF-8" }; }
    catch { return { texte: new TextDecoder("windows-1252").decode(buf), enc: "Windows-1252" }; }
  }
  const dateISO = (v) => { v = String(v || "").trim(); let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v); if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return ""; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; } m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); return m ? m[0] : ""; };
  const MONTANTS = ["prix", "montant", "avance", "tarifJour", "budget", "montantPaye"], DATES = ["date", "dateDebut", "dateFin"];
  const OBLIG = { maisons: [["programme", "Programme manquant"], ["lot", "Lot manquant"]], depenses: [["libelle", "Désignation manquante"]], ouvriers: [["nom", "Nom manquant"]], chantiers: [["nom", "Nom manquant"]] };
  const INFO_IMPORT = {
    maisons: { ic: "house", desc: "Lots, prix, clients et sommes déjà versées.", page: "#g-maisons", lien: "Voir les maisons" },
    depenses: { ic: "receipt", desc: "Achats et frais, avec l'avance payée.", page: "#g-depenses", lien: "Voir les dépenses" },
    ouvriers: { ic: "users", desc: "Noms, métiers, téléphones et tarifs par jour.", page: "#g-equipes", lien: "Voir les équipes" },
    chantiers: { ic: "hardhat", desc: "Nom, lieu, client, budget et dates.", page: "#g-chantiers", lien: "Voir les chantiers" },
  };
  const taille = (o) => (o < 1024 ? `${o} o` : o < 1048576 ? `${(o / 1024).toFixed(1).replace(".", ",")} Ko` : `${(o / 1048576).toFixed(1).replace(".", ",")} Mo`);

  views["g-import"] = async () => {
    const chantiers = await api("/api/g/chantiers");
    const I = G.ui.I;
    let type = "", fichier = null, tetes = [], lignes = [], resultat = null;
    const histo = () => { try { return JSON.parse(localStorage.getItem("gei-imports")) || []; } catch { return []; } };

    main.innerHTML = head("Importer depuis Excel", "Reprenez vos fichiers Excel existants en 3 étapes : préparer, importer, vérifier.") + `
      <ol class="wiz" id="wiz" aria-label="Étapes de l'import">
        <li data-s="1"><span>1</span>Préparer</li><li data-s="2"><span>2</span>Importer</li><li data-s="3"><span>3</span>Vérifier</li></ol>
      <section class="panel"><div class="sec__head"><span class="sec__n">1</span><div><h2>Préparer le fichier</h2><p>Choisissez ce que vous importez et téléchargez le modèle à remplir dans Excel.</p></div></div>
        <div class="imp-cards" role="radiogroup" aria-label="Type de données">${Object.entries(IMPORTS).map(([k, v]) => `
          <div class="imp-card" role="radio" tabindex="0" data-type="${k}" aria-checked="false">
            <span class="imp-card__ic">${I(INFO_IMPORT[k].ic, "ic--20")}</span>
            <b>${esc(v.titre)}</b><p>${INFO_IMPORT[k].desc}</p>
            <button type="button" class="btn btn--secondary btn--sm" data-modele="${k}">${I("download")}Télécharger le modèle</button></div>`).join("")}</div>
        <p class="note">${I("alertcircle")}<span><b>Dépenses :</b> la colonne « Chantier » doit porter le nom exact d'un chantier déjà créé dans l'application, sinon la ligne est signalée en erreur.</span></p>
        <details class="howto"><summary>${I("chevright")}Comment faire ?</summary>
          <ol><li>Téléchargez le modèle qui correspond à vos données, puis ouvrez-le dans Excel.</li>
            <li>Remplacez les 2 lignes d'exemple par vos données. Gardez la première ligne (les titres).</li>
            <li>Vous partez de votre propre fichier ? Dans Excel : <b>Fichier</b> → <b>Enregistrer sous</b> → type <b>« CSV (séparateur : point-virgule) »</b>.</li>
            <li>Revenez ici et déposez le fichier à l'étape 2.</li></ol></details>
      </section>
      <section class="panel"><div class="sec__head"><span class="sec__n">2</span><div><h2>Importer le fichier</h2><p>Déposez votre fichier CSV : le type de données est reconnu tout seul.</p></div></div>
        <label class="dz" id="dz"><input type="file" id="if" accept=".csv,.txt,text/csv" class="sr-only">
          <span class="dz__ic">${I("upload", "ic--20")}</span><b>Glissez votre fichier CSV ici</b><span>ou <u>cliquez pour parcourir</u></span></label>
        <div id="fi" hidden></div>
      </section>
      <section class="panel" id="ip" hidden></section>
      <section class="panel" id="ih"></section>`;

    const etape = (n) => $$("#wiz li").forEach((li) => { const s = +li.dataset.s; li.className = s < n ? "is-done" : s === n ? "is-on" : ""; li.toggleAttribute("aria-current", s === n); });
    const choisirType = (k) => { type = k; $$(".imp-card").forEach((c) => { const on = c.dataset.type === k; c.classList.toggle("is-on", on); c.setAttribute("aria-checked", on); }); };

    // Détection du type d'après les titres de colonnes
    const detecter = (h) => {
      const t = h.map(SANS);
      return Object.entries(IMPORTS).map(([k, v]) => [k, v.champs.filter(([, , al]) => t.some((x) => al.includes(x))).length]).sort((a, b) => b[1] - a[1])[0][0];
    };
    const correspondance = () => IMPORTS[type].champs.map(([k, , al]) => [k, tetes.findIndex((h) => al.includes(SANS(h)))]);
    const lireMap = () => { const sel = $$("#ip [data-champ]"); return sel.length ? sel.map((s) => [s.dataset.champ, +s.value]) : correspondance(); };

    // Conversion + contrôle d'une ligne (mêmes règles que le serveur, avec des messages clairs)
    function convertir(r, map) {
      const o = {}, err = [];
      for (const [k, i] of map) if (i >= 0) o[k] = String(r[i] == null ? "" : r[i]).trim();
      for (const k of MONTANTS) if (o[k]) {
        const v = o[k].replace(/\s| | |fcfa|f\b/gi, "");
        if (!/^\d+([.,]\d+)?$/.test(v)) err.push(`Montant invalide (« ${o[k]} »)`); else o[k] = v.replace(",", ".");
      }
      for (const k of DATES) if (o[k]) { const v = dateISO(o[k]); if (!v) err.push(`Date au mauvais format (« ${o[k]} », attendu jj/mm/aaaa)`); else o[k] = v; }
      for (const k of ["statut", "categorie", "mode"]) if (o[k] != null) o[k] = VALEURS[k] ? VALEURS[k][SANS(o[k])] || "" : o[k];
      if (o.chantier != null) {
        if (o.chantier) { const c = chantiers.find((x) => SANS(x.nom) === SANS(o.chantier)) || chantiers.find((x) => SANS(o.chantier) && SANS(x.nom).includes(SANS(o.chantier))); if (c) o.chantierId = c.id; else err.push(`Chantier inconnu (« ${o.chantier} »)`); }
        delete o.chantier;
      }
      if (type === "depenses" && o.avance && o.montant && +o.avance > +o.montant) err.push("Avance plus grande que le montant total");
      for (const [k, msg] of OBLIG[type]) if (!o[k]) err.push(msg);
      return { o, err };
    }

    async function chargerFichier(file) {
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) return toast("Fichier trop lourd (4 Mo au maximum).", true);
      const { texte, enc } = await texteFichier(file);
      const rows = lireCSV(texte);
      if (rows.length < 2) return toast("Le fichier est vide ou n'a pas de ligne de titres.", true);
      fichier = { nom: file.name, taille: file.size, enc }; tetes = rows[0].map((h) => h.trim()); lignes = rows.slice(1); resultat = null;
      choisirType(detecter(tetes));
      $("#dz").hidden = true; $("#fi").hidden = false;
      dessinerFichier(); verifier(true);
      etape(3); $("#ip").scrollIntoView({ block: "start", behavior: "smooth" });
    }
    function dessinerFichier() {
      $("#fi").innerHTML = `<div class="file-chip">${I("file", "ic--20")}<div><b>${esc(fichier.nom)}</b><span>${taille(fichier.taille)} · ${lignes.length} ligne(s) · encodage ${fichier.enc}</span></div>
          <button type="button" class="btn btn--tertiary btn--sm btn--icon" id="rm" aria-label="Retirer le fichier" title="Retirer le fichier">${I("x")}</button></div>
        <label class="imp-type"><span>Type de données <em>(reconnu automatiquement, modifiable)</em></span><select id="it">${Object.entries(IMPORTS).map(([k, v]) => `<option value="${k}"${k === type ? " selected" : ""}>${esc(v.titre)}</option>`).join("")}</select></label>`;
      $("#rm").onclick = retirer;
      $("#it").addEventListener("change", (e) => { choisirType(e.target.value); verifier(true); });
    }
    function retirer() {
      fichier = null; tetes = []; lignes = []; resultat = null; $("#if").value = "";
      $("#dz").hidden = false; $("#fi").hidden = true; $("#fi").innerHTML = ""; $("#ip").hidden = true; etape(type ? 2 : 1);
    }

    function verifier(nouvelleCorrespondance) {
      if (!fichier) return;
      const map = nouvelleCorrespondance ? correspondance() : lireMap();
      const conv = lignes.map((r, i) => ({ n: i + 2, r, ...convertir(r, map) }));
      const ok = conv.filter((x) => !x.err.length), ko = conv.filter((x) => x.err.length);
      const champs = IMPORTS[type].champs.filter(([k]) => (map.find((m) => m[0] === k) || [])[1] >= 0);
      const valeur = (x, k) => { const i = (map.find((m) => m[0] === k) || [])[1]; return i >= 0 ? x.r[i] || "" : ""; };
      const nonReconnus = IMPORTS[type].champs.filter(([k]) => (map.find((m) => m[0] === k) || [])[1] < 0).map(([, l]) => l.replace(" *", ""));
      $("#ip").hidden = false;
      $("#ip").innerHTML = `<div class="sec__head"><span class="sec__n">3</span><div><h2>Vérifier et importer</h2><p>Aperçu des 10 premières lignes. Les lignes en erreur ne seront pas importées.</p></div></div>
        <div class="imp-sum"><span class="imp-sum__ok">${I("check")}<b>${ok.length}</b> ligne(s) valide(s)</span>${ko.length ? `<span class="imp-sum__ko">${I("alertcircle")}<b>${ko.length}</b> erreur(s)</span>` : ""}<span class="t-help">${esc(IMPORTS[type].titre)} · ${lignes.length} ligne(s) dans le fichier</span></div>
        <div class="tbl-wrap"><table class="tbl imp-tbl" data-nopage><thead><tr><th>Ligne</th><th>État</th>${champs.map(([, l]) => `<th>${esc(l.replace(" *", ""))}</th>`).join("")}</tr></thead>
          <tbody>${conv.slice(0, 10).map((x) => `<tr class="${x.err.length ? "is-err" : ""}"><td>${x.n}</td><td>${x.err.length ? `<span class="imp-err">${I("alertcircle")}${esc(x.err.join(" · "))}</span>` : `<span class="imp-ok" title="Ligne valide">${I("check")}</span>`}</td>${champs.map(([k]) => `<td>${esc(valeur(x, k))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        ${conv.length > 10 ? `<p class="t-help">… et ${conv.length - 10} autre(s) ligne(s).${ko.filter((x) => conv.indexOf(x) >= 10).length ? ` Dont ${ko.filter((x) => conv.indexOf(x) >= 10).length} en erreur (téléchargez-les pour les voir).` : ""}</p>` : ""}
        <details class="howto"><summary>${I("chevright")}Correspondance des colonnes${nonReconnus.length ? ` <span class="t-help">(${nonReconnus.length} non reconnue(s) : ${esc(nonReconnus.join(", "))})</span>` : " <span class=\"t-help\">(toutes reconnues)</span>"}</summary>
          <div class="grid">${IMPORTS[type].champs.map(([k, l]) => { const i = (map.find((m) => m[0] === k) || [])[1]; return `<label><span>${esc(l)}</span><select data-champ="${k}"><option value="-1">— ne pas importer —</option>${tetes.map((h, j) => `<option value="${j}"${j === i ? " selected" : ""}>${esc(h || "colonne " + (j + 1))}</option>`).join("")}</select></label>`; }).join("")}</div></details>
        <div class="imp-acts">${ko.length ? `<button type="button" class="btn btn--secondary" id="dlko">${I("download")}Télécharger les ${ko.length} ligne(s) en erreur</button>` : "<span></span>"}
          <button type="button" class="btn btn--primary" id="go"${ok.length ? "" : " disabled"}>${I("check")}Importer ${ok.length === lignes.length ? "les" : "les"} ${ok.length} ligne(s) valide(s)</button></div>
        <div id="ir"></div>`;
      $$("#ip [data-champ]").forEach((s) => s.addEventListener("change", () => { const ouvert = $("#ip details").open; verifier(false); $("#ip details").open = ouvert; }));
      if ($("#dlko")) $("#dlko").onclick = () => {
        const cell = (v) => { v = String(v == null ? "" : v); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
        const csv = "﻿" + [tetes.concat("Motif de l'erreur").map(cell).join(";")].concat(ko.map((x) => tetes.map((_, i) => cell(x.r[i])).concat(cell(x.err.join(" · "))).join(";"))).join("\r\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `erreurs-${type}-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      };
      $("#go").onclick = () => importer(ok);
    }

    async function importer(ok) {
      $("#go").disabled = true;
      try {
        const r = await api(`/api/g/import/${type}`, { method: "POST", body: { rows: ok.map((x) => x.o) } });
        const info = INFO_IMPORT[type];
        $("#ir").innerHTML = `<div class="imp-done">${I("check", "ic--20")}<div><b>${r.ajoutes} ligne(s) importée(s) dans « ${esc(IMPORTS[type].titre)} ».</b>${r.nbErreurs ? `<span>${r.nbErreurs} ligne(s) refusée(s) par le serveur : ${esc(r.erreurs.map((e) => e.message).slice(0, 3).join(" · "))}</span>` : ""}</div><a class="btn btn--primary btn--sm" href="${info.page}">${info.lien}</a></div>`;
        toast(`${r.ajoutes} ligne(s) importée(s)`);
        const h = histo(); h.unshift({ date: new Date().toISOString(), type, nb: r.ajoutes, fichier: fichier.nom });
        try { localStorage.setItem("gei-imports", JSON.stringify(h.slice(0, 10))); } catch { /* stockage plein : sans gravité */ }
        dessinerHisto();
      } catch (err) { fail(err); $("#go").disabled = false; }
    }

    function dessinerHisto() {
      const h = histo();
      $("#ih").innerHTML = `<h2>Imports récents</h2>${h.length ? `<ul class="imp-histo">${h.map((x) => `<li><span class="imp-histo__ic">${I((INFO_IMPORT[x.type] || {}).ic || "file")}</span><div><b>${x.nb} ligne(s) · ${esc((IMPORTS[x.type] || {}).titre || x.type)}</b><span>${esc(x.fichier || "")}</span></div><time>${new Date(x.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></li>`).join("")}</ul>` : '<p class="muted">Aucun import pour le moment sur cet ordinateur.</p>'}`;
    }

    // Étape 1 : cartes et modèles
    $$(".imp-card").forEach((c) => {
      c.addEventListener("click", (e) => { if (e.target.closest("[data-modele]")) return; choisirType(c.dataset.type); if (fichier) { $("#it").value = type; $("#it").dispatchEvent(new Event("change")); } else etape(2); });
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.click(); } });
    });
    $$("[data-modele]").forEach((b) => (b.onclick = () => { choisirType(b.dataset.modele); telechargerModele(b.dataset.modele); if (!fichier) etape(2); }));
    // Étape 2 : glisser-déposer
    const dz = $("#dz");
    $("#if").addEventListener("change", (e) => chargerFichier(e.target.files[0]));
    ["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("is-over"); }));
    dz.addEventListener("drop", (e) => chargerFichier(e.dataTransfer.files[0]));

    etape(1); dessinerHisto();
  };
})();
