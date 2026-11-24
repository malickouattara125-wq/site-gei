/* Application « GEI Gestion » : chantiers, maisons et clients, dépenses, équipes et paie.
   S'appuie sur le socle core.js (window.GEI). Montants en FCFA. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G) return;
  const { api, esc, toast, fail, pick, img, views, main, $, $$ } = G;

  /* ---------- Outils ---------- */
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const today = () => new Date().toISOString().slice(0, 10);
  const mois = (d) => String(d || "").slice(0, 7);
  const dfr = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const LIB = {
    statut: { preparation: "En préparation", en_cours: "En cours", pause: "En pause", termine: "Terminé", disponible: "Disponible", reservee: "Réservée", vendue: "Vendue", livree: "Livrée" },
    categorie: { materiaux: "Matériaux", main_oeuvre: "Main-d'œuvre", transport: "Transport", location: "Location d'engins", administratif: "Administratif", autre: "Autre" },
    mode: { especes: "Espèces", virement: "Virement", cheque: "Chèque", mobile_money: "Mobile Money", autre: "Autre" },
  };
  const opts = (map, v, vide) => (vide ? `<option value="">${vide}</option>` : "") + Object.entries(map).map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const st = (k) => `<span class="st st--${esc(k)}">${esc(LIB.statut[k] || k)}</span>`;
  const bar = (pct, warn) => `<div class="bar${warn ? (pct > 100 ? " bar--bad" : pct > 90 ? " bar--warn" : "") : ""}"><i style="width:${Math.min(100, Math.max(0, pct))}%"></i></div>`;
  const load = async (...names) => Object.fromEntries(await Promise.all(names.map(async (n) => [n, await api("/api/g/" + n)])));

  // Calculs communs
  const avancement = (c) => (c.etapes && c.etapes.length ? Math.round(sum(c.etapes, (e) => e.avancement) / c.etapes.length) : 0);
  const paieDe = (pointages, ouvriers, filtre = () => true) => {
    const tarif = Object.fromEntries(ouvriers.map((o) => [o.id, o.tarifJour || 0]));
    return sum(pointages.filter(filtre), (p) => sum(p.presents, (id) => tarif[id] || 0));
  };
  const depenseChantier = (c, d) => sum(d.depenses.filter((x) => x.chantierId === c.id), (x) => x.montant) + paieDe(d.pointages, d.ouvriers, (p) => p.chantierId === c.id);
  const paye = (m) => sum(m.paiements || [], (p) => p.montant);
  const du = (m) => (["reservee", "vendue", "livree"].includes(m.statut) ? Math.max(0, (m.prix || 0) - paye(m)) : 0);
  const retard = (m) => { // montant échu non payé
    if (!["reservee", "vendue", "livree"].includes(m.statut)) return 0;
    const echu = sum((m.echeancier || []).filter((e) => e.date && e.date <= today()), (e) => e.montant);
    return Math.max(0, echu - paye(m));
  };
  const prochaine = (m) => { let cumul = 0; const p = paye(m); for (const e of (m.echeancier || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))) { cumul += e.montant; if (cumul > p) return e; } return null; };

  // Export Excel (CSV lisible par Excel en français : point-virgule, BOM)
  function exporter(nom, cols, rows) {
    const cell = (v) => { const s = String(v == null ? "" : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = "﻿" + [cols.map((c) => cell(c[0])).join(";")].concat(rows.map((r) => cols.map((c) => cell(c[1](r))).join(";"))).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${nom}-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const head = (titre, sous, actions = "") => `<div class="top"><div><h1>${titre}</h1><p>${sous}</p></div><div class="top__actions">${actions}</div></div>`;
  const tableau = (cols, rows, href, foot) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th${c[2] ? ' class="num"' : ""}>${c[0]}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr${href ? ` data-href="${esc(href(r))}"` : ""}>${cols.map((c) => `<td${c[2] ? ' class="num"' : ""}>${c[1](r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="empty">Rien pour le moment.</td></tr>`}</tbody>
    ${foot ? `<tfoot><tr>${foot.map((f, i) => `<td${cols[i] && cols[i][2] ? ' class="num"' : ""}>${f}</td>`).join("")}</tr></tfoot>` : ""}</table></div>`;
  main.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-href]"); if (tr && !e.target.closest("a,button,input,select")) location.hash = tr.dataset.href; });

  // Lignes répétables (étapes, échéancier, paiements)
  function rowsEditor(box, list, fields, cols) {
    const draw = () => {
      box.innerHTML = list.map((r, i) => `<div class="r" style="--cols:${cols}" data-i="${i}">${fields.map((f) => f.type === "select"
        ? `<select data-k="${f.k}" aria-label="${f.ph}">${opts(f.map, r[f.k])}</select>`
        : `<input data-k="${f.k}" type="${f.type || "text"}" value="${esc(r[f.k] == null ? "" : r[f.k])}" placeholder="${esc(f.ph)}" aria-label="${esc(f.ph)}"${f.type === "number" ? ' min="0" step="any"' : ""}>`).join("")}
        <button type="button" class="btn btn--text" data-rm title="Retirer">✕</button></div>`).join("") || '<p class="muted">Aucune ligne.</p>';
    };
    box.addEventListener("input", (e) => { const r = e.target.closest(".r"); if (!r) return; const f = fields.find((x) => x.k === e.target.dataset.k); list[r.dataset.i][e.target.dataset.k] = f && f.type === "number" ? num(e.target.value) : e.target.value; G.setDirty(true); box.dispatchEvent(new Event("change")); });
    box.addEventListener("click", (e) => { if (e.target.matches("[data-rm]")) { list.splice(+e.target.closest(".r").dataset.i, 1); draw(); G.setDirty(true); box.dispatchEvent(new Event("change")); } });
    draw();
    return { add: (r) => { list.push(r); draw(); G.setDirty(true); }, draw };
  }
  async function save(url, id, body, retour) {
    try {
      const r = await api(id ? `${url}/${id}` : url, { method: id ? "PUT" : "POST", body });
      G.setDirty(false); toast("Enregistré"); location.hash = retour || "";
      return r;
    } catch (err) { fail(err); }
  }
  async function supprimer(url, id, quoi, retour) {
    if (!confirm(`Supprimer définitivement ${quoi} ?`)) return;
    try { await api(`${url}/${id}`, { method: "DELETE" }); G.setDirty(false); toast("Supprimé"); location.hash = retour; } catch (err) { fail(err); }
  }
  const nomChantier = (list, id) => (list.find((c) => c.id === id) || {}).nom || "—";
  const chantierOpts = (list, v, vide = "— Aucun / général —") => `<option value="">${vide}</option>` + list.map((c) => `<option value="${c.id}"${c.id === v ? " selected" : ""}>${esc(c.nom)}</option>`).join("");

  /* ================= Tableau de gestion ================= */
  views.gestion = async () => {
    const d = await load("chantiers", "maisons", "depenses", "ouvriers", "pointages");
    const m = mois(today());
    const encours = d.chantiers.filter((c) => c.statut === "en_cours");
    const depMois = sum(d.depenses.filter((x) => mois(x.date) === m), (x) => x.montant) + paieDe(d.pointages, d.ouvriers, (p) => mois(p.date) === m);
    const encMois = sum(d.maisons.flatMap((x) => x.paiements || []).filter((p) => mois(p.date) === m), (p) => p.montant);
    const reste = sum(d.maisons, du);
    const cnt = (s) => d.maisons.filter((x) => x.statut === s).length;
    const retards = d.maisons.filter((x) => retard(x) > 0);
    const depasse = d.chantiers.filter((c) => c.budget && depenseChantier(c, d) > c.budget);
    main.innerHTML = head("Tableau de gestion", "L'essentiel des chantiers, des ventes et de l'argent, en un coup d'œil.",
      '<a class="btn btn--primary" href="#g-depense/nouvelle">+ Dépense</a><a class="btn btn--ghost" href="#g-maisons">Paiement client</a>') + `
      <div class="kpis">
        <div class="kpi"><small>Chantiers en cours</small><b>${encours.length}</b><span>${d.chantiers.length} au total</span></div>
        <div class="kpi"><small>Dépensé ce mois</small><b>${fcfa(depMois)}</b><span>achats + paie</span></div>
        <div class="kpi"><small>Encaissé ce mois</small><b>${fcfa(encMois)}</b><span>paiements des clients</span></div>
        <div class="kpi kpi--alert"><small>Reste à encaisser</small><b>${fcfa(reste)}</b><span>${cnt("vendue") + cnt("livree")} vendues · ${cnt("reservee")} réservées · ${cnt("disponible")} disponibles</span></div>
      </div>
      ${retards.length || depasse.length ? `<section class="panel"><h2>À surveiller</h2>
        ${retards.map((x) => `<p class="alert"><b>Paiement en retard</b> · ${esc(x.programme)} lot ${esc(x.lot)} (${esc(x.clientNom || "client")}) : ${fcfa(retard(x))} échus non payés. <a href="#g-maison/${x.id}">Voir</a></p>`).join("")}
        ${depasse.map((c) => `<p class="alert alert--bad"><b>Budget dépassé</b> · ${esc(c.nom)} : ${fcfa(depenseChantier(c, d))} dépensés pour ${fcfa(c.budget)} prévus. <a href="#g-chantier/${c.id}">Voir</a></p>`).join("")}
      </section>` : ""}
      <section class="panel"><h2>Chantiers</h2>
        ${tableau([["Chantier", (c) => `<b>${esc(c.nom)}</b><br><span class="muted">${esc(c.lieu)}</span>`], ["Statut", (c) => st(c.statut)], ["Avancement", (c) => `${bar(avancement(c))}<span class="muted">${avancement(c)} %</span>`],
          ["Budget", (c) => fcfa(c.budget), 1], ["Dépensé", (c) => fcfa(depenseChantier(c, d)), 1], ["Budget utilisé", (c) => c.budget ? `${bar(Math.round(depenseChantier(c, d) / c.budget * 100), true)}<span class="muted">${Math.round(depenseChantier(c, d) / c.budget * 100)} %</span>` : '<span class="muted">pas de budget</span>']],
          d.chantiers.filter((c) => c.statut !== "termine"), (c) => `#g-chantier/${c.id}`)}
      </section>`;
  };

  /* ================= Chantiers ================= */
  views["g-chantiers"] = async () => {
    const d = await load("chantiers", "depenses", "ouvriers", "pointages");
    const cols = [["Chantier", (c) => `<b>${esc(c.nom)}</b><br><span class="muted">${esc([c.lieu, c.client].filter(Boolean).join(" · "))}</span>`], ["Statut", (c) => st(c.statut)],
      ["Avancement", (c) => `${bar(avancement(c))}<span class="muted">${avancement(c)} %</span>`], ["Début", (c) => dfr(c.dateDebut)], ["Fin prévue", (c) => dfr(c.dateFin)],
      ["Budget", (c) => fcfa(c.budget), 1], ["Dépensé", (c) => fcfa(depenseChantier(c, d)), 1], ["Reste", (c) => fcfa((c.budget || 0) - depenseChantier(c, d)), 1]];
    main.innerHTML = head("Chantiers", "Tous les chantiers : étapes, avancement, budget et dépenses.",
      '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button><a class="btn btn--primary" href="#g-chantier/nouveau">+ Nouveau chantier</a>') +
      `<section class="panel">${tableau(cols, d.chantiers.slice().sort((a, b) => (a.statut === "termine") - (b.statut === "termine")), (c) => `#g-chantier/${c.id}`,
        ["Total", "", "", "", "", fcfa(sum(d.chantiers, (c) => c.budget)), fcfa(sum(d.chantiers, (c) => depenseChantier(c, d))), ""])}</section>`;
    $("#xp").onclick = () => exporter("chantiers", [["Chantier", (c) => c.nom], ["Lieu", (c) => c.lieu], ["Client", (c) => c.client], ["Statut", (c) => LIB.statut[c.statut]], ["Avancement %", avancement], ["Début", (c) => c.dateDebut], ["Fin prévue", (c) => c.dateFin], ["Budget", (c) => c.budget], ["Dépensé", (c) => depenseChantier(c, d)]], d.chantiers);
  };

  const ETAPES = ["Terrassement", "Fondations", "Élévation des murs", "Dalle / poteaux", "Toiture", "Électricité et plomberie", "Enduits", "Carrelage", "Menuiseries", "Peinture", "Finitions et nettoyage"];
  views["g-chantier"] = async (cid) => {
    const isNew = cid === "nouveau";
    const d = await load("chantiers", "depenses", "ouvriers", "pointages");
    const c = isNew ? { statut: "en_cours", etapes: ETAPES.map((nom) => ({ nom, avancement: 0 })), photos: [] } : d.chantiers.find((x) => x.id === cid);
    if (!c) { main.innerHTML = '<p class="empty">Chantier introuvable.</p>'; return; }
    const etapes = (c.etapes || []).map((e) => ({ ...e })), photos = (c.photos || []).map((p) => ({ ...p }));
    const deps = d.depenses.filter((x) => x.chantierId === c.id);
    const paie = paieDe(d.pointages, d.ouvriers, (p) => p.chantierId === c.id);
    const parCat = Object.entries(LIB.categorie).map(([k, l]) => [l, sum(deps.filter((x) => x.categorie === k), (x) => x.montant)]).filter((x) => x[1]);
    main.innerHTML = head(isNew ? "Nouveau chantier" : esc(c.nom), isNew ? "Créez le chantier, puis suivez son avancement et ses dépenses." : `${st(c.statut)} · avancement ${avancement(c)} %`, '<a class="btn btn--text" href="#g-chantiers">← Retour</a>') + `
      <form class="form" id="f" novalidate>
        <section class="panel"><h2>Informations</h2><div class="grid">
          <label class="full"><span>Nom du chantier *</span><input name="nom" value="${esc(c.nom || "")}" placeholder="Ex. Cité Les Rives de l'Opulence, tranche 2"></label>
          <label><span>Lieu</span><input name="lieu" value="${esc(c.lieu || "")}" placeholder="Ex. Adiaké"></label>
          <label><span>Client / propriétaire</span><input name="client" value="${esc(c.client || "")}" placeholder="Ex. GEI (programme) ou nom du client"></label>
          <label><span>Type d'ouvrage</span><input name="type" value="${esc(c.type || "")}" placeholder="Ex. 20 villas basses 4 pièces"></label>
          <label><span>Statut</span><select name="statut">${opts({ preparation: "En préparation", en_cours: "En cours", pause: "En pause", termine: "Terminé" }, c.statut)}</select></label>
          <label><span>Budget prévu (FCFA)</span><input name="budget" inputmode="numeric" value="${c.budget || ""}" placeholder="Ex. 150000000"></label>
          <label><span>Date de début</span><input name="dateDebut" type="date" value="${esc(c.dateDebut || "")}"></label>
          <label><span>Fin prévue</span><input name="dateFin" type="date" value="${esc(c.dateFin || "")}"></label>
          <label class="full"><span>Notes</span><textarea name="notes" rows="3">${esc(c.notes || "")}</textarea></label>
        </div></section>
        <section class="panel"><h2>Étapes et avancement</h2><p class="muted">Indiquez le pourcentage réalisé de chaque étape. L'avancement du chantier est la moyenne.</p>
          <div class="rows" id="et"></div><p><button type="button" class="btn btn--sm btn--ghost" id="addE">+ Ajouter une étape</button></p></section>
        <section class="panel"><h2>Photos du chantier</h2><div class="gal" id="ph"></div><p><button type="button" class="btn btn--sm btn--ghost" id="addP">+ Ajouter une photo</button></p></section>
        ${isNew ? "" : `<section class="panel"><h2>Argent du chantier</h2>
          <div class="kpis"><div class="kpi"><small>Budget</small><b>${fcfa(c.budget)}</b></div><div class="kpi"><small>Achats et frais</small><b>${fcfa(sum(deps, (x) => x.montant))}</b></div>
          <div class="kpi"><small>Paie des ouvriers</small><b>${fcfa(paie)}</b></div><div class="kpi kpi--alert"><small>Reste du budget</small><b>${fcfa((c.budget || 0) - depenseChantier(c, d))}</b></div></div>
          ${parCat.length ? `<p class="muted">${parCat.map(([l, v]) => `${l} : <b>${fcfa(v)}</b>`).join(" · ")}</p>` : ""}
          <p><a class="btn btn--sm btn--ghost" href="#g-depenses/${c.id}">Voir les ${deps.length} dépenses</a> <a class="btn btn--sm btn--primary" href="#g-depense/nouvelle/${c.id}">+ Dépense sur ce chantier</a></p></section>`}
        <div class="savebar">${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}<button type="submit" class="btn btn--primary">${isNew ? "Créer le chantier" : "Enregistrer"}</button></div>
      </form>`;
    const f = $("#f");
    f.addEventListener("input", () => G.setDirty(true));
    const ed = rowsEditor($("#et"), etapes, [{ k: "nom", ph: "Étape" }, { k: "avancement", ph: "% réalisé", type: "number" }], "2fr 120px auto");
    $("#addE").onclick = () => ed.add({ nom: "", avancement: 0 });
    const drawP = () => { $("#ph").innerHTML = photos.map((p, i) => `<figure data-i="${i}"><img src="${esc(img(p.src))}" alt=""><figcaption><input type="date" data-k="date" value="${esc(p.date || "")}" aria-label="Date"><input data-k="legende" value="${esc(p.legende || "")}" placeholder="Légende" aria-label="Légende"><div><span></span><button type="button" class="btn btn--danger" data-rm>Retirer</button></div></figcaption></figure>`).join("") || '<p class="muted">Aucune photo.</p>'; };
    $("#ph").addEventListener("input", (e) => { photos[e.target.closest("figure").dataset.i][e.target.dataset.k] = e.target.value; G.setDirty(true); });
    $("#ph").addEventListener("click", (e) => { if (e.target.matches("[data-rm]")) { photos.splice(+e.target.closest("figure").dataset.i, 1); drawP(); G.setDirty(true); } });
    $("#addP").onclick = () => pick((srcs) => { srcs.forEach((src) => photos.push({ src, date: today(), legende: "" })); drawP(); G.setDirty(true); }, true);
    drawP();
    f.addEventListener("submit", (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); save("/api/g/chantiers", isNew ? null : c.id, { ...v, budget: num(v.budget), etapes, photos }, isNew ? "#g-chantiers" : `#g-chantier/${c.id}`); });
    if ($("#del")) $("#del").onclick = () => supprimer("/api/g/chantiers", c.id, "ce chantier (les dépenses restent enregistrées)", "#g-chantiers");
  };

  /* ================= Maisons et clients ================= */
  views["g-maisons"] = async (filtre) => {
    const d = await load("maisons", "chantiers");
    const progs = [...new Set(d.maisons.map((m) => m.programme))].sort();
    const fp = (filtre || "").split("|");
    const list = d.maisons.filter((m) => (!fp[0] || m.programme === fp[0]) && (!fp[1] || m.statut === fp[1]))
      .sort((a, b) => a.programme.localeCompare(b.programme) || String(a.lot).localeCompare(String(b.lot), "fr", { numeric: true }));
    const cols = [["Programme", (m) => esc(m.programme)], ["Lot", (m) => `<b>${esc(m.lot)}</b>`], ["Type", (m) => esc(m.type)], ["Statut", (m) => st(m.statut)], ["Client", (m) => esc(m.clientNom || "—")],
      ["Prix", (m) => fcfa(m.prix), 1], ["Payé", (m) => fcfa(paye(m)), 1], ["Reste", (m) => fcfa(du(m)), 1],
      ["Prochaine échéance", (m) => { const e = prochaine(m); return retard(m) ? `<span class="st st--pause">En retard : ${fcfa(retard(m))}</span>` : e ? `${dfr(e.date)} · ${fcfa(e.montant)}` : "—"; }]];
    main.innerHTML = head("Maisons et clients", "Chaque maison de chaque programme : statut, client, échéancier et paiements.",
      '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button><a class="btn btn--primary" href="#g-maison/nouvelle">+ Nouvelle maison</a>') + `
      <section class="panel"><div class="filters">
        <label>Programme<select id="fprog"><option value="">Tous</option>${progs.map((p) => `<option${p === fp[0] ? " selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
        <label>Statut<select id="fst">${opts({ disponible: "Disponible", reservee: "Réservée", vendue: "Vendue", livree: "Livrée" }, fp[1], "Tous")}</select></label>
      </div>
      ${tableau(cols, list, (m) => `#g-maison/${m.id}`, ["Total", `${list.length} lots`, "", "", "", fcfa(sum(list, (m) => m.prix)), fcfa(sum(list, paye)), fcfa(sum(list, du)), ""])}</section>`;
    const go = () => { location.hash = `#g-maisons/${encodeURIComponent($("#fprog").value + "|" + $("#fst").value)}`; };
    $("#fprog").onchange = go; $("#fst").onchange = go;
    $("#xp").onclick = () => exporter("maisons-clients", [["Programme", (m) => m.programme], ["Lot", (m) => m.lot], ["Type", (m) => m.type], ["Superficie", (m) => m.superficie], ["Statut", (m) => LIB.statut[m.statut]], ["Client", (m) => m.clientNom], ["Téléphone", (m) => m.clientTel], ["E-mail", (m) => m.clientEmail], ["Pays", (m) => m.clientPays], ["Prix", (m) => m.prix], ["Payé", paye], ["Reste", du], ["En retard", retard]], list);
  };

  views["g-maison"] = async (mid) => {
    const isNew = mid === "nouvelle";
    const d = await load("maisons", "chantiers");
    const m = isNew ? { statut: "disponible", echeancier: [], paiements: [] } : d.maisons.find((x) => x.id === mid);
    if (!m) { main.innerHTML = '<p class="empty">Maison introuvable.</p>'; return; }
    const ech = (m.echeancier || []).map((x) => ({ ...x })), pay = (m.paiements || []).map((x) => ({ ...x }));
    const progs = [...new Set(d.maisons.map((x) => x.programme))].sort();
    main.innerHTML = head(isNew ? "Nouvelle maison" : `${esc(m.programme)} · lot ${esc(m.lot)}`, isNew ? "Ajoutez une maison (lot) d'un programme." : `${st(m.statut)} ${m.clientNom ? "· " + esc(m.clientNom) : ""}`, '<a class="btn btn--text" href="#g-maisons">← Retour</a>') + `
      <form class="form" id="f" novalidate>
        <section class="panel"><h2>La maison</h2><div class="grid">
          <label><span>Programme *</span><input name="programme" list="progs" value="${esc(m.programme || "")}" placeholder="Ex. Cité Les Rives de l'Opulence"><datalist id="progs">${progs.map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>
          <label><span>Numéro du lot *</span><input name="lot" value="${esc(m.lot || "")}" placeholder="Ex. A12"></label>
          <label><span>Type</span><input name="type" value="${esc(m.type || "")}" placeholder="Ex. Villa basse 4 pièces"></label>
          <label><span>Superficie</span><input name="superficie" value="${esc(m.superficie || "")}" placeholder="Ex. 300 m²"></label>
          <label><span>Prix de vente (FCFA)</span><input name="prix" inputmode="numeric" value="${m.prix || ""}" placeholder="Ex. 40000000"></label>
          <label><span>Statut</span><select name="statut">${opts({ disponible: "Disponible", reservee: "Réservée", vendue: "Vendue", livree: "Livrée (clés remises)" }, m.statut)}</select></label>
          <label><span>Chantier lié</span><select name="chantierId">${chantierOpts(d.chantiers, m.chantierId)}</select></label>
        </div></section>
        <section class="panel"><h2>Le client</h2><div class="grid">
          <label><span>Nom du client</span><input name="clientNom" value="${esc(m.clientNom || "")}"></label>
          <label><span>Téléphone / WhatsApp</span><input name="clientTel" value="${esc(m.clientTel || "")}"></label>
          <label><span>E-mail</span><input name="clientEmail" value="${esc(m.clientEmail || "")}"></label>
          <label><span>Pays de résidence</span><input name="clientPays" value="${esc(m.clientPays || "")}" placeholder="Ex. Côte d'Ivoire, France…"></label>
        </div></section>
        <section class="panel"><h2>Échéancier prévu</h2><p class="muted">Les montants que le client doit verser, et quand.</p>
          <div class="rows" id="ech"></div><p><button type="button" class="btn btn--sm btn--ghost" id="addEch">+ Échéance</button> <span class="muted" id="totEch"></span></p></section>
        <section class="panel"><h2>Paiements reçus</h2>
          <div class="rows" id="pay"></div><p><button type="button" class="btn btn--sm btn--primary" id="addPay">+ Enregistrer un paiement</button></p>
          <div class="kpis" id="bilan"></div></section>
        <section class="panel"><label class="full"><span>Notes</span><textarea name="notes" rows="3">${esc(m.notes || "")}</textarea></label></section>
        <div class="savebar">${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}<button type="submit" class="btn btn--primary">${isNew ? "Créer" : "Enregistrer"}</button></div>
      </form>`;
    const f = $("#f");
    f.addEventListener("input", () => { G.setDirty(true); bilan(); });
    const e1 = rowsEditor($("#ech"), ech, [{ k: "date", ph: "Date", type: "date" }, { k: "libelle", ph: "Libellé (ex. apport initial)" }, { k: "montant", ph: "Montant", type: "number" }], "160px 2fr 160px auto");
    const e2 = rowsEditor($("#pay"), pay, [{ k: "date", ph: "Date", type: "date" }, { k: "montant", ph: "Montant", type: "number" }, { k: "mode", ph: "Mode", type: "select", map: LIB.mode }, { k: "reference", ph: "Référence / reçu" }], "160px 160px 160px 1fr auto");
    $("#addEch").onclick = () => { e1.add({ date: "", libelle: "", montant: 0 }); bilan(); };
    $("#addPay").onclick = () => { e2.add({ date: today(), montant: 0, mode: "especes", reference: "" }); bilan(); };
    $("#ech").addEventListener("change", bilan); $("#pay").addEventListener("change", bilan);
    function bilan() {
      const prix = num(f.prix.value), p = sum(pay, (x) => x.montant), te = sum(ech, (x) => x.montant);
      $("#totEch").textContent = ech.length ? `Total prévu : ${fcfa(te)}${prix && te !== prix ? ` (prix : ${fcfa(prix)})` : ""}` : "";
      const tmp = { statut: f.statut.value, prix, echeancier: ech, paiements: pay };
      $("#bilan").innerHTML = `<div class="kpi"><small>Prix</small><b>${fcfa(prix)}</b></div><div class="kpi"><small>Payé</small><b>${fcfa(p)}</b></div><div class="kpi"><small>Reste à payer</small><b>${fcfa(Math.max(0, prix - p))}</b></div><div class="kpi kpi--alert"><small>En retard</small><b>${fcfa(retard(tmp))}</b></div>`;
    }
    bilan();
    f.addEventListener("submit", (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); save("/api/g/maisons", isNew ? null : m.id, { ...v, prix: num(v.prix), echeancier: ech, paiements: pay }, isNew ? "#g-maisons" : `#g-maison/${m.id}`); });
    if ($("#del")) $("#del").onclick = () => supprimer("/api/g/maisons", m.id, "cette maison et son historique de paiements", "#g-maisons");
  };

  /* ================= Dépenses ================= */
  views["g-depenses"] = async (filtre) => {
    const d = await load("depenses", "chantiers");
    const [fc = "", fcat = "", fm = ""] = (filtre || "").split("|");
    const list = d.depenses.filter((x) => (!fc || x.chantierId === fc) && (!fcat || x.categorie === fcat) && (!fm || mois(x.date) === fm)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const moisDispo = [...new Set(d.depenses.map((x) => mois(x.date)))].sort().reverse();
    const cols = [["Date", (x) => dfr(x.date)], ["Chantier", (x) => esc(nomChantier(d.chantiers, x.chantierId))], ["Catégorie", (x) => esc(LIB.categorie[x.categorie])], ["Libellé", (x) => `<b>${esc(x.libelle)}</b>${x.quantite ? ` <span class="muted">(${esc(x.quantite)})</span>` : ""}`],
      ["Fournisseur", (x) => esc(x.fournisseur || "—")], ["Mode", (x) => esc(LIB.mode[x.mode])], ["Montant", (x) => fcfa(x.montant) + (x.paye ? "" : ' <span class="st st--pause">à payer</span>'), 1]];
    main.innerHTML = head("Dépenses", "Achats de matériaux, main-d'œuvre, transport, location… par chantier.",
      '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button><a class="btn btn--primary" href="#g-depense/nouvelle">+ Nouvelle dépense</a>') + `
      <section class="panel"><div class="filters">
        <label>Chantier<select id="fc">${chantierOpts(d.chantiers, fc, "Tous")}</select></label>
        <label>Catégorie<select id="fcat">${opts(LIB.categorie, fcat, "Toutes")}</select></label>
        <label>Mois<select id="fm"><option value="">Tous</option>${moisDispo.map((m) => `<option value="${m}"${m === fm ? " selected" : ""}>${new Date(m + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</option>`).join("")}</select></label>
      </div>
      ${tableau(cols, list, (x) => `#g-depense/${x.id}`, ["Total", `${list.length} dépenses`, "", "", "", "", fcfa(sum(list, (x) => x.montant))])}
      <p class="muted">Non payées : <b>${fcfa(sum(list.filter((x) => !x.paye), (x) => x.montant))}</b></p></section>`;
    const go = () => { location.hash = `#g-depenses/${encodeURIComponent([$("#fc").value, $("#fcat").value, $("#fm").value].join("|"))}`; };
    ["#fc", "#fcat", "#fm"].forEach((s) => { $(s).onchange = go; });
    $("#xp").onclick = () => exporter("depenses", [["Date", (x) => x.date], ["Chantier", (x) => nomChantier(d.chantiers, x.chantierId)], ["Catégorie", (x) => LIB.categorie[x.categorie]], ["Libellé", (x) => x.libelle], ["Quantité", (x) => x.quantite], ["Fournisseur", (x) => x.fournisseur], ["Mode", (x) => LIB.mode[x.mode]], ["Montant", (x) => x.montant], ["Payé", (x) => (x.paye ? "oui" : "non")], ["Saisi par", (x) => x.creePar]], list);
  };

  views["g-depense"] = async (arg) => {
    const [did, cid] = String(arg || "").split("/");
    const isNew = did === "nouvelle";
    const d = await load("depenses", "chantiers");
    const x = isNew ? { date: today(), chantierId: cid || "", categorie: "materiaux", mode: "especes", paye: true } : d.depenses.find((y) => y.id === did);
    if (!x) { main.innerHTML = '<p class="empty">Dépense introuvable.</p>'; return; }
    const fours = [...new Set(d.depenses.map((y) => y.fournisseur).filter(Boolean))].sort();
    main.innerHTML = head(isNew ? "Nouvelle dépense" : esc(x.libelle), isNew ? "Saisissez l'achat ou le frais, avec le chantier concerné." : `${dfr(x.date)} · ${fcfa(x.montant)}`, '<a class="btn btn--text" href="#g-depenses">← Retour</a>') + `
      <form class="form panel" id="f" novalidate style="max-width:860px"><div class="grid">
        <label><span>Date *</span><input type="date" name="date" value="${esc(x.date || "")}"></label>
        <label><span>Chantier</span><select name="chantierId">${chantierOpts(d.chantiers, x.chantierId)}</select></label>
        <label><span>Catégorie</span><select name="categorie">${opts(LIB.categorie, x.categorie)}</select></label>
        <label><span>Montant (FCFA) *</span><input name="montant" inputmode="numeric" value="${x.montant || ""}" placeholder="Ex. 275000"></label>
        <label class="full"><span>Libellé *</span><input name="libelle" value="${esc(x.libelle || "")}" placeholder="Ex. 50 sacs de ciment CPJ 45"></label>
        <label><span>Quantité (facultatif)</span><input name="quantite" value="${esc(x.quantite || "")}" placeholder="Ex. 50 sacs"></label>
        <label><span>Fournisseur</span><input name="fournisseur" list="fours" value="${esc(x.fournisseur || "")}" placeholder="Ex. Novabat"><datalist id="fours">${fours.map((y) => `<option value="${esc(y)}">`).join("")}</datalist></label>
        <label><span>Mode de paiement</span><select name="mode">${opts(LIB.mode, x.mode)}</select></label>
        <label class="check"><input type="checkbox" name="paye"${x.paye !== false ? " checked" : ""}> Déjà payée</label>
        <label class="full"><span>Notes</span><textarea name="notes" rows="2">${esc(x.notes || "")}</textarea></label>
      </div>
      <div class="savebar">${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}${isNew ? '<button type="button" class="btn btn--ghost" id="encore">Enregistrer et en saisir une autre</button>' : ""}<button type="submit" class="btn btn--primary">Enregistrer</button></div>
      ${isNew ? "" : `<p class="muted">Saisie par ${esc(x.creePar || "?")}${x.modifiePar ? `, modifiée par ${esc(x.modifiePar)}` : ""}.</p>`}</form>`;
    const f = $("#f");
    f.addEventListener("input", () => G.setDirty(true));
    const body = () => { const v = Object.fromEntries(new FormData(f)); return { ...v, montant: num(v.montant), paye: f.paye.checked }; };
    f.addEventListener("submit", (e) => { e.preventDefault(); save("/api/g/depenses", isNew ? null : x.id, body(), x.chantierId || body().chantierId ? `#g-depenses/${encodeURIComponent(body().chantierId + "||")}` : "#g-depenses"); });
    if ($("#encore")) $("#encore").onclick = async () => { try { await api("/api/g/depenses", { method: "POST", body: body() }); G.setDirty(false); toast("Enregistrée. Saisissez la suivante."); f.libelle.value = ""; f.montant.value = ""; f.quantite.value = ""; f.notes.value = ""; f.libelle.focus(); } catch (err) { fail(err); } };
    if ($("#del")) $("#del").onclick = () => supprimer("/api/g/depenses", x.id, "cette dépense", "#g-depenses");
  };

  /* ================= Équipes et paie ================= */
  const lundi = (d) => { const x = new Date((d || today()) + "T12:00:00"); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const plusJours = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  views["g-equipes"] = async (arg) => {
    const [onglet = "ouvriers", p1 = "", p2 = ""] = String(arg || "").split("/");
    const d = await load("ouvriers", "pointages", "chantiers");
    const tabs = `<nav class="tabs-g">${[["ouvriers", "Ouvriers"], ["pointage", "Pointage du jour"], ["paie", "Paie de la semaine"]].map(([k, l]) => `<a href="#g-equipes/${k}" class="${k === onglet ? "is-on" : ""}">${l}</a>`).join("")}</nav>`;
    if (onglet === "ouvriers") {
      const cols = [["Nom", (o) => `<b>${esc(o.nom)}</b>${o.actif ? "" : ' <span class="st">inactif</span>'}`], ["Métier", (o) => esc(o.metier || "—")], ["Téléphone", (o) => esc(o.tel || "—")], ["Chantier", (o) => esc(nomChantier(d.chantiers, o.chantierId))], ["Tarif / jour", (o) => fcfa(o.tarifJour), 1]];
      main.innerHTML = head("Équipes et paie", "Ouvriers, présence sur les chantiers et paie de la semaine.", '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button><a class="btn btn--primary" href="#g-ouvrier/nouveau">+ Nouvel ouvrier</a>') + tabs +
        `<section class="panel">${tableau(cols, d.ouvriers.slice().sort((a, b) => (b.actif - a.actif) || a.nom.localeCompare(b.nom)), (o) => `#g-ouvrier/${o.id}`)}</section>`;
      $("#xp").onclick = () => exporter("ouvriers", [["Nom", (o) => o.nom], ["Métier", (o) => o.metier], ["Téléphone", (o) => o.tel], ["Chantier", (o) => nomChantier(d.chantiers, o.chantierId)], ["Tarif / jour", (o) => o.tarifJour], ["Actif", (o) => (o.actif ? "oui" : "non")]], d.ouvriers);
      return;
    }
    if (onglet === "pointage") {
      const date = p1 || today(), cid = p2 || (d.chantiers.find((c) => c.statut === "en_cours") || d.chantiers[0] || {}).id || "";
      const exist = d.pointages.find((p) => p.date === date && p.chantierId === cid);
      const presents = new Set(exist ? exist.presents : []);
      const liste = d.ouvriers.filter((o) => o.actif || presents.has(o.id)).sort((a, b) => ((b.chantierId === cid) - (a.chantierId === cid)) || a.nom.localeCompare(b.nom));
      main.innerHTML = head("Équipes et paie", "Cochez les ouvriers présents sur le chantier ce jour-là.", "") + tabs + `
        <section class="panel"><div class="filters">
          <label>Date<input type="date" id="pd" value="${date}"></label>
          <label>Chantier<select id="pc">${d.chantiers.map((c) => `<option value="${c.id}"${c.id === cid ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label>
        </div>
        ${d.chantiers.length ? (liste.length ? `<div class="checks" id="pl">${liste.map((o) => `<label><input type="checkbox" value="${o.id}"${presents.has(o.id) ? " checked" : ""}> ${esc(o.nom)} <span class="muted">${esc(o.metier || "")}${o.chantierId && o.chantierId !== cid ? " · autre chantier" : ""}</span></label>`).join("")}</div>
          <p class="muted" id="ptot"></p><div class="savebar"><button class="btn btn--primary" id="psave">Enregistrer le pointage</button></div>` : '<p class="empty">Ajoutez d\'abord des ouvriers (onglet « Ouvriers »).</p>') : '<p class="empty">Créez d\'abord un chantier.</p>'}</section>`;
      const goP = () => { location.hash = `#g-equipes/pointage/${$("#pd").value}/${$("#pc").value}`; };
      if ($("#pd")) { $("#pd").onchange = goP; $("#pc").onchange = goP; }
      const tot = () => { const ids = $$("#pl input:checked").map((i) => i.value); const t = sum(ids, (id) => (d.ouvriers.find((o) => o.id === id) || {}).tarifJour); if ($("#ptot")) $("#ptot").innerHTML = `${ids.length} présent(s) · coût de la journée : <b>${fcfa(t)}</b>`; };
      if ($("#pl")) { $("#pl").addEventListener("change", () => { tot(); G.setDirty(true); }); tot(); }
      if ($("#psave")) $("#psave").onclick = async () => {
        const body = { date: $("#pd").value, chantierId: $("#pc").value, presents: $$("#pl input:checked").map((i) => i.value) };
        try { await api(exist ? `/api/g/pointages/${exist.id}` : "/api/g/pointages", { method: exist ? "PUT" : "POST", body }); G.setDirty(false); toast("Pointage enregistré"); views["g-equipes"](`pointage/${body.date}/${body.chantierId}`); } catch (err) { fail(err); }
      };
      return;
    }
    // Paie de la semaine
    const deb = lundi(p1 || today()), fin = plusJours(deb, 6);
    const pts = d.pointages.filter((p) => p.date >= deb && p.date <= fin);
    const lignes = d.ouvriers.map((o) => {
      const jours = pts.filter((p) => p.presents.includes(o.id));
      return { o, jours: jours.length, chantiers: [...new Set(jours.map((p) => nomChantier(d.chantiers, p.chantierId)))].join(", "), montant: jours.length * (o.tarifJour || 0) };
    }).filter((l) => l.jours);
    main.innerHTML = head("Équipes et paie", `Semaine du ${dfr(deb)} au ${dfr(fin)}.`, '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button>') + tabs + `
      <section class="panel"><div class="filters">
        <a class="btn btn--sm btn--ghost" href="#g-equipes/paie/${plusJours(deb, -7)}">← Semaine précédente</a>
        <label>Semaine du<input type="date" id="sw" value="${deb}"></label>
        <a class="btn btn--sm btn--ghost" href="#g-equipes/paie/${plusJours(deb, 7)}">Semaine suivante →</a>
      </div>
      ${tableau([["Ouvrier", (l) => `<b>${esc(l.o.nom)}</b> <span class="muted">${esc(l.o.metier || "")}</span>`], ["Chantier(s)", (l) => esc(l.chantiers)], ["Jours", (l) => l.jours, 1], ["Tarif / jour", (l) => fcfa(l.o.tarifJour), 1], ["À payer", (l) => `<b>${fcfa(l.montant)}</b>`, 1]],
        lignes, null, ["Total", "", sum(lignes, (l) => l.jours), "", fcfa(sum(lignes, (l) => l.montant))])}</section>`;
    $("#sw").onchange = () => { location.hash = `#g-equipes/paie/${$("#sw").value}`; };
    $("#xp").onclick = () => exporter(`paie-semaine-${deb}`, [["Ouvrier", (l) => l.o.nom], ["Métier", (l) => l.o.metier], ["Téléphone", (l) => l.o.tel], ["Chantier(s)", (l) => l.chantiers], ["Jours", (l) => l.jours], ["Tarif / jour", (l) => l.o.tarifJour], ["À payer", (l) => l.montant]], lignes);
  };

  views["g-ouvrier"] = async (oid) => {
    const isNew = oid === "nouveau";
    const d = await load("ouvriers", "chantiers");
    const o = isNew ? { actif: true } : d.ouvriers.find((x) => x.id === oid);
    if (!o) { main.innerHTML = '<p class="empty">Ouvrier introuvable.</p>'; return; }
    main.innerHTML = head(isNew ? "Nouvel ouvrier" : esc(o.nom), "Fiche de l'ouvrier.", '<a class="btn btn--text" href="#g-equipes/ouvriers">← Retour</a>') + `
      <form class="form panel" id="f" novalidate style="max-width:760px"><div class="grid">
        <label class="full"><span>Nom et prénoms *</span><input name="nom" value="${esc(o.nom || "")}"></label>
        <label><span>Métier</span><input name="metier" list="metiers" value="${esc(o.metier || "")}" placeholder="Ex. Maçon"><datalist id="metiers">${["Maçon", "Ferrailleur", "Coffreur", "Électricien", "Plombier", "Carreleur", "Peintre", "Menuisier", "Manœuvre", "Chef de chantier"].map((m) => `<option value="${m}">`).join("")}</datalist></label>
        <label><span>Téléphone</span><input name="tel" value="${esc(o.tel || "")}"></label>
        <label><span>Tarif par jour (FCFA)</span><input name="tarifJour" inputmode="numeric" value="${o.tarifJour || ""}" placeholder="Ex. 7000"></label>
        <label><span>Chantier habituel</span><select name="chantierId">${chantierOpts(d.chantiers, o.chantierId)}</select></label>
        <label class="check"><input type="checkbox" name="actif"${o.actif !== false ? " checked" : ""}> Travaille actuellement avec GEI</label>
        <label class="full"><span>Notes</span><textarea name="notes" rows="2">${esc(o.notes || "")}</textarea></label>
      </div><div class="savebar">${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}<button type="submit" class="btn btn--primary">Enregistrer</button></div></form>`;
    const f = $("#f");
    f.addEventListener("input", () => G.setDirty(true));
    f.addEventListener("submit", (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); save("/api/g/ouvriers", isNew ? null : o.id, { ...v, tarifJour: num(v.tarifJour), actif: f.actif.checked }, "#g-equipes/ouvriers"); });
    if ($("#del")) $("#del").onclick = () => supprimer("/api/g/ouvriers", o.id, "cet ouvrier (astuce : décochez plutôt « Travaille actuellement » pour garder l'historique)", "#g-equipes/ouvriers");
  };

  /* ================= Comptes (dans « Mon compte », pour le DG) ================= */
  const compteOriginal = views.compte;
  views.compte = async () => {
    await compteOriginal();
    if (G.me().role !== "dg") return;
    const r = await api("/api/g/comptes");
    const box = document.createElement("div");
    box.innerHTML = `<section class="panel" style="margin-top:18px"><h2>Comptes d'accès</h2>
      <p class="muted">Le comptable n'accède qu'à la partie « Gestion GEI » (pas au site, ni aux comptes).</p>
      ${tableau([["Identifiant", (c) => `<b>${esc(c.user)}</b>`], ["Rôle", (c) => esc(r.roles[c.role] || c.role)], ["", (c) => (c.principal ? '<span class="muted">compte principal</span>' : `<button type="button" class="btn btn--sm btn--ghost" data-reset="${esc(c.user)}">Nouveau mot de passe</button> <button type="button" class="btn btn--sm btn--danger" data-del="${esc(c.user)}">Supprimer</button>`)]], r.comptes)}
      <form id="nc" class="grid" style="margin-top:16px" novalidate>
        <label><span>Identifiant</span><input name="user" placeholder="Ex. comptable" autocomplete="off"></label>
        <label><span>Mot de passe (10 caractères ou plus)</span><input name="password" type="password" autocomplete="new-password"></label>
        <label><span>Rôle</span><select name="role">${Object.entries(r.roles).map(([k, l]) => `<option value="${k}"${k === "comptable" ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <div style="align-self:end"><button class="btn btn--primary" type="submit">Créer le compte</button></div>
      </form></section>
      <section class="panel" style="margin-top:18px"><h2>Sauvegarde de la gestion</h2>
        <p class="muted">Téléchargez une copie complète (chantiers, maisons, paiements, dépenses, ouvriers, pointages). À faire chaque mois et à garder en lieu sûr.</p>
        <p><a class="btn btn--ghost" href="/api/g/sauvegarde">Télécharger la sauvegarde</a></p></section>`;
    main.appendChild(box);
    $("#nc").addEventListener("submit", async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(e.target));
      try { await api("/api/g/comptes", { method: "POST", body: v }); toast(`Compte « ${v.user} » créé`); views.compte(); } catch (err) { fail(err); }
    });
    box.addEventListener("click", async (e) => {
      const del = e.target.dataset.del, reset = e.target.dataset.reset;
      if (del && confirm(`Supprimer le compte « ${del} » ?`)) { try { await api(`/api/g/comptes/${del}`, { method: "DELETE" }); toast("Compte supprimé"); views.compte(); } catch (err) { fail(err); } }
      if (reset) { const pw = prompt(`Nouveau mot de passe pour « ${reset} » (10 caractères ou plus) :`); if (pw) { try { await api(`/api/g/comptes/${reset}/password`, { method: "POST", body: { password: pw } }); toast("Mot de passe changé"); } catch (err) { fail(err); } } }
    });
  };
  window.GEI_START();
})();
