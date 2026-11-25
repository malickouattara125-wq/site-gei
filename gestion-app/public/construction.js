/* GEI Gestion — volet Construction : Chantiers → Programme → Villa → Phases.
   Étape 2 : accueil « Chantiers » en grandes cartes (3 chiffres, une carte par programme, recherche). */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G) return;
  const { api, esc, views, main, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a);
  const today = () => new Date().toISOString().slice(0, 10);
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const argent = () => G.me().role !== "chef";
  const court = (n) => { const a = Math.abs(n), s = n < 0 ? "−" : ""; return a >= 1e6 ? `${s}${(a / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M` : a >= 1e3 ? `${s}${Math.round(a / 1e3)} k` : `${s}${Math.round(a)}`; };
  const STATUT_PROG = { preparation: "En préparation", en_cours: "En cours", pause: "En pause", termine: "Terminé" };

  /* ---------- Calculs partagés (villas et programmes) ---------- */
  // Phases prises en compte : une villa « gros œuvre » n'a que les 5 phases de gros œuvre
  const phasesUtiles = (v) => (v.phases || []).filter((p) => v.niveau !== "gros_oeuvre" || p.bloc === "gros");
  const avancementVilla = (v) => { const ph = phasesUtiles(v); return ph.length ? Math.round(sum(ph, (p) => p.avancement) / ph.length) : 0; };
  const phaseEnCours = (v) => { const p = phasesUtiles(v).find((x) => (x.avancement || 0) < 100); return p ? p.nom : "Terminée"; };
  const enRetardVilla = (v) => phasesUtiles(v).some((p) => p.dateFin && p.dateFin < today() && (p.avancement || 0) < 100);
  // État d'une villa : à démarrer (gris), en cours (vert clair), terminée (vert foncé), en retard (rouge brique)
  const etatVilla = (v) => { const a = avancementVilla(v); return a >= 100 ? "terminee" : enRetardVilla(v) ? "retard" : a > 0 ? "encours" : "demarrer"; };
  const ETATS = { demarrer: "À démarrer", encours: "En cours", terminee: "Terminée", retard: "En retard" };
  // Avancement d'un programme : moyenne de ses villas, sinon de ses étapes (programmes d'avant le volet Construction)
  const avancementProgramme = (c, villas) => { const vs = villas.filter((v) => v.chantierId === c.id); return vs.length ? Math.round(sum(vs, avancementVilla) / vs.length) : G.calc.avancement(c); };
  const photosProgramme = (c, villas) => [...(c.photos || []), ...villas.filter((v) => v.chantierId === c.id).flatMap((v) => (v.phases || []).flatMap((p) => p.photos || []))]
    .filter((p) => p && p.src).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  function alertesProgramme(c, d) {
    const out = [];
    const vs = d.villas.filter((v) => v.chantierId === c.id);
    const nbRetard = vs.filter(enRetardVilla).length + (c.etapes || []).filter((e) => e.dateFin && e.dateFin < today() && (e.avancement || 0) < 100).length;
    if (nbRetard) out.push(`${nbRetard} retard(s)`);
    if (argent() && c.budget && G.calc.depenseChantier(c, d) > c.budget) out.push("budget dépassé");
    // Stock bas : seulement pour les articles qui ont des mouvements sur ce programme
    const parArticle = {};
    (d.stock || []).filter((s) => s.chantierId === c.id).forEach((s) => { parArticle[s.articleId] = (parArticle[s.articleId] || 0) + (s.sens === "entree" ? s.quantite : -s.quantite); });
    const bas = (d.articles || []).filter((a) => a.seuil && a.id in parArticle && parArticle[a.id] <= a.seuil);
    if (bas.length) out.push(`stock bas : ${bas.map((a) => a.nom).join(", ")}`);
    return out;
  }
  G.construction = { phasesUtiles, avancementVilla, phaseEnCours, enRetardVilla, etatVilla, ETATS, avancementProgramme, photosProgramme, alertesProgramme };

  /* ---------- Accueil « Chantiers » ---------- */
  views["g-chantiers"] = async () => {
    const noms = argent() ? ["chantiers", "villas", "depenses", "ouvriers", "pointages", "articles", "stock"] : ["chantiers", "villas", "ouvriers", "pointages", "articles", "stock"];
    const d = Object.fromEntries(await Promise.all(noms.map(async (n) => [n, await api("/api/g/" + n).catch(() => [])])));
    if (!d.depenses) d.depenses = [];
    const progs = d.chantiers.slice().sort((a, b) => (a.statut === "termine") - (b.statut === "termine") || (b.statut === "en_cours") - (a.statut === "en_cours") || String(a.nom).localeCompare(String(b.nom)));
    const enCours = progs.filter((c) => c.statut === "en_cours"), actifs = progs.filter((c) => c.statut !== "termine");
    const moy = actifs.length ? Math.round(sum(actifs, (c) => avancementProgramme(c, d.villas)) / actifs.length) : 0;
    const m = today().slice(0, 7);
    const depMois = sum(d.depenses.filter((x) => String(x.date || "").slice(0, 7) === m), (x) => x.montant) + G.calc.paieDe(d.pointages, d.ouvriers, (p) => String(p.date || "").slice(0, 7) === m);
    const villasActives = d.villas.filter((v) => actifs.some((c) => c.id === v.chantierId));
    const chiffre3 = argent()
      ? `<div class="kpi"><small>Dépensé ce mois</small><b>${U.money(depMois)}</b><span>${new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span></div>`
      : `<div class="kpi"><small>Villas terminées</small><b>${villasActives.filter((v) => etatVilla(v) === "terminee").length}</b><span>sur ${villasActives.length} villa(s)</span></div>`;
    main.innerHTML = U.head("Chantiers", argent() ? "Tous les programmes de construction. Cliquez sur une carte pour voir ses villas." : "Vos programmes : cliquez sur une carte pour mettre à jour l'avancement.",
      (argent() ? `<details class="menu-p"><summary class="btn btn--tertiary btn--icon" aria-label="Autres actions" title="Autres actions">${I("more")}</summary><div class="menu-p__pop"><button type="button" id="xp">${I("download")}Exporter (Excel)</button></div></details><a class="btn btn--primary" href="#g-chantier/nouveau">${I("plus")}Nouveau programme</a>` :
        `<details class="menu-p"><summary class="btn btn--tertiary btn--icon" aria-label="Autres actions" title="Autres actions">${I("more")}</summary><div class="menu-p__pop"><button type="button" id="xp">${I("download")}Exporter (Excel)</button></div></details>`), [["Opérations", "#g-chantiers"], ["Chantiers", ""]]) + `
      <div class="kpis kpis--3">
        <div class="kpi"><small>Programmes en cours</small><b>${enCours.length}</b><span>${villasActives.length} villa(s) au total</span></div>
        <div class="kpi"><small>Avancement moyen</small><b>${moy} %</b><div class="progress"><i style="width:${moy}%"></i></div></div>
        ${chiffre3}
      </div>
      ${progs.length > 3 ? `<div class="prog-search"><label class="ig"><span class="ig__prefix">${I("search")}</span><input type="search" id="q" placeholder="Rechercher un programme ou un lieu" aria-label="Rechercher un programme"></label></div>` : ""}
      ${progs.length ? `<div class="prog-grid" id="pg">${progs.map((c) => carte(c, d)).join("")}</div><p class="muted prog-none" id="pn" hidden>Aucun programme ne correspond à la recherche.</p>`
        : U.vide(argent() ? "Aucun programme pour le moment. Cliquez sur « Nouveau programme » pour commencer." : "Aucun programme pour le moment.", "hardhat")}`;
    if ($("#q")) $("#q").addEventListener("input", (e) => {
      const s = e.target.value.trim().toLowerCase(); let n = 0;
      $$("#pg .prog").forEach((el) => { const ok = !s || el.dataset.q.includes(s); el.hidden = !ok; n += ok; });
      $("#pn").hidden = !!n;
    });
    $("#xp").onclick = () => G.calc.exporter("programmes", [["Programme", (c) => c.nom], ["Lieu", (c) => c.lieu], ["Statut", (c) => STATUT_PROG[c.statut] || c.statut], ["Avancement %", (c) => avancementProgramme(c, d.villas)],
      ["Villas", (c) => d.villas.filter((v) => v.chantierId === c.id).length], ["Début", (c) => c.dateDebut], ["Livraison prévue", (c) => c.dateFin]].concat(argent() ? [["Budget", (c) => c.budget], ["Dépensé", (c) => G.calc.depenseChantier(c, d)]] : []), progs);
  };

  function carte(c, d) {
    const vs = d.villas.filter((v) => v.chantierId === c.id), av = avancementProgramme(c, d.villas);
    const ph = photosProgramme(c, d.villas).pop(), alertes = alertesProgramme(c, d);
    const n = { demarrer: 0, encours: 0, terminee: 0, retard: 0 }; vs.forEach((v) => n[etatVilla(v)]++);
    const seg = ["terminee", "encours", "retard", "demarrer"].filter((k) => n[k]).map((k) => `<i class="vseg vseg--${k}" style="flex:${n[k]}" title="${ETATS[k]} : ${n[k]}"></i>`).join("");
    const resume = vs.length ? ["encours", "retard", "terminee", "demarrer"].filter((k) => n[k]).map((k) => `${n[k]} ${ETATS[k].toLowerCase()}${n[k] > 1 && k !== "demarrer" ? "s" : ""}`).join(" · ") : "Aucune villa pour le moment";
    let budget = "";
    if (argent()) {
      const dep = G.calc.depenseChantier(c, d), p = c.budget ? Math.round(dep / c.budget * 100) : 0;
      budget = `<div class="cc__budget"><div><span>Dépensé</span><span><b>${court(dep)}</b> / ${c.budget ? court(c.budget) + " F" : "budget à définir"}</span></div><div class="progress${p > 100 ? " progress--bad" : p > 90 ? " progress--warn" : ""}"><i style="width:${Math.min(100, p)}%"></i></div></div>`;
    }
    return `<a class="card cc prog${c.statut === "termine" ? " prog--fini" : ""}" href="#g-chantier/${c.id}" data-q="${esc(`${c.nom} ${c.lieu || ""}`.toLowerCase())}">
      <div class="cc__img${ph ? "" : " cc__img--ph"}">${ph ? `<img src="${esc(G.img ? G.img(ph.src) : "/" + ph.src)}" alt="" loading="lazy">` : I("hardhat")}<span class="st st--${esc(c.statut)}">${esc(STATUT_PROG[c.statut] || c.statut)}</span>
        ${alertes.length ? `<span class="prog__alerte" title="${esc(alertes.join(" · "))}" aria-label="Alerte : ${esc(alertes.join(", "))}"></span>` : ""}</div>
      <div class="cc__body"><div style="min-width:0"><h3>${esc(c.nom)}</h3><div class="cc__loc">${I("pin")}${esc(c.lieu || "Lieu non précisé")}</div></div>${U.ring(av)}</div>
      <div class="prog__villas"><div><span><b>${vs.length}</b> villa${vs.length > 1 ? "s" : ""}</span><span class="muted">${esc(resume)}</span></div>${vs.length ? `<div class="vbar">${seg}</div>` : ""}</div>
      ${budget}
      ${alertes.length ? `<p class="prog__msg">${I("alertcircle")}${esc(alertes.join(" · "))}</p>` : ""}
    </a>`;
  }
})();
