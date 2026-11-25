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
  const LIBCAT = { materiaux: "Matériaux", main_oeuvre: "Main-d'œuvre", transport: "Transport", location: "Location d'engins", administratif: "Administratif", autre: "Autre" };
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
    const d = await load("maisons", "depenses", "mouvements");
    const [fm = "", fc = ""] = (filtre || "").split("|");
    const ops = operations(d);
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
    const [fc = ""] = (arg || "").split("|");
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

  /* ---------- Planning des chantiers ---------- */
  views["g-planning"] = async () => {
    const d = await load("chantiers");
    const ch = d.chantiers.filter((c) => c.statut !== "termine");
    const dates = ch.flatMap((c) => [c.dateDebut, c.dateFin, ...(c.etapes || []).flatMap((e) => [e.dateDebut, e.dateFin])]).filter(Boolean).sort();
    const t = today();
    if (!dates.length) { main.innerHTML = head("Planning", "Les étapes de chaque chantier dans le temps.") + '<section class="panel"><p class="empty">Ajoutez des dates aux étapes de vos chantiers (fiche chantier → « Étapes et avancement ») pour voir le planning.</p></section>'; return; }
    const deb = new Date(dates[0].slice(0, 7) + "-01T12:00:00"), finD = new Date(dates[dates.length - 1] + "T12:00:00");
    const moisL = []; for (let x = new Date(deb); x <= finD; x.setMonth(x.getMonth() + 1)) moisL.push(x.toISOString().slice(0, 7));
    const total = (new Date(moisL[moisL.length - 1] + "-28T12:00:00").setDate(32) - deb) / 864e5 || 1;
    const pos = (s) => Math.max(0, Math.min(100, ((new Date(s + "T12:00:00") - deb) / 864e5) / total * 100));
    const enRetard = (e) => e.dateFin && e.dateFin < t && (e.avancement || 0) < 100;
    const ligne = (nom, s, f, av, retard, sous) => `<div class="gantt__row${sous ? " gantt__row--sub" : ""}"><div class="gantt__nom">${nom}</div><div class="gantt__track">${s && f ? `<div class="gantt__bar${retard ? " gantt__bar--late" : ""}" style="left:${pos(s)}%;width:${Math.max(1.5, pos(f) - pos(s))}%" title="${dfr(s)} → ${dfr(f)} · ${av} %"><i style="width:${av}%"></i></div>` : '<span class="muted">sans dates</span>'}</div></div>`;
    const retards = ch.flatMap((c) => (c.etapes || []).filter(enRetard).map((e) => ({ c, e })));
    main.innerHTML = head("Planning", "Les étapes de chaque chantier dans le temps. En rouge : étapes en retard (date de fin passée, pas terminées).") + `
      ${retards.length ? `<section class="panel">${retards.map(({ c, e }) => `<p class="alert alert--bad"><b>Retard</b> · ${esc(c.nom)} — ${esc(e.nom)} : prévue pour le ${dfr(e.dateFin)}, réalisée à ${e.avancement || 0} %. <a href="#g-chantier/${c.id}">Voir</a></p>`).join("")}</section>` : ""}
      <section class="panel"><div class="gantt">
        <div class="gantt__row gantt__row--head"><div class="gantt__nom"></div><div class="gantt__track">${moisL.map((m) => `<span style="left:${pos(m + "-01")}%">${new Date(m + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}</span>`).join("")}<b class="gantt__today" style="left:${pos(t)}%" title="Aujourd'hui"></b></div></div>
        ${ch.map((c) => { const av = (c.etapes || []).length ? Math.round(sum(c.etapes, (e) => e.avancement) / c.etapes.length) : 0;
          const de = (c.etapes || []).map((e) => e.dateDebut).filter(Boolean).sort(), fe = (c.etapes || []).map((e) => e.dateFin).filter(Boolean).sort();
          const cd = c.dateDebut || de[0], cf = c.dateFin || fe[fe.length - 1];
          return ligne(`<a href="#g-chantier/${c.id}"><b>${esc(c.nom)}</b></a>`, cd, cf, av, cf && cf < t && av < 100) +
            (c.etapes || []).map((e) => ligne(esc(e.nom), e.dateDebut, e.dateFin, e.avancement || 0, enRetard(e), true)).join(""); }).join("")}
      </div></section>`;
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
  const VALEURS = {
    statut: { disponible: "disponible", libre: "disponible", reservee: "reservee", reserve: "reservee", vendue: "vendue", vendu: "vendue", livree: "livree", livre: "livree" },
    categorie: { materiaux: "materiaux", materiel: "materiaux", maindoeuvre: "main_oeuvre", mainduvre: "main_oeuvre", transport: "transport", location: "location", administratif: "administratif", admin: "administratif" },
    mode: { especes: "especes", cash: "especes", virement: "virement", cheque: "cheque", mobilemoney: "mobile_money", orangemoney: "mobile_money", mtnmoney: "mobile_money", moovmoney: "mobile_money", wave: "mobile_money" },
  };
  function lireCSV(texte) {
    texte = texte.replace(/^﻿/, "");
    const sep = (texte.split("\n")[0].match(/;/g) || []).length >= (texte.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (q) { if (c === '"' && texte[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true; else if (c === sep) { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && texte[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  const dateISO = (v) => { v = String(v || "").trim(); let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(v); if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; } m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); return m ? m[0] : ""; };
  views["g-import"] = async () => {
    const chantiers = await api("/api/g/chantiers");
    main.innerHTML = head("Importer depuis Excel", "Reprenez vos fichiers Excel existants : maisons et clients, dépenses, ouvriers ou chantiers.") + `
      <section class="panel"><h2>1. Préparer le fichier</h2>
        <p>Dans Excel : ouvrez votre fichier → <b>Fichier</b> → <b>Enregistrer sous</b> → type <b>« CSV (séparateur : point-virgule) »</b>. La première ligne doit contenir les titres des colonnes (ex. Client, Lot, Prix…).</p></section>
      <section class="panel"><h2>2. Choisir le fichier</h2><div class="filters">
        <label>Type de données<select id="it">${Object.entries(IMPORTS).map(([k, v]) => `<option value="${k}">${v.titre}</option>`).join("")}</select></label>
        <label>Fichier CSV<input type="file" id="if" accept=".csv,text/csv"></label></div></section>
      <section class="panel" id="ip" hidden></section>`;
    let donnees = null;
    const preparer = async () => {
      const file = $("#if").files[0]; if (!file) return;
      const rows = lireCSV(await file.text());
      if (rows.length < 2) return toast("Le fichier est vide ou n'a pas de ligne de titres.", true);
      const type = $("#it").value, conf = IMPORTS[type], tetes = rows[0].map((h) => h.trim());
      const choix = conf.champs.map(([k, , alias]) => { const i = tetes.findIndex((h) => alias.includes(SANS(h))); return i; });
      donnees = { type, rows: rows.slice(1), tetes };
      $("#ip").hidden = false;
      $("#ip").innerHTML = `<h2>3. Vérifier les colonnes</h2><p class="muted">J'ai reconnu les colonnes automatiquement. Corrigez si besoin, puis importez. ${donnees.rows.length} ligne(s) trouvée(s).</p>
        <div class="grid">${conf.champs.map(([k, l], j) => `<label><span>${l}</span><select data-champ="${k}"><option value="-1">— ne pas importer —</option>${tetes.map((h, i) => `<option value="${i}"${i === choix[j] ? " selected" : ""}>${esc(h || "colonne " + (i + 1))}</option>`).join("")}</select></label>`).join("")}</div>
        <h3 style="margin-top:18px">Aperçu (5 premières lignes)</h3><div class="tbl-wrap"><table class="tbl"><thead><tr>${tetes.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${donnees.rows.slice(0, 5).map((r) => `<tr>${tetes.map((_, i) => `<td>${esc(r[i] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        <div class="savebar"><button class="btn btn--primary" id="go">Importer ${donnees.rows.length} ligne(s)</button></div><div id="ir"></div>`;
      $("#go").onclick = importer;
    };
    async function importer() {
      const map = Object.fromEntries($$("[data-champ]").map((s) => [s.dataset.champ, +s.value]));
      const norm = (k, v) => (VALEURS[k] ? VALEURS[k][SANS(v)] || "" : v);
      const rows = donnees.rows.map((r) => {
        const o = {}; for (const [k, i] of Object.entries(map)) if (i >= 0) o[k] = String(r[i] || "").trim();
        ["prix", "montant", "tarifJour", "budget", "montantPaye"].forEach((k) => { if (o[k] != null) o[k] = String(o[k]).replace(/[^\d,.-]/g, "").replace(",", "."); });
        ["date", "dateDebut", "dateFin"].forEach((k) => { if (o[k] != null) o[k] = dateISO(o[k]); });
        ["statut", "categorie", "mode"].forEach((k) => { if (o[k] != null) o[k] = norm(k, o[k]); });
        if (o.chantier != null) { const c = chantiers.find((x) => SANS(x.nom) === SANS(o.chantier)) || chantiers.find((x) => SANS(o.chantier) && SANS(x.nom).includes(SANS(o.chantier))); o.chantierId = c ? c.id : ""; delete o.chantier; }
        return o;
      });
      $("#go").disabled = true;
      try {
        const r = await api(`/api/g/import/${donnees.type}`, { method: "POST", body: { rows } });
        $("#ir").innerHTML = `<p class="alert" style="background:#e6f4ea;border-color:#1e6b34"><b>${r.ajoutes} ligne(s) importée(s).</b></p>` + (r.nbErreurs ? `<p class="alert alert--bad">${r.nbErreurs} ligne(s) ignorée(s) :</p><ul>${r.erreurs.map((e) => `<li>Ligne ${e.ligne} : ${esc(e.message)}</li>`).join("")}</ul>` : "");
        toast(`${r.ajoutes} ligne(s) importée(s)`);
      } catch (err) { fail(err); $("#go").disabled = false; }
    }
    $("#if").onchange = preparer; $("#it").onchange = preparer;
  };
})();
