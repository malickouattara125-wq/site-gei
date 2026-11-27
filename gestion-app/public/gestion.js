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
    categorie: { materiaux: "Matériaux", main_oeuvre: "Main-d'œuvre", sous_traitance: "Sous-traitance", transport: "Transport", location: "Engins et outillage", frais_chantier: "Frais de chantier", administratif: "Études et administratif", autre: "Divers" },
    mode: { especes: "Espèces", virement: "Virement", cheque: "Chèque", mobile_money: "Mobile Money", autre: "Autre" },
  };
  const opts = (map, v, vide) => (vide ? `<option value="">${vide}</option>` : "") + Object.entries(map).map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const st = (k) => `<span class="st st--${esc(k)}">${esc(LIB.statut[k] || k)}</span>`;
  const bar = (pct, warn) => `<div class="bar${warn ? (pct > 100 ? " bar--bad" : pct > 90 ? " bar--warn" : "") : ""}"><i style="width:${Math.min(100, Math.max(0, pct))}%"></i></div>`;
  const role = () => G.me().role;
  const argent = () => role() !== "chef";
  // Montant en lettres (pour les reçus)
  function enLettres(n) {
    n = Math.round(+n || 0); if (!n) return "zéro";
    const U = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
    const D = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
    const cent = (x) => {
      const c = Math.floor(x / 100), r = x % 100; let t = "";
      if (c) t = (c > 1 ? U[c] + " cent" : "cent") + (c > 1 && !r ? "s" : "") + (r ? " " : "");
      if (r < 17) t += U[r];
      else { const d = Math.floor(r / 10), u = r % 10;
        if (d === 7 || d === 9) t += D[d] + (u === 1 && d === 7 ? " et " : "-") + U[10 + u];
        else t += D[d] + (u === 1 && d !== 8 ? " et un" : u ? "-" + U[u] : d === 8 ? "s" : ""); }
      return t;
    };
    const parts = [[1e9, "milliard"], [1e6, "million"], [1e3, "mille"]]; let t = "";
    for (const [v, nom] of parts) { const q = Math.floor(n / v); if (q) { t += (nom === "mille" ? (q > 1 ? cent(q) + " mille" : "mille") : cent(q) + " " + nom + (q > 1 ? "s" : "")) + " "; n %= v; } }
    return (t + (n ? cent(n) : "")).trim().replace(/\s+/g, " ");
  }
  G.enLettres = enLettres;
  G.docsEditor = (box, list) => docsEditor(box, list);
  const waTel = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length === 10 ? "225" + d : d; };
  // Pièces jointes (factures, contrats, plans) : fichiers privés
  function docsEditor(box, list) {
    const draw = () => {
      box.innerHTML = (list.length ? `<ul class="docs">${list.map((d, i) => `<li data-i="${i}"><a href="/api/g/fichiers/${esc(d.fichier)}" target="_blank" rel="noopener">${G.ui.I(/\.pdf$/.test(d.fichier) ? "file" : "image")} ${esc(d.nom || d.fichier)}</a> <span class="muted">${d.date ? dfr(d.date) : ""}</span> <button type="button" class="btn btn--text" data-rm title="Retirer" aria-label="Retirer">${G.ui.I("x")}</button></li>`).join("")}</ul>` : '<p class="muted">Aucun document joint.</p>') +
        `<label class="btn btn--sm btn--secondary">${G.ui.I("upload")}Joindre un document (PDF ou photo)<input type="file" accept="application/pdf,image/*" multiple hidden></label>`;
    };
    box.addEventListener("click", (e) => { if (e.target.closest("[data-rm]")) { list.splice(+e.target.closest("li").dataset.i, 1); draw(); G.setDirty(true); } });
    box.addEventListener("change", async (e) => {
      if (!e.target.matches("input[type=file]")) return;
      for (const file of [...e.target.files]) {
        if (file.size > 8 * 1024 * 1024) { toast(`« ${file.name} » dépasse 8 Mo.`, true); continue; }
        toast(`Envoi de « ${file.name} »…`);
        try {
          const data = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(file); });
          const res = await api("/api/g/fichiers", { method: "POST", body: { name: file.name.replace(/\.[^.]+$/, ""), data } });
          list.push({ nom: res.nom, fichier: res.fichier, date: today() }); G.setDirty(true); toast("Document joint (pensez à enregistrer)");
        } catch (err) { fail(err); }
      }
      draw();
    });
    draw();
  }
  const load = async (...names) => Object.fromEntries(await Promise.all(names.map(async (n) => [n, await api("/api/g/" + n)])));

  // Calculs communs
  const avancement = (c) => (c.etapes && c.etapes.length ? Math.round(sum(c.etapes, (e) => e.avancement) / c.etapes.length) : 0);
  const paieDe = (pointages, ouvriers, filtre = () => true) => {
    const tarif = Object.fromEntries(ouvriers.map((o) => [o.id, o.tarifJour || 0]));
    return sum(pointages.filter(filtre), (p) => sum(p.presents, (id) => tarif[id] || 0));
  };
  const depenseChantier = (c, d) => sum(d.depenses.filter((x) => x.chantierId === c.id), (x) => x.montant) + paieDe(d.pointages, d.ouvriers, (p) => p.chantierId === c.id);
  // Dépenses : avances versées et reste à payer (anciennes dépenses : « payée » = tout versé)
  const verseDep = (x) => (Array.isArray(x.paiements) ? sum(x.paiements, (p) => p.montant) : (x.paye !== false ? x.montant || 0 : 0));
  const resteDep = (x) => Math.max(0, (x.montant || 0) - verseDep(x));
  G.verseDep = verseDep; G.resteDep = resteDep;
  // Partagé avec le volet Construction (construction.js)
  G.calc = { paieDe, depenseChantier, avancement, exporter: (...a) => exporter(...a) };
  const paye = (m) => sum(m.paiements || [], (p) => p.montant);
  const du = (m) => (["reservee", "vendue", "livree"].includes(m.statut) ? Math.max(0, (m.prix || 0) - paye(m)) : 0);
  const retard = (m) => { // montant échu non payé
    if (!["reservee", "vendue", "livree"].includes(m.statut)) return 0;
    const echu = sum((m.echeancier || []).filter((e) => e.date && e.date <= today()), (e) => e.montant);
    return Math.max(0, echu - paye(m));
  };
  const prochaine = (m) => { let cumul = 0; const p = paye(m); for (const e of (m.echeancier || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))) { cumul += e.montant; if (cumul > p) return e; } return null; };

  // Export d'une liste : fichier Excel .xlsx natif (ou PDF) aux couleurs de GEI — voir exports.js
  function exporter(nom, cols, rows, format = "xlsx", opts = {}) { G.exp.lancer(G.exp.simple(nom, cols, rows, opts), format); }
  const head = (...a) => G.ui.head(...a);
  const tableau = (...a) => G.ui.tableau(...a);
  main.addEventListener("click", (e) => { const tr = e.target.closest("tr[data-href]"); if (tr && !e.target.closest("a,button,input,select")) location.hash = tr.dataset.href; });

  // Lignes répétables (étapes, échéancier, paiements)
  function rowsEditor(box, list, fields, cols) {
    const draw = () => {
      box.innerHTML = list.map((r, i) => `<div class="r" style="--cols:${cols}" data-i="${i}">${fields.map((f) => f.type === "select"
        ? `<select data-k="${f.k}" aria-label="${f.ph}">${opts(f.map, r[f.k])}</select>`
        : f.type === "money" ? `<div class="ig"><input data-k="${f.k}" type="text" inputmode="numeric" class="money" value="${r[f.k] ? G.ui.sep(r[f.k]) : ""}" placeholder="${esc(f.ph)}" aria-label="${esc(f.ph)}"><span class="ig__suffix">FCFA</span></div>`
        : `<input data-k="${f.k}" type="${f.type || "text"}" value="${esc(r[f.k] == null ? "" : r[f.k])}" placeholder="${esc(f.ph)}" aria-label="${esc(f.ph)}"${f.type === "number" ? ' min="0" step="any"' : ""}>`).join("")}
        <button type="button" class="btn btn--tertiary btn--sm btn--icon" data-rm title="Retirer" aria-label="Retirer la ligne">${G.ui.I("x")}</button></div>`).join("") || '<p class="muted">Aucune ligne pour le moment.</p>';
    };
    box.addEventListener("input", (e) => { const r = e.target.closest(".r"); if (!r) return; const f = fields.find((x) => x.k === e.target.dataset.k); list[r.dataset.i][e.target.dataset.k] = f && (f.type === "number" || f.type === "money") ? num(e.target.value) : e.target.value; G.setDirty(true); box.dispatchEvent(new Event("change")); });
    box.addEventListener("click", (e) => { if (e.target.closest("[data-rm]")) { list.splice(+e.target.closest(".r").dataset.i, 1); draw(); G.setDirty(true); box.dispatchEvent(new Event("change")); } });
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
  const U = G.ui, I = U.I;
  const court = (n) => { const a = Math.abs(n), s = n < 0 ? "−" : ""; return a >= 1e6 ? `${s}${(a / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M` : a >= 1e3 ? `${s}${Math.round(a / 1e3)} k` : `${s}${Math.round(a)}`; };
  const finMois = (m) => { const d = new Date(m + "-01T12:00:00"); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); };
  const moisAvant = (m, n) => { const d = new Date(m + "-15T12:00:00"); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 7); };
  const enRetardEtape = (e) => e.dateFin && e.dateFin < today() && (e.avancement || 0) < 100;
  const statutDep = (x) => (!x.montant ? ["info", "Prix à compléter", "sansprix"] : !resteDep(x) ? ["ok", "Payé", "paye"] : verseDep(x) ? ["partiel", "Partiel", "partiel"] : ["impaye", "Impayé", "impaye"]);
  const badgeDep = (x) => { const [k, l] = statutDep(x); return `<span class="st st--${k}">${l}</span>`; };
  const phase = (c) => { const e = (c.etapes || []).find((x) => (x.avancement || 0) < 100); return e ? e.nom : (c.etapes || []).length ? "Toutes les étapes terminées" : "—"; };
  const photoDe = (c) => { const p = (c.photos || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0]; return p ? img(p.src) : ""; };
  const depuis = (ts) => {
    const s = (Date.now() - new Date(ts)) / 1000;
    if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.floor(s / 60)} min`; if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 172800) return "hier"; return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  // Alertes communes (tableau de gestion + cloche des notifications)
  function calculAlertes(d) {
    const out = [];
    const qte = (a) => sum((d.stock || []).filter((s) => s.articleId === a.id), (s) => (s.sens === "entree" ? s.quantite : -s.quantite));
    (d.articles || []).filter((a) => a.seuil && qte(a) <= a.seuil).forEach((a) => out.push({ niveau: "bad", icone: "package", titre: `Stock bas : ${a.nom}`, texte: `Il reste ${qte(a)} ${a.unite} (seuil ${a.seuil})`, href: "#g-stock" }));
    (d.chantiers || []).filter((c) => c.statut !== "termine").forEach((c) => (c.etapes || []).filter(enRetardEtape).forEach((e) => out.push({ niveau: "late", icone: "clock", titre: `Retard : ${c.nom}`, texte: `${e.nom} prévue le ${U.dateFr(e.dateFin)}, faite à ${e.avancement || 0} %`, href: `#g-chantier/${c.id}` })));
    if (d.depenses) (d.chantiers || []).filter((c) => c.budget && depenseChantier(c, d) > c.budget).forEach((c) => out.push({ niveau: "bad", icone: "alert", titre: `Budget dépassé : ${c.nom}`, texte: `${fcfa(depenseChantier(c, d))} pour ${fcfa(c.budget)} prévus`, href: `#g-chantier/${c.id}` }));
    (d.maisons || []).filter((x) => retard(x) > 0).forEach((x) => out.push({ niveau: "warn", icone: "house", titre: `Paiement client en retard`, texte: `${x.programme} lot ${x.lot} (${x.clientNom || "client"}) : ${fcfa(retard(x))}`, href: `#g-maison/${x.id}` }));
    const sansPrix = (d.depenses || []).filter((x) => !x.montant).length;
    if (sansPrix) out.push({ niveau: "warn", icone: "receipt", titre: `${sansPrix} dépense(s) sans prix`, texte: "Le montant reste à compléter", href: `#g-depenses/${encodeURIComponent("|||sansprix")}` });
    return out;
  }
  G.alertes = async () => {
    const names = argent() ? ["chantiers", "maisons", "depenses", "ouvriers", "pointages", "articles", "stock"] : ["chantiers", "articles", "stock"];
    const d = await load(...names); if (!d.pointages) { d.pointages = []; d.ouvriers = []; }
    return calculAlertes(d);
  };

  views.gestion = async () => {
    if (!argent()) { location.replace("#g-chantiers"); return; }
    const d = await load("chantiers", "maisons", "depenses", "ouvriers", "pointages", "mouvements", "articles", "stock", "contrats");
    const m = mois(today()), m1 = moisAvant(m, 1), six = [5, 4, 3, 2, 1, 0].map((n) => moisAvant(m, n));
    const encours = d.chantiers.filter((c) => c.statut === "en_cours");
    const depDe = (mm) => sum(d.depenses.filter((x) => mois(x.date) === mm), (x) => x.montant) + paieDe(d.pointages, d.ouvriers, (p) => mois(p.date) === mm);
    const depMois = depDe(m), depAvant = depDe(m1);
    const ops = G.operations ? G.operations(d) : [];
    const soldeAu = (jour) => sum(ops.filter((o) => o.date && o.date <= jour), (o) => (o.sens === "entree" ? o.montant : -o.montant));
    const treso = sum(ops, (o) => (o.sens === "entree" ? o.montant : -o.montant));
    const fluxMois = sum(ops.filter((o) => mois(o.date) === m), (o) => (o.sens === "entree" ? o.montant : -o.montant));
    const reste = sum(d.depenses, resteDep), impayes = d.depenses.filter((x) => resteDep(x) > 0).length;
    const actifs = d.chantiers.filter((c) => c.statut !== "termine");
    const retards = actifs.flatMap((c) => (c.etapes || []).filter(enRetardEtape).map((e) => ({ c, e })));
    const nouveaux = d.chantiers.filter((c) => mois(c.creeLe) === m).length;
    const pct = depAvant ? Math.round((depMois - depAvant) / depAvant * 100) : null;
    const moisFr1 = new Date(m1 + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "short" });
    const alertes = calculAlertes(d);
    const kc = (href, cls, titre, icone, val, foot, sp) => `<a class="card kc ${cls}" href="${href}"><div class="kc__top"><span class="t-micro">${titre}</span><span class="kpi__icon">${I(icone)}</span></div><div class="kc__val">${val}</div><div class="kc__foot">${foot}${sp}</div></a>`;
    const montantAnime = (n) => `<span data-count="${Math.round(n)}">${U.sep(n)}</span><span class="cur">F</span>`;
    const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    main.innerHTML = `
      <div class="hello"><div><small>${jour}</small><h1>Bonjour, ${esc(G.me().user || "")}</h1></div>
        <div class="top__actions">${G.exp.bouton()}<a class="btn btn--secondary" href="#g-maisons">${I("house")}Paiement client</a><a class="btn btn--primary" href="#g-depense/nouvelle">${I("plus")}Nouvelle dépense</a></div></div>
      <div class="kc-grid">
        ${kc("#g-chantiers", "", "Chantiers actifs", "hardhat", `<span data-count="${encours.length}">${encours.length}</span>`,
          U.delta(nouveaux ? `+${nouveaux} ce mois` : `${actifs.length} non terminés`, nouveaux ? true : null), U.spark(six.map((mm) => d.chantiers.filter((c) => (c.dateDebut || String(c.creeLe || "").slice(0, 10)) <= finMois(mm)).length)))}
        ${kc("#g-depenses", "", "Dépenses du mois", "receipt", montantAnime(depMois),
          U.delta(pct === null ? "nouveau mois" : pct > 300 ? `×${(depMois / depAvant).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} vs ${moisFr1}` : `${pct > 0 ? "+" : ""}${pct} % vs ${moisFr1}`, pct === null || pct === 0 ? null : pct < 0), U.spark(six.map(depDe)))}
        ${kc("#g-tresorerie", "", "Trésorerie disponible", "wallet", montantAnime(treso),
          U.delta(`${fluxMois >= 0 ? "+" : ""}${court(fluxMois)} ce mois`, fluxMois === 0 ? null : fluxMois > 0), U.spark(six.map((mm) => soldeAu(finMois(mm)))))}
        ${kc(`#g-depenses/${encodeURIComponent("|||impaye")}`, reste ? "kc--bad" : "", "Reste à payer", "alert", montantAnime(reste),
          U.delta(`${impayes} dépense(s)`, impayes ? false : null), U.spark(six.map((mm) => sum(d.depenses.filter((x) => x.date <= finMois(mm)), resteDep)), "spark--bad"))}
        ${kc("#g-planning", retards.length ? "kc--late" : "", "Tâches en retard", "clock", `<span data-count="${retards.length}">${retards.length}</span>`,
          U.delta(retards.length ? `${new Set(retards.map((r) => r.c.id)).size} chantier(s)` : "aucun retard", retards.length ? false : true), U.spark(six.map((mm) => actifs.reduce((t, c) => t + (c.etapes || []).filter((e) => e.dateFin && mois(e.dateFin) === mm && (e.avancement || 0) < 100 && e.dateFin < today()).length, 0)), "spark--late"))}
      </div>
      <div class="dash">
        <div class="dash__main">
          <section class="panel"><div class="card__head"><h2>Chantiers en cours</h2><a class="btn btn--tertiary btn--sm" href="#g-chantiers">Tout voir${I("chevright")}</a></div>
            ${actifs.length ? `<div class="cc-grid">${actifs.slice().sort((a, b) => (b.statut === "en_cours") - (a.statut === "en_cours")).slice(0, 6).map((c) => {
              const dep = depenseChantier(c, d), p = c.budget ? Math.round(dep / c.budget * 100) : 0, ph = photoDe(c);
              return `<a class="card cc" href="#g-chantier/${c.id}">
                <div class="cc__img${ph ? "" : " cc__img--ph"}">${ph ? `<img src="${esc(ph)}" alt="" loading="lazy">` : I("hardhat")}${st(c.statut)}</div>
                <div class="cc__body"><div style="min-width:0"><h3>${esc(c.nom)}</h3><div class="cc__loc">${I("pin")}${esc(c.lieu || "Lieu non précisé")}</div></div>${U.ring(avancement(c))}</div>
                <div class="cc__phase"><span>Phase</span><b>${esc(phase(c))}</b></div>
                <div class="cc__budget"><div><span>Budget consommé</span><span><b>${court(dep)}</b> / ${c.budget ? court(c.budget) : "—"}</span></div><div class="progress${p > 100 ? " progress--bad" : p > 90 ? " progress--warn" : ""}"><i style="width:${Math.min(100, p)}%"></i></div></div></a>`;
            }).join("")}</div>` : U.vide("Aucun chantier en cours. Créez votre premier chantier.", "hardhat") + '<p style="text-align:center"><a class="btn btn--primary" href="#g-chantier/nouveau">Nouveau chantier</a></p>'}
          </section>
          <section class="panel"><div class="card__head"><div><h2>Dépenses par chantier</h2><p class="t-help" style="margin:2px 0 0">Réparties par catégorie, paie des ouvriers comprise</p></div>
            <div class="seg" id="per" role="group" aria-label="Période"><button type="button" data-p="mois">Ce mois</button><button type="button" data-p="6m">6 mois</button><button type="button" data-p="tout" class="is-on">Tout</button></div></div>
            <div id="chart"></div></section>
        </div>
        <aside class="dash__side">
          <section class="panel"><div class="card__head"><h2>Alertes</h2>${alertes.length ? `<span class="st st--impaye">${alertes.length}</span>` : ""}</div>
            ${alertes.length ? `<div class="al">${alertes.slice(0, 6).map((a) => `<a href="${esc(a.href)}"><span class="notif__ic notif__ic--${a.niveau}">${I(a.icone)}</span><span><b>${esc(a.titre)}</b><small>${esc(a.texte)}</small></span></a>`).join("")}</div>${alertes.length > 6 ? `<p class="muted">+ ${alertes.length - 6} autre(s) dans la cloche des notifications.</p>` : ""}` : U.vide("Aucune alerte : stock, délais et budgets sont en ordre.", "check")}
          </section>
          <section class="panel"><h2>Activité récente</h2><div id="tl"></div></section>
        </aside>
      </div>`;

    G.exp.brancher("xp", () => ({
      fichier: `GEI_Tableau-de-gestion_${today()}`, titre: "Tableau de gestion", filtres: `Situation au ${G.exp.dateFr(today())}`, orientation: "portrait",
      chiffres: [{ l: "Trésorerie disponible", v: treso }, { l: "Dépenses du mois", v: depMois }, { l: "Reste à payer", v: reste, bad: reste > 0, s: impayes + " dépense(s)" }, { l: "Tâches en retard", v: retards.length, type: "nombre", bad: retards.length > 0 }],
      feuilles: [
        { nom: "Synthèse", titre: "Indicateurs", colonnes: [{ t: "Indicateur" }, { t: "Valeur", type: "montant" }], total: false, lignes: [
          ["Chantiers actifs", { v: encours.length, type: "nombre" }], ["Dépenses du mois", depMois], ["Trésorerie disponible", treso], ["Reste à payer aux fournisseurs", reste], ["Dépenses à régler", { v: impayes, type: "nombre" }], ["Tâches en retard", { v: retards.length, type: "nombre" }]] },
        { nom: "Chantiers en cours", titre: "Chantiers", colonnes: [{ t: "Chantier" }, { t: "Lieu" }, { t: "Statut" }, { t: "Phase" }, { t: "Avancement", type: "pct" }, { t: "Budget", type: "montant" }, { t: "Dépensé", type: "montant" }, { t: "Budget consommé", type: "pct" }],
          lignes: actifs.map((c) => { const dep = depenseChantier(c, d); return [c.nom, c.lieu, LIB.statut[c.statut] || "", phase(c), avancement(c), c.budget || "", dep, c.budget ? Math.round(dep / c.budget * 100) : ""]; }) },
        { nom: "Alertes", titre: "Alertes", colonnes: [{ t: "Alerte" }, { t: "Détail" }], lignes: alertes.map((a) => [a.titre, a.texte]) },
      ] }));
    // Graphique : dépenses par chantier et par catégorie
    const CATS = [...Object.entries(LIB.categorie).map(([k, l], i) => [k, l, `var(--c${i + 1})`]), ["paie", "Paie des ouvriers", "var(--info)"]];
    const tarif = Object.fromEntries(d.ouvriers.map((o) => [o.id, o.tarifJour || 0]));
    const chart = (per) => {
      const ok = (dt) => per === "tout" || (per === "mois" ? mois(dt) === m : mois(dt) >= six[0]);
      const lignes = [...d.chantiers, { id: "", nom: "Général (sans chantier)" }].map((c) => {
        const parts = CATS.map(([k]) => (k === "paie" ? sum(d.pointages.filter((p) => (p.chantierId || "") === c.id && ok(p.date)), (p) => sum(p.presents, (id) => tarif[id] || 0))
          : sum(d.depenses.filter((x) => (x.chantierId || "") === c.id && x.categorie === k && ok(x.date)), (x) => x.montant)));
        return { c, parts, tot: sum(parts) };
      }).filter((l) => l.tot).sort((a, b) => b.tot - a.tot).slice(0, 8);
      const max = Math.max(1, ...lignes.map((l) => l.tot));
      const totCat = CATS.map((_, i) => sum(lignes, (l) => l.parts[i]));
      $("#chart").innerHTML = lignes.length ? `<div class="hbars">${lignes.map((l) => `<div class="hbar" title="${esc(l.c.nom)} : ${fcfa(l.tot)}"><span class="hbar__name">${esc(l.c.nom)}</span>
        <span class="hbar__track" style="width:${Math.max(4, l.tot / max * 100)}%">${l.parts.map((v, i) => (v ? `<i style="width:${v / l.tot * 100}%;background:${CATS[i][2]}" title="${esc(CATS[i][1])} : ${fcfa(v)}"></i>` : "")).join("")}</span>
        <span class="hbar__val">${court(l.tot)} F</span></div>`).join("")}</div>
        <div class="legend">${CATS.map(([, l, col], i) => (totCat[i] ? `<span><i style="background:${col}"></i>${esc(l)} <b>${court(totCat[i])}</b></span>` : "")).join("")}</div>`
        : U.vide("Aucune dépense sur cette période.", "receipt");
    };
    chart("tout");
    $("#per").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (!b) return; $$("#per button").forEach((x) => x.classList.toggle("is-on", x === b)); chart(b.dataset.p); });

    // Activité récente
    const nomC = (id) => nomChantier(d.chantiers, id);
    const art = (id) => d.articles.find((a) => a.id === id) || { nom: "article", unite: "" };
    const ev = [
      ...d.depenses.map((x) => ({ ts: x.modifieLe || x.creeLe, i: "receipt", t: `<b>${esc(x.modifiePar || x.creePar || "?")}</b> a ${x.modifieLe ? "modifié" : "ajouté"} la dépense <b>${esc(x.libelle)}</b>${x.montant ? ` · ${fcfa(x.montant)}` : ""}`, h: `#g-depense/${x.id}` })),
      ...d.chantiers.map((c) => ({ ts: c.modifieLe || c.creeLe, i: "hardhat", t: `<b>${esc(c.modifiePar || c.creePar || "?")}</b> a ${c.modifieLe ? "mis à jour" : "créé"} le chantier <b>${esc(c.nom)}</b>`, h: `#g-chantier/${c.id}` })),
      ...d.maisons.flatMap((x) => (x.paiements || []).map((p) => ({ ts: (p.date || "") + "T12:00:00", i: "house", t: `Paiement de <b>${esc(x.clientNom || "client")}</b> · ${esc(x.programme)} lot ${esc(x.lot)} · ${fcfa(p.montant)}`, h: `#g-maison/${x.id}` }))),
      ...d.chantiers.filter((c) => c.nature === "particulier").flatMap((c) => (c.paiements || []).map((p) => ({ ts: (p.date || "") + "T12:00:00", i: "wallet", t: `Versement de <b>${esc(c.client || "client")}</b> · ${esc(c.nom)} · ${fcfa(p.montant)}`, h: `#g-chantier/${c.id}` }))),
      ...d.mouvements.map((x) => ({ ts: x.creeLe, i: "wallet", t: `<b>${esc(x.creePar || "?")}</b> a enregistré ${x.sens === "entree" ? "une entrée" : "une sortie"} : ${esc(x.libelle)} · ${fcfa(x.montant)}`, h: `#g-mouvement/${x.id}` })),
      ...d.stock.map((s) => ({ ts: s.creeLe, i: "package", t: `<b>${esc(s.creePar || "?")}</b> : ${s.sens === "entree" ? "entrée" : "sortie"} de ${s.quantite} ${esc(art(s.articleId).unite)} de ${esc(art(s.articleId).nom)}${s.chantierId ? ` vers ${esc(nomC(s.chantierId))}` : ""}`, h: "#g-stock" })),
      ...d.pointages.map((p) => ({ ts: p.modifieLe || p.creeLe, i: "users", t: `<b>${esc(p.modifiePar || p.creePar || "?")}</b> a pointé ${p.presents.length} ouvrier(s) sur ${esc(nomC(p.chantierId))}`, h: `#g-equipes/pointage/${p.date}/${p.chantierId}` })),
    ].filter((e) => e.ts && !isNaN(new Date(e.ts))).sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 8);
    $("#tl").innerHTML = ev.length ? `<ul class="tl">${ev.map((e) => `<li><span class="tl__ic">${I(e.i)}</span><div><p><a href="${esc(e.h)}" style="color:inherit">${e.t}</a></p><small>${depuis(e.ts)}</small></div></li>`).join("")}</ul>` : U.vide("Les dernières actions de l'équipe s'afficheront ici.", "clock");
  };

  /* ================= Chantiers ================= */
  views["g-chantiers"] = async () => {
    const d = argent() ? await load("chantiers", "depenses", "ouvriers", "pointages") : { ...(await load("chantiers", "ouvriers", "pointages")), depenses: [] };
    const cols = [["Chantier", (c) => `<b>${esc(c.nom)}</b><br><span class="muted">${esc([c.lieu, c.client].filter(Boolean).join(" · "))}</span>`], ["Statut", (c) => st(c.statut)],
      ["Avancement", (c) => `${bar(avancement(c))}<span class="muted">${avancement(c)} %</span>`], ["Début", (c) => dfr(c.dateDebut)], ["Fin prévue", (c) => dfr(c.dateFin)],
      ["Budget", (c) => fcfa(c.budget), 1], ["Dépensé", (c) => fcfa(depenseChantier(c, d)), 1], ["Reste", (c) => fcfa((c.budget || 0) - depenseChantier(c, d)), 1]];
    if (!argent()) cols.splice(5, 3);
    main.innerHTML = head("Chantiers", argent() ? "Tous les chantiers : étapes, avancement, budget et dépenses." : "Mettez à jour l'avancement et les photos de vos chantiers.",
      argent() ? '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button><a class="btn btn--primary" href="#g-chantier/nouveau">+ Nouveau chantier</a>' : '<button class="btn btn--ghost" id="xp">Exporter (Excel)</button>') +
      `<section class="panel">${tableau(cols, d.chantiers.slice().sort((a, b) => (a.statut === "termine") - (b.statut === "termine")), (c) => `#g-chantier/${c.id}`,
        argent() ? ["Total", "", "", "", "", fcfa(sum(d.chantiers, (c) => c.budget)), fcfa(sum(d.chantiers, (c) => depenseChantier(c, d))), ""] : null)}</section>`;
    $("#xp").onclick = () => exporter("chantiers", [["Chantier", (c) => c.nom], ["Lieu", (c) => c.lieu], ["Client", (c) => c.client], ["Statut", (c) => LIB.statut[c.statut]], ["Avancement %", avancement], ["Début", (c) => c.dateDebut], ["Fin prévue", (c) => c.dateFin], ["Budget", (c) => c.budget], ["Dépensé", (c) => depenseChantier(c, d)]], d.chantiers);
  };

  const ETAPES = ["Terrassement", "Fondations", "Élévation des murs", "Dalle / poteaux", "Toiture", "Électricité et plomberie", "Enduits", "Carrelage", "Menuiseries", "Peinture", "Finitions et nettoyage"];
  views["g-chantier"] = async (arg) => {
    const [cid, , etapeVisee] = String(arg || "").split("/");
    const isNew = cid === "nouveau" || cid === "nouveau-particulier";
    if (isNew && !argent()) { location.replace("#g-chantiers"); return; }
    const d = argent() ? await load("chantiers", "depenses", "ouvriers", "pointages") : { ...(await load("chantiers", "ouvriers", "pointages")), depenses: [] };
    const c = isNew ? { statut: "en_cours", etapes: ETAPES.map((nom) => ({ nom, avancement: 0 })), photos: [], nature: cid === "nouveau-particulier" ? "particulier" : "", travaux: "construction" } : d.chantiers.find((x) => x.id === cid);
    if (!c) { main.innerHTML = U.vide("Chantier introuvable.", "hardhat"); return; }
    const etapes = (c.etapes || []).map((e) => ({ ...e })), photos = (c.photos || []).map((p) => ({ ...p })), documents = (c.documents || []).map((x) => ({ ...x }));
    const ech = (c.echeancier || []).map((x) => ({ ...x })), pay = (c.paiements || []).map((x) => ({ ...x }));
    const part0 = c.nature === "particulier", genre0 = part0 ? c.travaux || "construction" : "programme";
    const retourListe = part0 ? "#g-chantiers/particuliers" : "#g-chantiers";
    let etapesTouchees = !isNew;
    const deps = d.depenses.filter((x) => x.chantierId === c.id);
    const paie = paieDe(d.pointages, d.ouvriers, (p) => p.chantierId === c.id);
    const achats = sum(deps, (x) => x.montant), resteFour = sum(deps, resteDep), verseFour = sum(deps, verseDep);
    const parCat = Object.entries(LIB.categorie).map(([k, l]) => [l, sum(deps.filter((x) => x.categorie === k), (x) => x.montant)]).filter((x) => x[1]);
    const sec = (n, titre, sous) => `<div class="sec__head"><span class="sec__n">${n}</span><div><h2>${titre}</h2><p>${sous}</p></div></div>`;
    let n = 0;
    const titreNouveau = part0 ? "Nouveau chantier particulier" : "Nouveau programme";
    main.innerHTML = head(isNew ? titreNouveau : esc(c.nom), isNew ? (part0 ? "Construction ou rénovation pour un client : le chantier, ses dépenses et les versements du client." : "Créez le programme (nom, lieu, dates, budget), puis ajoutez ses villas.")
      : `${st(c.statut)}${part0 ? ` · ${c.travaux === "renovation" ? "Rénovation" : "Construction"} pour ${esc(c.client || "un particulier")}` : ""}${c.lieu ? " · " + esc(c.lieu) : ""}`,
      `${!isNew && part0 && argent() ? `<button type="button" class="btn btn--secondary" id="releve">${I("printer")}Relevé client (PDF)</button>` : ""}<a class="btn btn--tertiary" href="${retourListe}">${I("chevleft")}Retour</a>`,
      [["Chantiers", "#g-chantiers"], ...(part0 ? [["Particuliers", "#g-chantiers/particuliers"]] : []), [isNew ? titreNouveau : esc(c.nom), ""]]) + `
      <form class="form form--split" id="f" novalidate>
        <div class="form__main">
          <section class="panel">${sec(++n, "Informations générales", "Nature, nom, lieu, client, dates et budget.")}
            <div class="grid">
              <label class="full"><span>Nature du chantier</span><select name="genre"${argent() ? "" : " disabled"}>${opts({ programme: "Programme immobilier GEI (villas)", construction: "Particulier : construction pour un client", renovation: "Particulier : rénovation pour un client" }, genre0)}</select></label>
              <label class="full"><span><b id="lNom">${part0 ? "Nom du chantier" : "Nom du programme"}</b> <i class="req">*</i></span><input name="nom" value="${esc(c.nom || "")}" placeholder="${part0 ? "Ex. Villa M. Koné, Bingerville" : "Ex. Cité Les Rives de l'Opulence, tranche 2"}" autocomplete="off"></label>
              <label><span>Lieu</span><input name="lieu" value="${esc(c.lieu || "")}" placeholder="Ex. Adiaké"></label>
              <label><span id="lClient">${part0 ? "Nom du client" : "Client / propriétaire"}</span><input name="client" value="${esc(c.client || "")}" placeholder="${part0 ? "Ex. M. Koné Ibrahim" : "Ex. GEI (programme) ou nom du client"}"></label>
              <label class="only-part"${part0 ? "" : " hidden"}><span>Téléphone du client</span><input name="clientTel" value="${esc(c.clientTel || "")}" inputmode="tel" placeholder="Ex. 07 00 00 00 00"></label>
              <label><span>Type d'ouvrage</span><input name="type" value="${esc(c.type || "")}" placeholder="${part0 ? "Ex. Villa basse 4 pièces, ou réfection toiture" : "Ex. 20 villas basses 4 pièces"}"></label>
              <label><span>Statut</span><select name="statut">${opts({ preparation: "En préparation", en_cours: "En cours", pause: "En pause", termine: "Terminé" }, c.statut)}</select></label>
              <label><span>Date de début</span><input name="dateDebut" type="date" value="${esc(c.dateDebut || "")}"></label>
              <label><span>Fin prévue</span><input name="dateFin" type="date" value="${esc(c.dateFin || "")}"></label>
              ${argent() ? `<label class="full"><span id="lBud">${part0 ? "Coût prévu des travaux (budget interne)" : "Budget prévu"}</span><input name="budget" class="money" inputmode="numeric" value="${c.budget || ""}" placeholder="Ex. 150 000 000"></label>` : ""}
            </div></section>
          ${argent() ? `<section class="panel only-part" id="sec-client"${part0 ? "" : " hidden"}>${sec(I("wallet"), "Client et paiements", "Le prix convenu avec le client, les tranches prévues et les versements reçus.")}
            <div class="grid"><label class="full"><span>Prix convenu avec le client (devis / marché)</span><input name="prix" class="money" inputmode="numeric" value="${c.prix || ""}" placeholder="Ex. 35 000 000"></label></div>
            <h3 style="margin:18px 0 6px;font-size:15px">Tranches prévues</h3><p class="t-help">Acompte, paiement par étape, solde… avec la date prévue.</p>
            <div class="rows" id="ech"></div><div class="pay-actions"><button type="button" class="btn btn--secondary btn--sm" id="addEch">${I("plus")}Ajouter une tranche</button><span class="muted" id="totEch"></span></div>
            <h3 style="margin:18px 0 6px;font-size:15px">Versements reçus du client</h3>
            <div class="rows" id="pay"></div><div class="pay-actions"><button type="button" class="btn btn--secondary btn--sm" id="addPay">${I("plus")}Ajouter un versement</button></div>
            ${(c.paiements || []).length ? `<p class="muted" style="margin-top:12px">Reçus à imprimer : ${c.paiements.map((p, i) => `<button type="button" class="btn btn--sm btn--ghost" data-recu="${i}">${dfr(p.date)} · ${fcfa(p.montant)}</button>`).join(" ")}</p>` : `<p class="t-help" style="margin-top:12px">Après l'enregistrement, un reçu à imprimer apparaît ici pour chaque versement.</p>`}
          </section>` : ""}
          <section class="panel" id="sec-etapes">${sec(++n, "Étapes et avancement", "Le % réalisé et les dates prévues de chaque étape. L'avancement du chantier est la moyenne.")}
            <div class="r r--head" style="--cols:2fr 110px 150px 150px 36px"><span>Étape</span><span>% réalisé</span><span>Début prévu</span><span>Fin prévue</span><span></span></div>
            <div class="rows" id="et"></div>
            <div class="pay-actions"><button type="button" class="btn btn--secondary btn--sm" id="addE">${I("plus")}Ajouter une étape</button></div></section>
          <section class="panel">${sec(++n, "Photos du chantier", "Suivez l'évolution en images, avec la date et une légende.")}
            <div class="gal" id="ph"></div>
            <div class="pay-actions"><button type="button" class="btn btn--secondary btn--sm" id="addP">${I("plus")}Ajouter une photo</button></div></section>
          ${argent() ? `<section class="panel">${sec(++n, "Documents et notes", "Plans, contrat, permis, devis… (visibles seulement dans GEI Gestion).")}
            <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Ex. livraison du fer prévue la semaine prochaine">${esc(c.notes || "")}</textarea></label>
            <div style="margin-top:16px"><span class="lbl" style="margin-bottom:8px">Documents</span><div id="docs"></div></div></section>`
            : `<section class="panel">${sec(++n, "Notes", "Remarques sur le chantier.")}<label class="field"><span>Notes</span><textarea name="notes" rows="3">${esc(c.notes || "")}</textarea></label></section>`}
        </div>
        <aside class="form__side">
          <section class="panel recap" aria-live="polite">
            <div class="recap__top"><span class="t-micro">Récapitulatif</span><span id="kSt"></span></div>
            <div class="recap__av"><div id="kRing"></div><div><b id="kAv"></b><span id="kEt"></span></div></div>
            <div class="recap__lines">
              <div id="kRetL"><span>Étapes en retard</span><b id="kRet"></b></div>
              <div><span>Période</span><b id="kPer"></b></div>
              ${argent() ? `<div><span>Budget</span><b id="kBud"></b></div>
              <div><span>Dépensé (achats + paie)</span><b id="kDep"></b></div>
              <div id="kResteL"><span>Reste du budget</span><b id="kReste"></b></div>
              <div class="${resteFour ? "is-bad" : "is-ok"}"><span>Reste à payer fournisseurs</span><b>${U.money(resteFour)}</b></div>
              <div class="only-part"${part0 ? "" : " hidden"}><span>Prix convenu (client)</span><b id="kPrix"></b></div>
              <div class="only-part"${part0 ? "" : " hidden"}><span>Encaissé du client</span><b id="kEnc"></b></div>
              <div class="only-part" id="kRaeL"${part0 ? "" : " hidden"}><span>Reste à encaisser</span><b id="kRae"></b></div>
              <div class="only-part" id="kMargeL"${part0 ? "" : " hidden"}><span>Marge (prix − dépensé)</span><b id="kMarge"></b></div>` : ""}
            </div>
            ${argent() ? `<span class="t-help">Budget consommé : <b id="kPct">0 %</b></span><div class="progress"><i id="kBar" style="width:0%"></i></div>
              ${parCat.length || paie ? `<p class="recap__meta">${parCat.map(([l, v]) => `${l} : <b>${fcfa(v)}</b>`).concat(paie ? [`Paie ouvriers : <b>${fcfa(paie)}</b>`] : []).join(" · ")}</p>` : ""}
              ${isNew ? "" : `<div class="recap__acts"><a class="btn btn--primary btn--sm" href="#g-depense/nouvelle/${c.id}">${I("plus")}Dépense sur ce chantier</a><a class="btn btn--secondary btn--sm" href="#g-depenses/${encodeURIComponent(c.id + "|||")}">Voir les ${deps.length} dépense(s)</a></div>`}` : ""}
            ${isNew ? "" : `<p class="recap__meta">Créé par ${esc(c.creePar || "?")}${c.modifiePar ? `, modifié par ${esc(c.modifiePar)}` : ""}.${argent() ? ` Déjà payé aux fournisseurs : ${fcfa(verseFour)}.` : ""}</p>`}
          </section>
          <div class="tip">${I("alertcircle")}<span>Mettez à jour le % de chaque étape après vos visites : le planning${argent() ? ", le tableau de gestion" : ""} et les alertes de retard se mettent à jour tout seuls.</span></div>
        </aside>
        <div class="savebar">${isNew || !argent() ? "" : `<button type="button" class="btn btn--danger" id="del">${I("trash")}Supprimer</button>`}<button type="submit" class="btn btn--primary">${I("check")}${isNew ? "Créer le chantier" : "Enregistrer"}</button></div>
      </form>`;
    const f = $("#f");
    f.addEventListener("input", () => G.setDirty(true));
    if (!argent()) $$("#f [name=nom], #f [name=lieu], #f [name=client], #f [name=type], #f [name=dateDebut], #f [name=dateFin]").forEach((i) => { i.readOnly = true; });
    const ed = rowsEditor($("#et"), etapes, [{ k: "nom", ph: "Étape" }, { k: "avancement", ph: "% réalisé", type: "number" }, { k: "dateDebut", ph: "Début prévu", type: "date" }, { k: "dateFin", ph: "Fin prévue", type: "date" }], "2fr 110px 150px 150px 36px");
    if ($("#docs")) docsEditor($("#docs"), documents);
    const drawP = () => { $("#ph").innerHTML = photos.map((p, i) => `<figure data-i="${i}"><img src="${esc(img(p.src))}" alt=""><figcaption><input type="date" data-k="date" value="${esc(p.date || "")}" aria-label="Date"><input data-k="legende" value="${esc(p.legende || "")}" placeholder="Légende" aria-label="Légende"><div><span></span><button type="button" class="btn btn--danger" data-rm>Retirer</button></div></figcaption></figure>`).join("") || '<p class="muted">Aucune photo pour le moment.</p>'; };
    $("#ph").addEventListener("input", (e) => { photos[e.target.closest("figure").dataset.i][e.target.dataset.k] = e.target.value; G.setDirty(true); });
    $("#ph").addEventListener("click", (e) => { if (e.target.matches("[data-rm]")) { photos.splice(+e.target.closest("figure").dataset.i, 1); drawP(); G.setDirty(true); } });
    $("#addP").onclick = () => pick((srcs) => { srcs.forEach((src) => photos.push({ src, date: today(), legende: "" })); drawP(); G.setDirty(true); }, true);
    drawP();
    const calc = () => {
      const t = today(), valides = etapes.filter((e) => e.nom);
      const av = valides.length ? Math.round(sum(valides, (e) => Math.max(0, Math.min(100, +e.avancement || 0))) / valides.length) : 0;
      const ret = valides.filter((e) => e.dateFin && e.dateFin < t && (+e.avancement || 0) < 100).length;
      $("#kRing").innerHTML = U.ring(av); $("#kAv").textContent = `${av} % réalisé`;
      $("#kEt").textContent = `${valides.filter((e) => (+e.avancement || 0) >= 100).length} étape(s) terminée(s) sur ${valides.length}`;
      $("#kRet").textContent = ret; $("#kRetL").className = ret ? "is-bad" : "";
      $("#kSt").innerHTML = st(f.statut.value);
      const dd = f.dateDebut.value, df = f.dateFin.value;
      $("#kPer").textContent = dd || df ? `${dd ? U.dateFr(dd) : "?"} → ${df ? U.dateFr(df) : "?"}` : "—";
      if (argent()) {
        const bud = num(f.budget.value), dep = achats + paie, pc = bud ? Math.round(dep / bud * 100) : 0;
        $("#kBud").innerHTML = bud ? U.money(bud) : "—"; $("#kDep").innerHTML = U.money(dep);
        $("#kReste").innerHTML = bud ? U.money(bud - dep) : "—"; $("#kResteL").className = bud && dep > bud ? "is-bad" : "";
        $("#kPct").textContent = pc + " %"; $("#kBar").style.width = Math.min(100, pc) + "%"; $("#kBar").parentElement.classList.toggle("progress--bad", pc > 100);
        const prix = num(f.prix.value), enc = sum(pay, (x) => x.montant), te = sum(ech, (x) => x.montant);
        $("#kPrix").innerHTML = prix ? U.money(prix) : "—"; $("#kEnc").innerHTML = U.money(enc);
        $("#kRae").innerHTML = prix ? U.money(Math.max(0, prix - enc)) : "—"; $("#kRaeL").classList.toggle("is-bad", prix > enc);
        $("#kMarge").innerHTML = prix ? U.money(prix - dep) : "—"; $("#kMargeL").className = "only-part" + (prix && dep > prix ? " is-bad" : prix ? " is-ok" : "");
        $("#totEch").textContent = ech.length ? `Total prévu : ${fcfa(te)}${prix && te !== prix ? ` (prix convenu : ${fcfa(prix)})` : ""}` : "";
      }
    };
    // Nature du chantier : programme GEI ou particulier (construction / rénovation)
    const ETAPES_RENO = ["Diagnostic et devis", "Démolition et dépose", "Maçonnerie et reprises", "Électricité et plomberie", "Enduits et plafonds", "Carrelage", "Menuiseries", "Peinture", "Finitions et nettoyage"];
    const nature = () => {
      const g = f.genre.value, part = g !== "programme";
      $$("#f .only-part").forEach((x) => { x.hidden = !part; });
      $("#lNom").textContent = part ? "Nom du chantier" : "Nom du programme";
      $("#lClient").textContent = part ? "Nom du client" : "Client / propriétaire";
      if ($("#lBud")) $("#lBud").textContent = part ? "Coût prévu des travaux (budget interne)" : "Budget prévu";
      if (!etapesTouchees) { etapes.splice(0, etapes.length, ...(g === "renovation" ? ETAPES_RENO : ETAPES).map((nom) => ({ nom, avancement: 0 }))); ed.draw(); }
      calc();
    };
    f.genre.addEventListener("change", nature);
    $("#et").addEventListener("input", () => { etapesTouchees = true; });
    if (isNew && genre0 === "renovation") nature();
    if ($("#ech")) {
      const e1 = rowsEditor($("#ech"), ech, [{ k: "date", ph: "Date prévue", type: "date" }, { k: "libelle", ph: "Libellé (ex. acompte au démarrage)" }, { k: "montant", ph: "Montant", type: "money" }], "160px 2fr 170px 36px");
      const e2 = rowsEditor($("#pay"), pay, [{ k: "date", ph: "Date", type: "date" }, { k: "montant", ph: "Montant", type: "money" }, { k: "mode", ph: "Mode", type: "select", map: LIB.mode }, { k: "reference", ph: "Référence / n° de reçu" }], "160px 170px 150px 1fr 36px");
      $("#addEch").onclick = () => { e1.add({ date: "", libelle: "", montant: 0 }); calc(); };
      $("#addPay").onclick = () => { e2.add({ date: today(), montant: 0, mode: "especes", reference: "" }); calc(); };
      $("#ech").addEventListener("change", calc); $("#pay").addEventListener("change", calc);
      f.addEventListener("click", (e) => { const b = e.target.closest("[data-recu]"); if (b) recu(c, +b.dataset.recu, infoChantier(c)); });
      calc();
    }
    if ($("#releve")) $("#releve").onclick = () => G.exp.pdf(releveChantier(c));
    $("#et").addEventListener("change", calc); f.addEventListener("input", calc); f.addEventListener("change", calc); calc();
    $("#addE").onclick = () => { ed.add({ nom: "", avancement: 0, dateDebut: "", dateFin: "" }); calc(); const l = $$("#et .r"); const i = l.length && $("input", l[l.length - 1]); if (i) i.focus(); };
    if (etapeVisee != null && etapeVisee !== "") setTimeout(() => {
      const r = $$("#et .r")[+etapeVisee]; if (!r) return;
      r.scrollIntoView({ block: "center", behavior: "smooth" }); r.classList.add("is-flash");
      const i = $(etapes[+etapeVisee] && etapes[+etapeVisee].dateDebut ? 'input[data-k="avancement"]' : 'input[data-k="dateDebut"]', r); if (i) i.focus({ preventScroll: true });
      setTimeout(() => r.classList.remove("is-flash"), 2400);
    }, 300);
    const ok = () => U.valider(f, [["nom", (v) => (v.trim() ? "" : "Le nom du chantier est obligatoire.")]]);
    f.addEventListener("submit", (e) => {
      e.preventDefault(); if (!ok()) return;
      const v = Object.fromEntries(new FormData(f)), g = v.genre || genre0; delete v.genre;
      const part = g !== "programme", corps = { ...v, budget: num(v.budget), etapes: etapes.filter((x) => x.nom), photos, documents };
      if (argent()) Object.assign(corps, { nature: part ? "particulier" : "", travaux: part ? g : "construction", prix: num(v.prix), echeancier: ech.filter((x) => x.montant), paiements: pay.filter((x) => x.montant) });
      save("/api/g/chantiers", isNew ? null : c.id, corps, isNew ? (part ? "#g-chantiers/particuliers" : "#g-chantiers") : `#g-chantier/${c.id}`);
    });
    if ($("#del")) $("#del").onclick = () => supprimer("/api/g/chantiers", c.id, "ce chantier (les dépenses restent enregistrées)", retourListe);
  };

  // Chantier de particulier : informations pour le reçu et relevé client (PDF avec les photos)
  const encChantier = (c) => sum(c.paiements || [], (p) => p.montant);
  const infoChantier = (c) => ({ client: c.client, tel: c.clientTel, pour: `${c.travaux === "renovation" ? "Rénovation" : "Construction"} · ${c.nom}${c.lieu ? " · " + c.lieu : ""}`, prixLib: "Prix convenu des travaux", prix: c.prix || 0 });
  function releveChantier(c) {
    const p = encChantier(c);
    let cumul = 0;
    const echs = (c.echeancier || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((e) => { cumul += e.montant || 0; return [e.date, e.libelle, e.montant, cumul <= p ? "Payé" : cumul - (e.montant || 0) < p ? "Payé en partie" : e.date && e.date < today() ? "À régler" : "À venir"]; });
    const photos = (c.photos || []).filter((x) => x.src).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 9);
    return { fichier: `GEI_Releve-client_${G.exp.slug(c.nom)}`, titre: `Relevé client — ${c.nom}`, orientation: "portrait",
      filtres: [c.client ? "Client : " + c.client : "", c.clientTel ? "Tél. " + c.clientTel : "", c.travaux === "renovation" ? "Rénovation" : "Construction", c.lieu].filter(Boolean).join(" · "),
      chiffres: [{ l: "Prix convenu", v: c.prix || 0 }, { l: "Déjà versé", v: p }, { l: "Reste à payer", v: Math.max(0, (c.prix || 0) - p) }, { l: "Avancement des travaux", v: avancement(c), type: "pct" }],
      feuilles: [
        { nom: "Avancement", titre: "Avancement des travaux", colonnes: [{ t: "Étape" }, { t: "Réalisé", type: "pct" }, { t: "Fin prévue", type: "date" }], total: false, lignes: (c.etapes || []).map((e) => [e.nom, e.avancement || 0, e.dateFin || ""]) },
        { nom: "Échéancier", titre: "Tranches prévues", colonnes: [{ t: "Échéance", type: "date" }, { t: "Libellé" }, { t: "Montant", type: "montant" }, { t: "Statut" }], lignes: echs },
        { nom: "Versements", titre: "Versements reçus", colonnes: [{ t: "Date", type: "date" }, { t: "Montant", type: "montant" }, { t: "Mode" }, { t: "Référence / reçu" }], lignes: (c.paiements || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((x) => [x.date, x.montant, LIB.mode[x.mode] || "", x.reference]) },
      ],
      photos: photos.map((x) => ({ src: location.origin + img(x.src), date: x.date ? G.exp.dateFr(x.date) : "", legende: x.legende || "" })) };
  }
  G.particulier = { est: (c) => c && c.nature === "particulier", encaisse: encChantier, releve: releveChantier };

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
      G.exp.bouton() + '<a class="btn btn--primary" href="#g-maison/nouvelle">+ Nouvelle maison</a>') + `
      <section class="panel"><div class="filters">
        <label>Programme<select id="fprog"><option value="">Tous</option>${progs.map((p) => `<option${p === fp[0] ? " selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
        <label>Statut<select id="fst">${opts({ disponible: "Disponible", reservee: "Réservée", vendue: "Vendue", livree: "Livrée" }, fp[1], "Tous")}</select></label>
      </div>
      ${tableau(cols, list, (m) => `#g-maison/${m.id}`, ["Total", `${list.length} lots`, "", "", "", fcfa(sum(list, (m) => m.prix)), fcfa(sum(list, paye)), fcfa(sum(list, du)), ""])}</section>`;
    const go = () => { location.hash = `#g-maisons/${encodeURIComponent($("#fprog").value + "|" + $("#fst").value)}`; };
    $("#fprog").onchange = go; $("#fst").onchange = go;
    G.exp.brancher("xp", () => ({
      fichier: `GEI_Maisons-et-clients_${today()}${fp[0] ? "_" + G.exp.slug(fp[0]) : ""}`, titre: "Maisons et clients", orientation: "paysage",
      filtres: G.exp.filtres([["Programme", fp[0]], ["Statut", fp[1] ? LIB.statut[fp[1]] : ""]]),
      chiffres: [{ l: "Prix total", v: sum(list, (m) => m.prix), s: list.length + " lot(s)" }, { l: "Encaissé", v: sum(list, paye) }, { l: "Reste à encaisser", v: sum(list, du) }, { l: "En retard", v: sum(list, retard), bad: sum(list, retard) > 0 }],
      feuilles: [{ nom: "Maisons", colonnes: [{ t: "Programme / quartier" }, { t: "Lot" }, { t: "Type" }, { t: "Superficie" }, { t: "Statut" }, { t: "Client" }, { t: "Téléphone" }, { t: "Prix", type: "montant" }, { t: "Encaissé", type: "montant" }, { t: "Reste", type: "montant" }, { t: "En retard", type: "montant" }],
        lignes: list.map((m) => [m.programme, m.lot, m.type, m.superficie, LIB.statut[m.statut] || "", m.clientNom, m.clientTel, m.prix || "", paye(m), du(m), retard(m)]) }] }));
  };

  views["g-maison"] = async (mid) => {
    const isNew = mid === "nouvelle";
    const d = await load("maisons", "chantiers");
    const m = isNew ? { statut: "disponible", echeancier: [], paiements: [] } : d.maisons.find((x) => x.id === mid);
    if (!m) { main.innerHTML = '<p class="empty">Maison introuvable.</p>'; return; }
    const ech = (m.echeancier || []).map((x) => ({ ...x })), pay = (m.paiements || []).map((x) => ({ ...x })), documents = (m.documents || []).map((x) => ({ ...x }));
    const relance = !isNew && retard(m) > 0 && m.clientTel ? `<a class="btn btn--ghost" target="_blank" rel="noopener" href="https://wa.me/${waTel(m.clientTel)}?text=${encodeURIComponent(`Bonjour ${m.clientNom || ""},\n\nGlobal Empire Immobilier vous rappelle qu'un montant de ${fcfa(retard(m))} est arrivé à échéance pour votre maison (${m.programme}, lot ${m.lot}).\n\nMerci de nous contacter pour le règlement. Bonne journée.`)}">Relancer sur WhatsApp</a>` : "";
    const progs = [...new Set(d.maisons.map((x) => x.programme))].sort();
    main.innerHTML = head(isNew ? "Nouvelle maison" : `${esc(m.programme)} · lot ${esc(m.lot)}`, isNew ? "Ajoutez une maison (lot) d'un programme." : `${st(m.statut)} ${m.clientNom ? "· " + esc(m.clientNom) : ""}`, (isNew ? "" : G.exp.bouton("xpm")) + relance + '<a class="btn btn--text" href="#g-maisons">← Retour</a>') + `
      <form class="form" id="f" novalidate>
        <section class="panel"><h2>La maison</h2><div class="grid">
          <label><span>Programme ou quartier *</span><input name="programme" list="progs" value="${esc(m.programme || "")}" placeholder="Ex. Les Rives de l'Opulence, ou Cocody Angré pour une location"><datalist id="progs">${progs.map((p) => `<option value="${esc(p)}">`).join("")}</datalist></label>
          <label><span>Numéro du lot ou nom du bien *</span><input name="lot" value="${esc(m.lot || "")}" placeholder="Ex. A12, ou Villa 4 pièces"></label>
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
          <div class="kpis" id="bilan"></div>
          ${(m.paiements || []).length ? `<p class="muted" style="margin-top:12px">Reçus : ${m.paiements.map((p, i) => `<button type="button" class="btn btn--sm btn--ghost" data-recu="${i}">${dfr(p.date)} · ${fcfa(p.montant)}</button>`).join(" ")}</p>` : ""}</section>
        <section class="panel"><h2>Documents</h2><p class="muted">Contrat de réservation, attestation, pièces du client…</p><div id="docs"></div></section>
        <section class="panel"><label class="full"><span>Notes</span><textarea name="notes" rows="3">${esc(m.notes || "")}</textarea></label></section>
        <div class="savebar">${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}<button type="submit" class="btn btn--primary">${isNew ? "Créer" : "Enregistrer"}</button></div>
      </form>`;
    const f = $("#f");
    f.addEventListener("input", () => { G.setDirty(true); bilan(); });
    const e1 = rowsEditor($("#ech"), ech, [{ k: "date", ph: "Date", type: "date" }, { k: "libelle", ph: "Libellé (ex. apport initial)" }, { k: "montant", ph: "Montant", type: "money" }], "160px 2fr 160px auto");
    const e2 = rowsEditor($("#pay"), pay, [{ k: "date", ph: "Date", type: "date" }, { k: "montant", ph: "Montant", type: "money" }, { k: "mode", ph: "Mode", type: "select", map: LIB.mode }, { k: "reference", ph: "Référence / reçu" }], "160px 160px 160px 1fr auto");
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
    docsEditor($("#docs"), documents);
    f.addEventListener("click", (e) => { const i = e.target.dataset.recu; if (i != null) recu(m, +i); });
    if (!isNew) G.exp.brancher("xpm", () => {
      let cumul = 0; const p = paye(m);
      const echs = (m.echeancier || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((e) => { cumul += e.montant || 0; return [e.date, e.libelle, e.montant, cumul <= p ? "Payé" : cumul - (e.montant || 0) < p ? "Payé en partie" : e.date && e.date < today() ? "En retard" : "À venir"]; });
      return { fichier: `GEI_Releve-client_${G.exp.slug(m.programme)}_${G.exp.slug(m.lot)}`, titre: `Relevé client — ${m.programme}, lot ${m.lot}`, orientation: "portrait",
        filtres: [m.clientNom ? "Client : " + m.clientNom : "", m.clientTel ? "Tél. " + m.clientTel : "", m.type, LIB.statut[m.statut]].filter(Boolean).join(" · "),
        chiffres: [{ l: "Prix de vente", v: m.prix || 0 }, { l: "Déjà payé", v: p }, { l: "Reste à payer", v: du(m), bad: retard(m) > 0, s: retard(m) ? "dont en retard : " + G.ui.sep(retard(m)) + " FCFA" : "" }],
        feuilles: [
          { nom: "Échéancier", titre: "Échéancier", colonnes: [{ t: "Échéance", type: "date" }, { t: "Libellé" }, { t: "Montant", type: "montant" }, { t: "Statut" }], lignes: echs },
          { nom: "Paiements", titre: "Paiements reçus", colonnes: [{ t: "Date", type: "date" }, { t: "Montant", type: "montant" }, { t: "Mode" }, { t: "Référence / reçu" }], lignes: (m.paiements || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((x) => [x.date, x.montant, LIB.mode[x.mode] || "", x.reference]) },
        ] };
    });
    f.addEventListener("submit", (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(f)); save("/api/g/maisons", isNew ? null : m.id, { ...v, prix: num(v.prix), echeancier: ech, paiements: pay, documents }, isNew ? "#g-maisons" : `#g-maison/${m.id}`); });
    if ($("#del")) $("#del").onclick = () => supprimer("/api/g/maisons", m.id, "cette maison et son historique de paiements", "#g-maisons");
  };

  async function recu(m, i, info) {
    const p = (m.paiements || [])[i]; if (!p) return;
    const R = info || { client: m.clientNom, tel: m.clientTel, pour: `${m.programme} · lot ${m.lot}${m.type ? " · " + m.type : ""}`, prixLib: "Prix de la maison", prix: m.prix || 0 };
    const e = await api("/api/g/entreprise").catch(() => ({ nom: "Global Empire Immobilier SARL" }));
    const avant = sum(m.paiements.slice(0, i + 1), (x) => x.montant);
    const no = `R-${String(p.date || today()).slice(0, 7).replace("-", "")}-${m.id.slice(0, 4).toUpperCase()}-${i + 1}`;
    const w = open("", "_blank"); if (!w) return toast("Autorisez les fenêtres pour imprimer le reçu.", true);
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${no}</title><style>
      body{font-family:Poppins,Arial,sans-serif;color:#131735;margin:0;padding:30px}.r{max-width:720px;margin:auto;border:2px solid #0B1A6E;border-radius:14px;padding:28px}
      header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;border-bottom:2px solid #eef0f6;padding-bottom:14px}header img{width:64px}
      h1{margin:0;font-size:22px;color:#0B1A6E}small{color:#555a74}table{width:100%;border-collapse:collapse;margin:18px 0}td{padding:8px 4px;border-bottom:1px solid #eef0f6}td:first-child{color:#555a74;width:42%}
      .big{font-size:26px;font-weight:700;color:#0B1A6E}.sign{display:flex;justify-content:space-between;margin-top:46px}.sign div{width:45%;border-top:1px solid #131735;padding-top:6px;text-align:center;font-size:13px}
      @media print{button{display:none}body{padding:0}}</style></head><body><div class="r">
      <header><div><img src="${location.origin}/logo-gei.png" alt=""><div><b>${esc(e.nom)}</b><br><small>${esc(e.adresse || "")}<br>${esc((e.telephones || []).join(" · "))} ${e.email ? "· " + esc(e.email) : ""}</small></div></div>
      <div style="text-align:right"><h1>REÇU DE PAIEMENT</h1><small>N° ${no}<br>Date : ${dfr(p.date)}</small></div></header>
      <table><tr><td>Reçu de</td><td><b>${esc(R.client || "—")}</b>${R.tel ? " · " + esc(R.tel) : ""}</td></tr>
      <tr><td>Pour</td><td>${esc(R.pour)}</td></tr>
      <tr><td>Montant reçu</td><td class="big">${fcfa(p.montant)}</td></tr><tr><td>En lettres</td><td>${esc(enLettres(p.montant))} francs CFA</td></tr>
      <tr><td>Mode de paiement</td><td>${esc(LIB.mode[p.mode] || p.mode)}${p.reference ? " · réf. " + esc(p.reference) : ""}</td></tr>
      <tr><td>${esc(R.prixLib)}</td><td>${fcfa(R.prix)}</td></tr><tr><td>Total versé à ce jour</td><td>${fcfa(avant)}</td></tr><tr><td>Reste à payer</td><td><b>${fcfa(Math.max(0, R.prix - avant))}</b></td></tr></table>
      <div class="sign"><div>Le client</div><div>Pour ${esc(e.nom)}</div></div></div>
      <p style="text-align:center;margin-top:18px"><button onclick="print()" style="padding:10px 22px;font-size:15px;border-radius:999px;border:0;background:#0B1A6E;color:#fff;cursor:pointer">Imprimer / enregistrer en PDF</button></p></body></html>`);
    w.document.close();
  }

  /* ================= Dépenses ================= */
  views["g-depenses"] = async (filtre) => {
    const d = await load("depenses", "chantiers", "villas");
    const [fc = "", fcat = "", fm = "", fst = ""] = (filtre || "").split("|");
    const base = d.depenses.filter((x) => (!fc || x.chantierId === fc) && (!fcat || x.categorie === fcat) && (!fm || mois(x.date) === fm)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.creeLe || "").localeCompare(String(a.creeLe || "")));
    const moisDispo = [...new Set(d.depenses.map((x) => mois(x.date)))].filter(Boolean).sort().reverse();
    const n = (k) => base.filter((x) => statutDep(x)[2] === k).length;
    const lien = (st2) => `#g-depenses/${encodeURIComponent([fc, fcat, fm, st2].join("|"))}`;
    const chips = [["", "Tous", base.length], ["paye", "Payé", n("paye")], ["partiel", "Partiel", n("partiel")], ["impaye", "Impayé", n("impaye")], ["sansprix", "Prix à compléter", n("sansprix")]];
    const cols = [["Date", (x) => `<span class="num">${U.dateFr(x.date)}</span>`], ["Désignation", (x) => `<b>${esc(x.libelle)}</b>${x.quantite || x.fournisseur ? `<br><span class="muted">${esc([x.quantite, x.fournisseur].filter(Boolean).join(" · "))}</span>` : ""}`],
      ["Chantier", (x) => esc(nomChantier(d.chantiers, x.chantierId))], ["Catégorie", (x) => esc(LIB.categorie[x.categorie])],
      ["Montant", (x) => (x.montant ? U.sep(x.montant) : "—"), 1], ["Payé", (x) => U.sep(verseDep(x)), 1], ["Reste", (x) => (resteDep(x) ? `<b>${U.sep(resteDep(x))}</b>` : "0"), 1], ["Statut", badgeDep]];
    main.innerHTML = head("Dépenses", "Achats, main-d'œuvre, transport, location… avec les avances versées et le reste à payer.",
      `${G.exp.bouton()}<a class="btn btn--primary" href="#g-depense/nouvelle">${I("plus")}Nouvelle dépense</a>`, [["Finances", "#g-depenses"], ["Dépenses", ""]]) + `
      <div class="kpis">
        <div class="kpi"><small>Montant total</small><b>${U.money(sum(base, (x) => x.montant))}</b><span>${base.length} dépense(s)</span></div>
        <div class="kpi"><small>Déjà payé</small><b>${U.money(sum(base, verseDep))}</b><span>avances et soldes</span></div>
        <div class="kpi kpi--alert"><small>Reste à payer</small><b>${U.money(sum(base, resteDep))}</b><span>${n("impaye") + n("partiel")} à régler</span></div>
      </div>
      <section class="panel">
        <div class="chips" role="group" aria-label="Statut">${chips.map(([k, l, c]) => `<a class="chip${k === fst ? " is-on" : ""}" href="${lien(k)}">${l} <b>${c}</b></a>`).join("")}</div>
        <div class="filters">
          <label>Chantier<select id="fc">${chantierOpts(d.chantiers, fc, "Tous les chantiers")}</select></label>
          <label>Catégorie<select id="fcat">${opts(LIB.categorie, fcat, "Toutes")}</select></label>
          <label>Mois<select id="fm"><option value="">Tous</option>${moisDispo.map((mm) => `<option value="${mm}"${mm === fm ? " selected" : ""}>${new Date(mm + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</option>`).join("")}</select></label>
          <label>Rechercher<div class="ig">${I("search")}<input type="search" id="q" placeholder="Désignation, fournisseur…"></div></label>
        </div>
        <div id="tbl"></div>
      </section>`;
    const draw = () => {
      const q = ($("#q").value || "").trim().toLowerCase();
      const list = base.filter((x) => (!fst || statutDep(x)[2] === fst) && (!q || [x.libelle, x.fournisseur, x.quantite, nomChantier(d.chantiers, x.chantierId)].join(" ").toLowerCase().includes(q)));
      $("#tbl").innerHTML = list.length || !(q || fst) ? tableau(cols, list, (x) => `#g-depense/${x.id}`, ["Total", `${list.length} dépense(s)`, "", "", U.sep(sum(list, (x) => x.montant)), U.sep(sum(list, verseDep)), U.sep(sum(list, resteDep)), ""])
        : U.vide("Aucune dépense ne correspond à ces filtres.", "filter");
      $("#tbl").dataset.list = "";
      draw.list = list;
    };
    draw();
    let tq; $("#q").addEventListener("input", () => { clearTimeout(tq); tq = setTimeout(draw, 150); });
    const go = () => { location.hash = `#g-depenses/${encodeURIComponent([$("#fc").value, $("#fcat").value, $("#fm").value, fst].join("|"))}`; };
    ["#fc", "#fcat", "#fm"].forEach((s) => { $(s).onchange = go; });
    G.exp.brancher("xp", () => {
      const list = draw.list, q = ($("#q").value || "").trim();
      const villa = (id) => { const v = (d.villas || []).find((y) => y.id === id); return v ? "Villa " + v.lot : ""; };
      const nomC = fc ? nomChantier(d.chantiers, fc) : "";
      return { fichier: `GEI_Depenses_${fm || G.exp.auj().slice(0, 7)}${fc ? "_" + G.exp.slug(nomC) : ""}`, titre: "Dépenses", orientation: "paysage",
        filtres: G.exp.filtres([["Chantier", nomC], ["Catégorie", fcat ? LIB.categorie[fcat] : ""], ["Mois", fm ? G.exp.moisFr(fm) : ""], ["Statut", fst ? (chips.find((c) => c[0] === fst) || [])[1] : ""], ["Recherche", q ? "« " + q + " »" : ""]]),
        chiffres: [{ l: "Total dépensé", v: sum(list, (x) => x.montant), s: list.length + " dépense(s)" }, { l: "Déjà payé", v: sum(list, verseDep) }, { l: "Reste à payer", v: sum(list, resteDep), bad: sum(list, resteDep) > 0 }],
        feuilles: [{ nom: "Dépenses", colonnes: [{ t: "Date", type: "date" }, { t: "Chantier" }, { t: "Villa" }, { t: "Catégorie" }, { t: "Désignation" }, { t: "Fournisseur" }, { t: "Quantité" }, { t: "Mode" }, { t: "Montant", type: "montant" }, { t: "Payé", type: "montant" }, { t: "Reste", type: "montant" }, { t: "Statut" }],
          lignes: list.map((x) => [x.date, nomChantier(d.chantiers, x.chantierId), villa(x.villaId), LIB.categorie[x.categorie] || "", x.libelle, x.fournisseur, x.qte ? `${x.qte} ${x.unite || ""}`.trim() : x.quantite, LIB.mode[x.mode] || "", x.montant, verseDep(x), resteDep(x), statutDep(x)[1]]) }] };
    });
  };

  views["g-depense"] = async (arg) => {
    const [did, cid, vid] = String(arg || "").split("/");
    const isNew = did === "nouvelle";
    const d = await load("depenses", "chantiers", "villas", "articles");
    const x = isNew ? { date: today(), chantierId: cid || "", villaId: vid || "", categorie: "materiaux", mode: "especes", paiements: [] } : d.depenses.find((y) => y.id === did);
    if (!x) { main.innerHTML = U.vide("Dépense introuvable.", "receipt"); return; }
    const fours = [...new Set(d.depenses.map((y) => y.fournisseur).filter(Boolean))].sort();
    const documents = (x.documents || []).map((y) => ({ ...y }));
    const pay = (Array.isArray(x.paiements) ? x.paiements : verseDep(x) ? [{ date: x.date, montant: x.montant, mode: x.mode }] : []).map((y) => ({ ...y }));
    const retour = x.chantierId ? `#g-depenses/${encodeURIComponent(x.chantierId + "|||")}` : "#g-depenses";
    main.innerHTML = head(isNew ? "Nouvelle dépense" : esc(x.libelle), isNew ? "Saisissez l'achat ou le frais, puis les avances versées." : `${U.dateFr(x.date)} · ${badgeDep(x)}`,
      `<a class="btn btn--tertiary" href="${retour}">${I("chevleft")}Retour</a>`, [["Dépenses", "#g-depenses"], [isNew ? "Nouvelle dépense" : esc(x.libelle), ""]]) + `
      <form class="form form--split" id="f" novalidate>
        <div class="form__main">
          <section class="panel"><div class="sec__head"><span class="sec__n">1</span><div><h2>Informations générales</h2><p>Quoi, quand, pour quel chantier.</p></div></div>
            <div class="grid">
              <label class="full"><span>Désignation <i class="req">*</i></span><input name="libelle" value="${esc(x.libelle || "")}" placeholder="Ex. Xavier, maçon – main-d'œuvre" autocomplete="off"></label>
              <label><span>Date <i class="req">*</i></span><input type="date" name="date" value="${esc(x.date || "")}"></label>
              <label><span>Chantier</span><select name="chantierId">${chantierOpts(d.chantiers, x.chantierId)}</select></label>
              <label><span>Catégorie</span><select name="categorie">${opts(LIB.categorie, x.categorie)}</select></label>
              <label><span>Fournisseur / artisan</span><input name="fournisseur" list="fours" value="${esc(x.fournisseur || "")}" placeholder="Rechercher ou saisir un nom"><datalist id="fours">${fours.map((y) => `<option value="${esc(y)}">`).join("")}</datalist></label>
              ${G.depenseMat ? G.depenseMat.champs(x, d) : ""}
              <label class="full"><span>Quantité / détail ${G.depenseMat ? '<small class="muted">(texte libre, facultatif)</small>' : ""}</span><input name="quantite" value="${esc(x.quantite || "")}" placeholder="Ex. 3 tonnes, 300 briques, 4 maisons"></label>
            </div></section>
          <section class="panel"><div class="sec__head"><span class="sec__n">2</span><div><h2>Montant et paiements</h2><p>Le montant total, puis chaque avance versée.</p></div></div>
            <div class="grid"><label><span>Montant total</span><input name="montant" class="money" inputmode="numeric" value="${x.montant || ""}" placeholder="Vide si le prix n'est pas connu"></label>
              <input type="hidden" name="mode" value="${esc(x.mode || "especes")}"></div>
            <div style="margin-top:20px"><span class="lbl" style="margin-bottom:8px">Paiements (avance, puis solde)</span>
              <div class="pay-tbl"><div class="r r--head" style="--cols:minmax(130px,1fr) minmax(130px,1fr) minmax(130px,1fr) 36px"><span>Date</span><span>Montant payé</span><span>Mode</span><span></span></div><div class="rows" id="pay"></div></div>
              <div class="pay-actions"><button type="button" class="btn btn--secondary btn--sm" id="addPay">${I("plus")}Ajouter une avance</button><button type="button" class="btn btn--tertiary btn--sm" id="solde">${I("check")}Payer le reste</button></div>
              <div class="pay-prog"><div><span>Progression du paiement</span><b id="kPct">0 %</b></div><div class="progress"><i id="kBar" style="width:0%"></i></div></div></div>
          </section>
          <section class="panel"><div class="sec__head"><span class="sec__n">3</span><div><h2>Notes et justificatifs</h2><p>Précisions, facture ou reçu du fournisseur.</p></div></div>
            <label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Ex. reste à payer après la livraison du fer">${esc(x.notes || "")}</textarea></label>
            <div style="margin-top:16px"><span class="lbl" style="margin-bottom:8px">Facture / reçu</span><div id="docs"></div></div>
          </section>
        </div>
        <aside class="form__side">
          <section class="panel recap" aria-live="polite">
            <div class="recap__top"><span class="t-micro">Récapitulatif</span><span id="kSt"></span></div>
            <div class="recap__total" id="kTot"></div>
            <div class="recap__lines"><div class="is-ok"><span>Déjà payé</span><b id="kVerse"></b></div><div id="kResteL"><span>Reste à payer</span><b id="kReste"></b></div><div><span>Paiements</span><b id="kNb"></b></div></div>
            <div class="progress"><i id="kBar2" style="width:0%"></i></div>
            ${isNew ? "" : `<p class="recap__meta">Saisie par ${esc(x.creePar || "?")}${x.modifiePar ? `, modifiée par ${esc(x.modifiePar)}` : ""}.</p>`}
          </section>
          <div class="tip">${I("alertcircle")}<span>Payez en plusieurs fois : ajoutez une ligne par avance. Le reste à payer se met à jour tout seul.</span></div>
        </aside>
        <div class="savebar">${isNew ? "" : `<button type="button" class="btn btn--danger" id="del">${I("trash")}Supprimer</button>`}${isNew ? '<button type="button" class="btn btn--secondary" id="encore">Enregistrer et en saisir une autre</button>' : ""}<button type="submit" class="btn btn--primary">${I("check")}Enregistrer</button></div>
      </form>`;
    const f = $("#f");
    f.addEventListener("input", () => G.setDirty(true));
    docsEditor($("#docs"), documents);
    const ep = rowsEditor($("#pay"), pay, [{ k: "date", ph: "Date", type: "date" }, { k: "montant", ph: "Montant", type: "money" }, { k: "mode", ph: "Mode", type: "select", map: LIB.mode }], "minmax(130px,1fr) minmax(130px,1fr) minmax(130px,1fr) 36px");
    const calc = () => {
      const total = num(f.montant.value), v = sum(pay, (p) => p.montant), r = Math.max(0, total - v), pc = total ? Math.min(100, Math.round(v / total * 100)) : 0;
      const tmp = { montant: total, paiements: pay };
      $("#kTot").innerHTML = total ? U.money(total) : '<span class="t-help" style="font:400 15px var(--font-ui)">Prix à compléter</span>';
      $("#kVerse").innerHTML = U.money(v); $("#kReste").innerHTML = total ? U.money(r) : "—"; $("#kNb").textContent = pay.filter((p) => num(p.montant)).length;
      $("#kResteL").className = r ? "is-bad" : "";
      $("#kSt").innerHTML = badgeDep(tmp); $("#kPct").textContent = pc + " %";
      [$("#kBar"), $("#kBar2")].forEach((b) => { b.style.width = pc + "%"; });
    };
    $("#pay").addEventListener("change", calc); f.montant.addEventListener("input", calc); calc();
    $("#addPay").onclick = () => { ep.add({ date: today(), montant: "", mode: "especes" }); calc(); const l = $$("#pay .r"); const i = l.length && $("input.money", l[l.length - 1]); if (i) i.focus(); };
    $("#solde").onclick = () => { const r = num(f.montant.value) - sum(pay, (p) => p.montant); if (r > 0) { ep.add({ date: today(), montant: r, mode: "especes" }); calc(); toast("Solde ajouté : pensez à enregistrer"); } else toast(num(f.montant.value) ? "Tout est déjà payé." : "Indiquez d'abord le montant total."); };
    const body = () => { const v = Object.fromEntries(new FormData(f)); return { ...v, montant: num(v.montant), paiements: pay.filter((p) => num(p.montant)), documents }; };
    const ok = () => U.valider(f, [
      ["libelle", (v) => (v.trim() ? "" : "La désignation est obligatoire.")],
      ["date", (v) => (v ? "" : "Indiquez la date de la dépense.")],
      ["montant", (v) => { const t = num(v), p = sum(pay, (y) => y.montant); return t && p > t ? `Les paiements (${fcfa(p)}) dépassent le montant total.` : ""; }],
    ]);
    // Matériau, quantité, destination (volet Construction) : complétés juste avant l'enregistrement
    if (G.depenseMat) G.depenseMat.brancher(f, d);
    const corps = async () => (G.depenseMat ? G.depenseMat.completer(body(), d) : body());
    f.addEventListener("submit", async (e) => { e.preventDefault(); if (!ok()) return; let b; try { b = await corps(); } catch (err) { return fail(err); } save("/api/g/depenses", isNew ? null : x.id, b, x.chantierId || b.chantierId ? `#g-depenses/${encodeURIComponent(b.chantierId + "|||")}` : "#g-depenses"); });
    if ($("#encore")) $("#encore").onclick = async () => { if (!ok()) return; try { await api("/api/g/depenses", { method: "POST", body: await corps() }); G.setDirty(false); toast("Dépense enregistrée. Saisissez la suivante."); f.libelle.value = ""; f.montant.value = ""; f.quantite.value = ""; if (f.materiau) f.materiau.value = ""; if (f.qte) f.qte.value = ""; f.notes.value = ""; documents.length = 0; docsEditor($("#docs"), documents); pay.length = 0; ep.draw(); calc(); f.libelle.focus(); scrollTo({ top: 0, behavior: "smooth" }); } catch (err) { fail(err); } };
    if ($("#del")) $("#del").onclick = () => supprimer("/api/g/depenses", x.id, "cette dépense", "#g-depenses");
  };

  /* ================= Équipes et paie ================= */
  const lundi = (d) => { const x = new Date((d || today()) + "T12:00:00"); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
  const plusJours = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  views["g-equipes"] = async (arg) => {
    const [onglet = "ouvriers", p1 = "", p2 = ""] = String(arg || "").split("/");
    const d = await load("ouvriers", "pointages", "chantiers");
    if (!argent() && onglet !== "pointage") { location.replace("#g-equipes/pointage"); return; }
    const nouvelOuvrier = '<a class="btn btn--primary" href="#g-ouvrier/nouveau">+ Nouvel ouvrier</a>';
    const tabs = `<nav class="tabs-g">${(argent() ? [["ouvriers", "Ouvriers"], ["pointage", "Pointage du jour"], ["paie", "Paie de la semaine"]] : [["pointage", "Pointage du jour"]]).map(([k, l]) => `<a href="#g-equipes/${k}" class="${k === onglet ? "is-on" : ""}">${l}</a>`).join("")}</nav>`;
    if (onglet === "ouvriers") {
      const cols = [["Nom", (o) => `<b>${esc(o.nom)}</b>${o.actif ? "" : ' <span class="st">inactif</span>'}`], ["Métier", (o) => esc(o.metier || "—")], ["Téléphone", (o) => esc(o.tel || "—")], ["Chantier", (o) => esc(nomChantier(d.chantiers, o.chantierId))], ["Tarif / jour", (o) => fcfa(o.tarifJour), 1]];
      main.innerHTML = head("Équipes et paie", "Ouvriers, présence sur les chantiers et paie de la semaine.", G.exp.bouton() + nouvelOuvrier) + tabs +
        `<section class="panel">${tableau(cols, d.ouvriers.slice().sort((a, b) => (b.actif - a.actif) || a.nom.localeCompare(b.nom)), (o) => `#g-ouvrier/${o.id}`)}</section>`;
      G.exp.brancher("xp", () => ({ fichier: `GEI_Ouvriers_${today()}`, titre: "Liste des ouvriers", filtres: `${d.ouvriers.filter((o) => o.actif).length} ouvrier(s) en activité sur ${d.ouvriers.length}`, orientation: "portrait",
        feuilles: [{ nom: "Ouvriers", colonnes: [{ t: "Nom et prénoms" }, { t: "Métier" }, { t: "Téléphone" }, { t: "Chantier habituel" }, { t: "Tarif / jour", type: "montant", total: false }, { t: "Actif" }],
          lignes: d.ouvriers.slice().sort((a, b) => (b.actif - a.actif) || a.nom.localeCompare(b.nom)).map((o) => [o.nom, o.metier, o.tel, nomChantier(d.chantiers, o.chantierId), o.tarifJour || "", o.actif ? "Oui" : "Non"]) }] }));
      return;
    }
    if (onglet === "pointage") {
      const date = p1 || today(), cid = p2 || (d.chantiers.find((c) => c.statut === "en_cours") || d.chantiers[0] || {}).id || "";
      const exist = d.pointages.find((p) => p.date === date && p.chantierId === cid);
      const presents = new Set(exist ? exist.presents : []);
      const liste = d.ouvriers.filter((o) => o.actif || presents.has(o.id)).sort((a, b) => ((b.chantierId === cid) - (a.chantierId === cid)) || a.nom.localeCompare(b.nom));
      main.innerHTML = head("Équipes et paie", "Cochez les ouvriers présents sur le chantier ce jour-là.", argent() ? nouvelOuvrier : "") + tabs + `
        <section class="panel"><div class="filters">
          <label>Date<input type="date" id="pd" value="${date}"></label>
          <label>Chantier<select id="pc">${d.chantiers.map((c) => `<option value="${c.id}"${c.id === cid ? " selected" : ""}>${esc(c.nom)}</option>`).join("")}</select></label>
        </div>
        ${d.chantiers.length ? (liste.length ? `<div class="checks" id="pl">${liste.map((o) => `<label><input type="checkbox" value="${o.id}"${presents.has(o.id) ? " checked" : ""}> ${esc(o.nom)} <span class="muted">${esc(o.metier || "")}${o.chantierId && o.chantierId !== cid ? " · autre chantier" : ""}</span></label>`).join("")}</div>
          <p class="muted" id="ptot"></p><div class="savebar"><button class="btn btn--primary" id="psave">Enregistrer le pointage</button></div>` : `<p class="empty">Aucun ouvrier enregistré pour l'instant.</p>${argent() ? `<p style="text-align:center">${nouvelOuvrier}</p>` : ""}`) : '<p class="empty">Créez d\'abord un chantier.</p>'}</section>`;
      const goP = () => { location.hash = `#g-equipes/pointage/${$("#pd").value}/${$("#pc").value}`; };
      if ($("#pd")) { $("#pd").onchange = goP; $("#pc").onchange = goP; }
      const tot = () => { const ids = $$("#pl input:checked").map((i) => i.value); const t = sum(ids, (id) => (d.ouvriers.find((o) => o.id === id) || {}).tarifJour); if ($("#ptot")) $("#ptot").innerHTML = `${ids.length} présent(s)` + (argent() ? ` · coût de la journée : <b>${fcfa(t)}</b>` : ""); };
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
    const mvts = await api("/api/g/mouvements");
    const dejaPaye = mvts.find((x) => x.reference === `paie-${deb}`);
    const totalPaie = sum(lignes, (l) => l.montant);
    main.innerHTML = head("Équipes et paie", `Semaine du ${dfr(deb)} au ${dfr(fin)}.`, G.exp.bouton() + nouvelOuvrier +
      (totalPaie ? (dejaPaye ? `<span class="st st--termine">Paie enregistrée dans la trésorerie</span>` : '<button class="btn btn--primary" id="payer">Paie versée : l\'enregistrer dans la caisse</button>') : "")) + tabs + `
      <section class="panel"><div class="filters">
        <a class="btn btn--sm btn--ghost" href="#g-equipes/paie/${plusJours(deb, -7)}">← Semaine précédente</a>
        <label>Semaine du<input type="date" id="sw" value="${deb}"></label>
        <a class="btn btn--sm btn--ghost" href="#g-equipes/paie/${plusJours(deb, 7)}">Semaine suivante →</a>
      </div>
      ${tableau([["Ouvrier", (l) => `<b>${esc(l.o.nom)}</b> <span class="muted">${esc(l.o.metier || "")}</span>`], ["Chantier(s)", (l) => esc(l.chantiers)], ["Jours", (l) => l.jours, 1], ["Tarif / jour", (l) => fcfa(l.o.tarifJour), 1], ["À payer", (l) => `<b>${fcfa(l.montant)}</b>`, 1]],
        lignes, null, ["Total", "", sum(lignes, (l) => l.jours), "", fcfa(sum(lignes, (l) => l.montant))])}</section>`;
    $("#sw").onchange = () => { location.hash = `#g-equipes/paie/${$("#sw").value}`; };
    if ($("#payer")) $("#payer").onclick = async () => {
      if (!confirm(`Enregistrer une sortie de caisse de ${fcfa(totalPaie)} pour la paie de cette semaine ?`)) return;
      try { await api("/api/g/mouvements", { method: "POST", body: { date: fin > today() ? today() : fin, sens: "sortie", compte: "caisse", categorie: "salaires", libelle: `Paie des ouvriers · semaine du ${dfr(deb)}`, montant: totalPaie, reference: `paie-${deb}` } }); toast("Paie enregistrée dans la trésorerie"); views["g-equipes"](`paie/${deb}`); } catch (err) { fail(err); }
    };
    G.exp.brancher("xp", () => ({ fichier: `GEI_Paie_semaine-${deb}`, titre: "État de paie de la semaine", filtres: `Semaine du ${dfr(deb)} au ${dfr(fin)}${dejaPaye ? " · paie enregistrée dans la trésorerie" : ""}`, orientation: "portrait",
      chiffres: [{ l: "Total à payer", v: totalPaie }, { l: "Journées travaillées", v: sum(lignes, (l) => l.jours), type: "nombre" }, { l: "Ouvriers payés", v: lignes.length, type: "nombre" }],
      note: "Chaque ouvrier signe dans la colonne « Émargement » à la remise de sa paie.",
      feuilles: [{ nom: "Paie", emargement: true, colonnes: [{ t: "Ouvrier" }, { t: "Métier" }, { t: "Chantier(s)" }, { t: "Jours", type: "nombre", total: true }, { t: "Tarif / jour", type: "montant", total: false }, { t: "À payer", type: "montant" }],
        lignes: lignes.map((l) => [l.o.nom, l.o.metier, l.chantiers, l.jours, l.o.tarifJour || 0, l.montant]) }] }));
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
