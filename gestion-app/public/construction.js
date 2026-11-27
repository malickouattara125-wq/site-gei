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
  const estPart = (c) => c.nature === "particulier";
  const encPart = (c) => sum(c.paiements || [], (p) => p.montant);
  views["g-chantiers"] = async (filtre) => {
    const vue = ["particuliers", "programmes"].includes(filtre) ? filtre : "";
    const noms = argent() ? ["chantiers", "villas", "depenses", "ouvriers", "pointages", "articles", "stock"] : ["chantiers", "villas", "ouvriers", "pointages", "articles", "stock"];
    const d = Object.fromEntries(await Promise.all(noms.map(async (n) => [n, await api("/api/g/" + n).catch(() => [])])));
    if (!d.depenses) d.depenses = [];
    const tous = d.chantiers, nbPart = tous.filter(estPart).length;
    const progs = tous.filter((c) => (vue === "particuliers" ? estPart(c) : vue === "programmes" ? !estPart(c) : true)).sort((a, b) => (a.statut === "termine") - (b.statut === "termine") || (b.statut === "en_cours") - (a.statut === "en_cours") || String(a.nom).localeCompare(String(b.nom)));
    const enCours = progs.filter((c) => c.statut === "en_cours"), actifs = progs.filter((c) => c.statut !== "termine");
    const moy = actifs.length ? Math.round(sum(actifs, (c) => avancementProgramme(c, d.villas)) / actifs.length) : 0;
    const m = today().slice(0, 7);
    const depMois = sum(d.depenses.filter((x) => String(x.date || "").slice(0, 7) === m), (x) => x.montant) + G.calc.paieDe(d.pointages, d.ouvriers, (p) => String(p.date || "").slice(0, 7) === m);
    const villasActives = d.villas.filter((v) => actifs.some((c) => c.id === v.chantierId));
    const parts = progs.filter(estPart), prixP = sum(parts, (c) => c.prix), encP = sum(parts, encPart);
    const chiffre3 = vue === "particuliers" && argent()
      ? `<div class="kpi"><small>Encaissé des clients</small><b>${U.money(encP)}</b><span>reste à encaisser ${court(Math.max(0, prixP - encP))} F</span></div>`
      : argent()
      ? `<div class="kpi"><small>Dépensé ce mois</small><b>${U.money(depMois)}</b><span>${new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span></div>`
      : `<div class="kpi"><small>Villas terminées</small><b>${villasActives.filter((v) => etatVilla(v) === "terminee").length}</b><span>sur ${villasActives.length} villa(s)</span></div>`;
    const btnProg = `<a class="btn btn--${vue === "particuliers" ? "secondary" : "primary"}" href="#g-chantier/nouveau">${I("plus")}Nouveau programme</a>`;
    const btnPart = `<a class="btn btn--${vue === "particuliers" ? "primary" : "secondary"}" href="#g-chantier/nouveau-particulier">${I("plus")}Chantier particulier</a>`;
    const sousTitre = vue === "particuliers" ? "Construction et rénovation pour des clients particuliers : avancement, dépenses et versements du client."
      : argent() ? "Programmes de construction et chantiers de particuliers. Cliquez sur une carte pour l'ouvrir." : "Vos chantiers : cliquez sur une carte pour mettre à jour l'avancement.";
    const chip = (k, l, nb) => `<a class="chip${vue === k ? " is-on" : ""}" href="#g-chantiers${k ? "/" + k : ""}">${l} <b>${nb}</b></a>`;
    main.innerHTML = U.head(vue === "particuliers" ? "Chantiers particuliers" : "Chantiers", sousTitre,
      (argent() ? `${G.exp.bouton()}${vue === "particuliers" ? btnProg + btnPart : btnPart + btnProg}` :
        `${G.exp.bouton()}`), [["Opérations", "#g-chantiers"], ["Chantiers", vue === "particuliers" ? "#g-chantiers" : ""], ...(vue === "particuliers" ? [["Particuliers", ""]] : [])]) + `
      <div class="chips" role="group" aria-label="Afficher">${chip("", "Tous", tous.length)}${chip("programmes", "Programmes GEI", tous.length - nbPart)}${chip("particuliers", "Particuliers", nbPart)}</div>
      <div class="kpis kpis--3">
        ${vue === "particuliers" ? `<div class="kpi"><small>Chantiers en cours</small><b>${enCours.length}</b><span>${parts.filter((c) => c.travaux === "renovation").length} rénovation(s) · ${parts.filter((c) => c.travaux !== "renovation").length} construction(s)</span></div>`
          : `<div class="kpi"><small>Programmes en cours</small><b>${enCours.length}</b><span>${villasActives.length} villa(s) au total</span></div>`}
        <div class="kpi"><small>Avancement moyen</small><b>${moy} %</b><div class="progress"><i style="width:${moy}%"></i></div></div>
        ${chiffre3}
      </div>
      ${progs.length > 3 ? `<div class="prog-search"><label class="ig"><span class="ig__prefix">${I("search")}</span><input type="search" id="q" placeholder="Rechercher un chantier, un client ou un lieu" aria-label="Rechercher un chantier"></label></div>` : ""}
      ${progs.length ? `<div class="prog-grid" id="pg">${progs.map((c) => carte(c, d)).join("")}</div><p class="muted prog-none" id="pn" hidden>Aucun chantier ne correspond à la recherche.</p>`
        : U.vide(vue === "particuliers" ? (argent() ? "Aucun chantier de particulier pour le moment. Cliquez sur « Chantier particulier » pour en ajouter un (même un chantier déjà terminé)." : "Aucun chantier de particulier pour le moment.")
          : argent() ? "Aucun chantier pour le moment. Cliquez sur « Nouveau programme » ou « Chantier particulier » pour commencer." : "Aucun chantier pour le moment.", "hardhat")}`;
    if ($("#q")) $("#q").addEventListener("input", (e) => {
      const s = e.target.value.trim().toLowerCase(); let n = 0;
      $$("#pg .prog").forEach((el) => { const ok = !s || el.dataset.q.includes(s); el.hidden = !ok; n += ok; });
      $("#pn").hidden = !!n;
    });
    G.exp.brancher("xp", () => {
      const q = (($("#q") || {}).value || "").trim().toLowerCase();
      const liste = progs.filter((c) => !q || [c.nom, c.lieu, c.client].join(" ").toLowerCase().includes(q));
      const dep = (c) => G.calc.depenseChantier(c, d), nbV = (c) => d.villas.filter((v) => v.chantierId === c.id).length;
      const cols = [{ t: "Chantier" }, { t: "Nature" }, { t: "Client" }, { t: "Lieu" }, { t: "Statut" }, { t: "Villas", type: "nombre", total: true }, { t: "Avancement", type: "pct" }, { t: "Début", type: "date" }, { t: "Livraison prévue", type: "date" }];
      if (argent()) cols.push({ t: "Budget", type: "montant" }, { t: "Dépensé", type: "montant" }, { t: "Reste du budget", type: "montant" }, { t: "Prix client", type: "montant" }, { t: "Encaissé client", type: "montant" });
      const nat = (c) => (estPart(c) ? (c.travaux === "renovation" ? "Particulier – rénovation" : "Particulier – construction") : "Programme GEI");
      return { fichier: `GEI_${vue === "particuliers" ? "Chantiers-particuliers" : "Chantiers"}_${today()}`, titre: vue === "particuliers" ? "Chantiers particuliers" : "Chantiers", orientation: "paysage", filtres: G.exp.filtres([["Affichage", vue === "particuliers" ? "Particuliers" : vue === "programmes" ? "Programmes GEI" : ""], ["Recherche", q ? "« " + q + " »" : ""]]),
        chiffres: argent() ? [{ l: "Budget total", v: sum(liste, (c) => c.budget) }, { l: "Dépensé", v: sum(liste, dep) }, { l: "Reste", v: sum(liste, (c) => (c.budget || 0) - dep(c)) }, { l: "Avancement moyen", v: moy, type: "pct" }]
          : [{ l: "Programmes en cours", v: enCours.length, type: "nombre" }, { l: "Villas", v: villasActives.length, type: "nombre" }, { l: "Avancement moyen", v: moy, type: "pct" }],
        feuilles: [{ nom: "Chantiers", colonnes: cols, lignes: liste.map((c) => [c.nom, nat(c), c.client || "", c.lieu, STATUT_PROG[c.statut] || c.statut, nbV(c), avancementProgramme(c, d.villas), c.dateDebut, c.dateFin].concat(argent() ? [c.budget || "", dep(c), (c.budget || 0) - dep(c), estPart(c) ? c.prix || "" : "", estPart(c) ? encPart(c) : ""] : [])) }] };
    });
  };

  function carte(c, d) {
    const vs = d.villas.filter((v) => v.chantierId === c.id), av = avancementProgramme(c, d.villas);
    const ph = photosProgramme(c, d.villas).pop(), alertes = alertesProgramme(c, d);
    const n = { demarrer: 0, encours: 0, terminee: 0, retard: 0 }; vs.forEach((v) => n[etatVilla(v)]++);
    const seg = ["terminee", "encours", "retard", "demarrer"].filter((k) => n[k]).map((k) => `<i class="vseg vseg--${k}" style="flex:${n[k]}" title="${ETATS[k]} : ${n[k]}"></i>`).join("");
    const resume = vs.length ? ["encours", "retard", "terminee", "demarrer"].filter((k) => n[k]).map((k) => `${n[k]} ${ETATS[k].toLowerCase()}${n[k] > 1 && k !== "demarrer" ? "s" : ""}`).join(" · ") : "Aucune villa pour le moment";
    let budget = "";
    if (argent() && estPart(c)) {
      const dep = G.calc.depenseChantier(c, d), enc = encPart(c), pe = c.prix ? Math.round(enc / c.prix * 100) : 0;
      budget = `<div class="cc__budget"><div><span>Encaissé du client</span><span><b>${court(enc)}</b> / ${c.prix ? court(c.prix) + " F" : "prix à définir"}</span></div><div class="progress"><i style="width:${Math.min(100, pe)}%"></i></div></div>
        <div class="cc__budget"><div><span>Dépensé</span><span><b>${court(dep)}</b>${c.prix ? ` · marge ${court(c.prix - dep)} F` : ""}</span></div></div>`;
    } else if (argent()) {
      const dep = G.calc.depenseChantier(c, d), p = c.budget ? Math.round(dep / c.budget * 100) : 0;
      budget = `<div class="cc__budget"><div><span>Dépensé</span><span><b>${court(dep)}</b> / ${c.budget ? court(c.budget) + " F" : "budget à définir"}</span></div><div class="progress${p > 100 ? " progress--bad" : p > 90 ? " progress--warn" : ""}"><i style="width:${Math.min(100, p)}%"></i></div></div>`;
    }
    return `<a class="card cc prog${c.statut === "termine" ? " prog--fini" : ""}" href="#g-chantier/${c.id}" data-q="${esc(`${c.nom} ${c.lieu || ""} ${c.client || ""}`.toLowerCase())}">
      <div class="cc__img${ph ? "" : " cc__img--ph"}">${ph ? `<img src="${esc(G.img ? G.img(ph.src) : "/" + ph.src)}" alt="" loading="lazy">` : I("hardhat")}<span class="st st--${esc(c.statut)}">${esc(STATUT_PROG[c.statut] || c.statut)}</span>
        ${alertes.length ? `<span class="prog__alerte" title="${esc(alertes.join(" · "))}" aria-label="Alerte : ${esc(alertes.join(", "))}"></span>` : ""}</div>
      <div class="cc__body"><div style="min-width:0"><h3>${esc(c.nom)}</h3><div class="cc__loc">${I("pin")}${esc(c.lieu || "Lieu non précisé")}</div></div>${U.ring(av)}</div>
      ${estPart(c) ? `<div class="prog__villas"><div><span class="prog__type">${c.travaux === "renovation" ? "Rénovation" : "Construction"}</span><span class="muted">${esc(c.client || "Client à préciser")}</span></div></div>`
        : `<div class="prog__villas"><div><span><b>${vs.length}</b> villa${vs.length > 1 ? "s" : ""}</span><span class="muted">${esc(resume)}</span></div>${vs.length ? `<div class="vbar">${seg}</div>` : ""}</div>`}
      ${budget}
      ${alertes.length ? `<p class="prog__msg">${I("alertcircle")}${esc(alertes.join(" · "))}</p>` : ""}
    </a>`;
  }
})();
