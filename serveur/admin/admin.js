/* Tableau de bord GEI — sans bibliothèque */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const main = $("#main");
  const img = (src) => (src ? (/^(https?:|\/)/.test(src) ? src : "/" + src) : "/assets/img/logo-gei.png");

  /* ---------- Échanges avec le serveur ---------- */
  async function api(url, opts = {}) {
    const res = await fetch(url, {
      method: opts.method || "GET", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-GEI": "1" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* réponse vide */ }
    if (res.status === 401 && url !== "/api/login") { showLogin(); throw new Error("Session expirée, reconnectez-vous."); }
    if (!res.ok) throw new Error(data.error || "Erreur " + res.status);
    return data;
  }

  let toastTimer;
  function toast(msg, isErr) {
    const t = $("#toast");
    t.textContent = msg; t.className = "toast is-on" + (isErr ? " toast--err" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = "toast"; }, 3200);
  }
  const fail = (e) => toast(e.message || "Erreur", true);

  /* ---------- Connexion ---------- */
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; $("[name=user]", $("#loginForm")).focus(); }
  function showApp() { $("#login").hidden = true; $("#app").hidden = false; route(); refreshBadge(); }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $("button", e.target); btn.disabled = true; $("#loginErr").hidden = true;
    try {
      await api("/api/login", { method: "POST", body: { user: f.get("user"), password: f.get("password") } });
      e.target.reset(); showApp();
    } catch (err) { $("#loginErr").textContent = err.message; $("#loginErr").hidden = false; }
    btn.disabled = false;
  });
  $("#logout").addEventListener("click", async () => { try { await api("/api/logout", { method: "POST" }); } catch (_) {} showLogin(); });

  async function refreshBadge() {
    try {
      const s = await api("/api/stats");
      const b = $("#badgeDemandes");
      b.textContent = s.demandes.nonTraitees; b.hidden = !s.demandes.nonTraitees;
    } catch (_) {}
  }

  /* ---------- Navigation ---------- */
  const views = { accueil: viewAccueil, demandes: viewDemandes, programmes: viewProgrammes, programme: viewProgramme, actualites: viewActualites, actualite: viewActualite, compte: viewCompte };
  let dirty = false;
  function route() {
    const [name, arg] = (location.hash.slice(1) || "accueil").split("/");
    const v = views[name] || viewAccueil;
    $$("#nav a").forEach((a) => a.classList.toggle("is-on", name.startsWith(a.dataset.view.replace(/s$/, ""))));
    dirty = false;
    main.innerHTML = '<p class="empty">Chargement…</p>';
    v(arg ? decodeURIComponent(arg) : undefined).catch(fail);
    scrollTo(0, 0);
  }
  addEventListener("hashchange", (e) => {
    if (dirty && !confirm("Des modifications ne sont pas enregistrées. Quitter quand même ?")) {
      history.replaceState(null, "", e.oldURL.slice(e.oldURL.indexOf("#"))); return;
    }
    route();
  });
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Vue d'ensemble ---------- */
  async function viewAccueil() {
    const s = await api("/api/stats");
    const max = Math.max(1, ...s.jours.map((j) => j.vues));
    const maxTop = Math.max(1, ...s.top.map((t) => t.vues));
    const fmt = (k) => new Date(k + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    const nomPage = (p) => ({ "/index.html": "Accueil" }[p] || p.replace(/^\//, "").replace(/\.html$/, "").replace(/-/g, " "));
    main.innerHTML = `
      <div class="top"><div><h1>Vue d'ensemble</h1><p>Les 30 derniers jours sur le site</p></div>
        <div class="top__actions"><a class="btn btn--primary" href="#programme/nouveau">+ Nouveau programme</a><a class="btn btn--ghost" href="#actualite/nouvelle">+ Nouvelle actualité</a></div></div>
      <div class="kpis">
        <div class="kpi"><small>Visiteurs</small><b>${s.visiteurs}</b><span>${s.aujourdhui.visiteurs} aujourd'hui</span></div>
        <div class="kpi"><small>Pages vues</small><b>${s.vues}</b><span>${s.aujourdhui.vues} aujourd'hui</span></div>
        <div class="kpi kpi--alert"><small>Demandes à traiter</small><b>${s.demandes.nonTraitees}</b><span>${s.demandes.total} au total</span></div>
        <div class="kpi"><small>Contenu</small><b>${s.programmes}</b><span>programmes · ${s.actualites} actualités</span></div>
      </div>
      <div class="cols">
        <section class="panel">
          <h2>Visites par jour</h2>
          <div class="legend"><span><i style="background:var(--blue)"></i>Visiteurs</span><span><i style="background:var(--blue-l)"></i>Pages vues</span></div>
          <div class="chart">${s.jours.map((j) => `<div data-tip="${fmt(j.jour)} : ${j.visiteurs} visiteur(s), ${j.vues} page(s)"><i style="height:${(j.vues / max) * 100}%"><b style="height:${j.vues ? (j.visiteurs / j.vues) * 100 : 0}%"></b></i></div>`).join("")}</div>
          <div class="chart__axis"><span>${fmt(s.jours[0].jour)}</span><span>Aujourd'hui</span></div>
        </section>
        <section class="panel">
          <h2>Pages les plus vues</h2>
          ${s.top.length ? `<div class="bars">${s.top.map((t) => `<div><span>${esc(nomPage(t.page))}</span><b>${t.vues}</b><i><b style="width:${(t.vues / maxTop) * 100}%"></b></i></div>`).join("")}</div>` : '<p class="empty">Pas encore de visites.</p>'}
        </section>
      </div>`;
  }

  /* ---------- Demandes ---------- */
  let filtreDemandes = "todo";
  async function viewDemandes() {
    const list = await api("/api/demandes");
    const draw = () => {
      const q = ($("#q") && $("#q").value.toLowerCase()) || "";
      const shown = list.filter((d) => (filtreDemandes === "all" || (filtreDemandes === "todo" ? !d.traitee : d.traitee)) &&
        (!q || [d.nom, d.tel, d.programme, d.message].join(" ").toLowerCase().includes(q)));
      $("#reqs").innerHTML = shown.length ? shown.map((d) => {
        const tel = (d.tel || "").replace(/[^\d+]/g, "");
        const wa = tel.replace(/^\+/, "").replace(/^0/, "225");
        return `<article class="req" data-id="${esc(d.id)}">
          <div>
            <h3>${esc(d.nom)} ${d.traitee ? '<span class="tag">Traitée</span>' : '<span class="tag tag--new">Nouvelle</span>'}</h3>
            <div class="req__meta">${new Date(d.date).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })} · <a href="tel:${esc(tel)}">${esc(d.tel)}</a>${d.programme ? " · " + esc(d.programme) : ""}</div>
          </div>
          <div class="req__actions">
            <a class="btn btn--sm btn--ghost" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>
            <button class="btn btn--sm ${d.traitee ? "btn--text" : "btn--ok"}" data-act="toggle">${d.traitee ? "Remettre à traiter" : "Marquer traitée"}</button>
            <button class="btn btn--sm btn--danger" data-act="del">Supprimer</button>
          </div>
          ${d.message ? `<p class="req__msg">${esc(d.message)}</p>` : ""}
        </article>`;
      }).join("") : '<p class="empty">Aucune demande ici.</p>';
    };
    main.innerHTML = `
      <div class="top"><div><h1>Demandes de contact</h1><p>Envoyées par le formulaire du site</p></div></div>
      <section class="panel">
        <div class="filters">
          <div class="seg" id="seg"><button data-f="todo">À traiter</button><button data-f="done">Traitées</button><button data-f="all">Toutes</button></div>
          <input type="search" id="q" placeholder="Rechercher un nom, un numéro…">
        </div>
        <div id="reqs"></div>
      </section>`;
    const seg = () => $$("#seg button").forEach((b) => b.classList.toggle("is-on", b.dataset.f === filtreDemandes));
    seg(); draw();
    $("#seg").addEventListener("click", (e) => { if (e.target.dataset.f) { filtreDemandes = e.target.dataset.f; seg(); draw(); } });
    $("#q").addEventListener("input", draw);
    $("#reqs").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const id = b.closest(".req").dataset.id;
      const d = list.find((x) => x.id === id);
      try {
        if (b.dataset.act === "toggle") { await api("/api/demandes/" + id, { method: "PATCH", body: { traitee: !d.traitee } }); d.traitee = !d.traitee; toast(d.traitee ? "Demande marquée comme traitée" : "Demande remise à traiter"); }
        if (b.dataset.act === "del") { if (!confirm("Supprimer définitivement cette demande ?")) return; await api("/api/demandes/" + id, { method: "DELETE" }); list.splice(list.indexOf(d), 1); toast("Demande supprimée"); }
        draw(); refreshBadge();
      } catch (err) { fail(err); }
    });
  }

  /* ---------- Programmes ---------- */
  async function viewProgrammes() {
    const list = (await api("/api/programmes")).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    main.innerHTML = `
      <div class="top"><div><h1>Programmes</h1><p>${list.length} programme(s). Les changements apparaissent tout de suite sur le site.</p></div>
        <div class="top__actions"><a class="btn btn--primary" href="#programme/nouveau">+ Nouveau programme</a></div></div>
      <div class="items">${list.map((p) => `
        <article class="item">
          <img src="${esc(img(p.carte || p.image))}" alt="" loading="lazy">
          <div class="item__body"><small>${esc(p.ville)}</small><h3>${esc(p.nom)}</h3>
            <p>Dès ${esc(p.prixDes)} M FCFA · ${esc(p.statut || "")}</p>
            <p>${p.visible === false ? '<span class="tag tag--off">Masqué du site</span>' : '<span class="tag">En ligne</span>'}</p></div>
          <div class="item__foot">
            <a class="btn btn--sm btn--primary" href="#programme/${esc(p.slug)}">Modifier</a>
            <a class="btn btn--sm btn--ghost" href="/programme-${esc(p.slug)}.html" target="_blank" rel="noopener">Voir</a>
          </div>
        </article>`).join("") || '<p class="empty">Aucun programme.</p>'}</div>`;
  }

  const lines = (v) => String(v || "").split("\n").map((s) => s.trim()).filter(Boolean);
  const paras = (v) => String(v || "").split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);

  function imgField(name, label, value) {
    return `<div class="full"><span class="lbl">${label}</span><div class="imgfield" data-img="${name}">
      <img src="${esc(img(value))}" alt=""><div><input type="hidden" name="${name}" value="${esc(value || "")}">
      <button type="button" class="btn btn--sm btn--ghost" data-pick="${name}">Choisir ou envoyer une photo</button></div></div></div>`;
  }
  function setImg(form, name, src) {
    const wrap = $(`[data-img="${name}"]`, form);
    $("input", wrap).value = src; $("img", wrap).src = img(src); dirty = true;
  }

  async function viewProgramme(slug) {
    const isNew = slug === "nouveau";
    const p = isNew ? { visible: true, type: "basse", badge: "", formules: [{ label: "Vente directe", montant: "" }], galerie: [], documents: "ACD & permis", ordre: 10 }
      : (await api("/api/programmes")).find((x) => x.slug === slug);
    if (!p) { main.innerHTML = '<p class="empty">Programme introuvable.</p>'; return; }
    let galerie = (p.galerie || []).map((g) => ({ ...g }));
    let formules = (p.formules || []).map((f) => ({ ...f }));
    const v = p.video || {};
    main.innerHTML = `
      <div class="top"><div><h1>${isNew ? "Nouveau programme" : esc(p.nom)}</h1><p>${isNew ? "Remplissez les informations, puis enregistrez." : `Page du site : <a href="/programme-${esc(p.slug)}.html" target="_blank" rel="noopener">programme-${esc(p.slug)}.html ↗</a>`}</p></div>
        <div class="top__actions"><a class="btn btn--text" href="#programmes">← Retour</a></div></div>
      <form class="form" id="pf" novalidate>
        <section class="panel"><h2>L'essentiel</h2><div class="grid">
          <label><span>Ville *</span><input name="ville" required value="${esc(p.ville)}" placeholder="Ex. Adiaké"></label>
          <label><span>Nom du programme *</span><input name="nom" required value="${esc(p.nom)}" placeholder="Ex. Cité Les Rives de l'Opulence"></label>
          <label><span>Catégorie (pour le filtre du site)</span><select name="type">
            ${[["basse", "Villa basse"], ["duplex", "Duplex"], ["eco", "Économique"], ["autre", "Autre"]].map(([k, l]) => `<option value="${k}"${p.type === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label><span>Type affiché</span><input name="typeLabel" value="${esc(p.typeLabel)}" placeholder="Ex. Villa duplex"></label>
          <label><span>Pièces</span><input name="pieces" value="${esc(p.pieces)}" placeholder="Ex. 5 pièces"></label>
          <label><span>Superficie</span><input name="surface" value="${esc(p.surface)}" placeholder="Ex. 150 m²"></label>
          <label><span>Prix de départ (en millions FCFA)</span><input name="prixDes" inputmode="decimal" value="${esc(p.prixDes)}" placeholder="Ex. 40"></label>
          <label><span>Documents</span><input name="documents" value="${esc(p.documents)}"></label>
        </div></section>

        <section class="panel"><h2>Statut</h2><div class="grid">
          <label><span>Statut (étiquette sur la photo)</span><input name="statut" value="${esc(p.statut)}" placeholder="Ex. En construction"></label>
          <label><span>Couleur de l'étiquette</span><select name="badge">
            ${[["", "Blanche"], ["ok", "Verte (livré)"], ["new", "Bleue (nouveau)"]].map(([k, l]) => `<option value="${k}"${(p.badge || "") === k ? " selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="full"><span>Phrase en haut de la page</span><input name="pill" value="${esc(p.pill)}" placeholder="Ex. Clés remises le 10 octobre 2026"></label>
          <label class="check"><input type="checkbox" name="visible"${p.visible !== false ? " checked" : ""}> Afficher ce programme sur le site</label>
          <label><span>Ordre d'affichage</span><input name="ordre" type="number" value="${esc(p.ordre || 0)}"><p class="hint">Le plus petit numéro s'affiche en premier.</p></label>
        </div></section>

        <section class="panel"><h2>Prix et formules</h2>
          <div class="rows" id="formules"></div>
          <p><button type="button" class="btn btn--sm btn--ghost" id="addF">+ Ajouter une formule</button></p>
          <label><span>Note sous les prix</span><input name="noteOffre" value="${esc(p.noteOffre)}" placeholder="Ex. Habitation immédiate selon les conditions de l'offre."></label>
        </section>

        <section class="panel"><h2>Textes de la page</h2><div class="grid">
          <label><span>Grand titre, début</span><input name="titre1" value="${esc(p.titre1)}" placeholder="Ex. Cité Les Rives"></label>
          <label><span>Grand titre, fin (en bleu)</span><input name="titre2" value="${esc(p.titre2)}" placeholder="Ex. de l'Opulence"></label>
          <label class="full"><span>Phrase d'accroche</span><textarea name="accroche" rows="2">${esc(p.accroche)}</textarea></label>
          <label><span>Titre de la présentation, début</span><input name="sousTitre1" value="${esc(p.sousTitre1)}" placeholder="Ex. Vivre au calme,"></label>
          <label><span>Titre de la présentation, fin (en bleu)</span><input name="sousTitre2" value="${esc(p.sousTitre2)}" placeholder="Ex. près d'Abidjan"></label>
          <label class="full"><span>Présentation</span><textarea name="paragraphes" rows="8">${esc((p.paragraphes || []).join("\n\n"))}</textarea><p class="hint">Laissez une ligne vide entre deux paragraphes.</p></label>
          <label class="full"><span>Points forts</span><textarea name="points" rows="6">${esc((p.points || []).join("\n"))}</textarea><p class="hint">Un point par ligne.</p></label>
        </div></section>

        <section class="panel"><h2>Photos principales</h2><div class="grid">
          ${imgField("image", "Grande photo en haut de la page", p.image)}
          ${imgField("carte", "Photo de la carte (accueil et liste des programmes)", p.carte)}
        </div></section>

        <section class="panel"><h2>Galerie</h2>
          <div class="gal" id="gal"></div>
          <p><button type="button" class="btn btn--sm btn--primary" id="addG">+ Ajouter des photos</button></p>
        </section>

        <section class="panel"><h2>Vidéo (facultatif)</h2><div class="grid">
          <label><span>Fichier vidéo</span><input name="vsrc" value="${esc(v.src)}" placeholder="Ex. assets/video/visite-adiake.mp4"><p class="hint">Les vidéos sont lourdes : déposez le fichier dans <b>Site_GEI/assets/video</b>, puis écrivez son chemin ici. Laissez vide pour ne pas afficher de vidéo.</p></label>
          <label><span>Format</span><select name="vformat"><option value="vertical"${v.format === "vertical" ? " selected" : ""}>Vertical (téléphone)</option><option value="horizontal"${v.format !== "vertical" ? " selected" : ""}>Horizontal</option></select></label>
          <label><span>Titre</span><input name="vtitre" value="${esc(v.titre)}"></label>
          <label><span>Texte</span><input name="vtexte" value="${esc(v.texte)}"></label>
          ${imgField("vposter", "Image affichée avant la lecture", v.poster)}
        </div></section>

        <div class="savebar">
          ${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer le programme</button>'}
          <button type="submit" class="btn btn--primary">${isNew ? "Créer le programme" : "Enregistrer"}</button>
        </div>
      </form>`;
    const form = $("#pf");

    const drawF = () => {
      $("#formules").innerHTML = formules.map((f, i) => `<div class="row" data-i="${i}">
        <input data-k="label" value="${esc(f.label)}" placeholder="Ex. Vente directe" aria-label="Nom de la formule">
        <input data-k="montant" value="${esc(f.montant)}" inputmode="decimal" placeholder="M FCFA" aria-label="Montant en millions">
        <button type="button" class="btn btn--sm btn--text" data-rm>Retirer</button></div>`).join("");
    };
    $("#formules").addEventListener("input", (e) => { const r = e.target.closest(".row"); formules[r.dataset.i][e.target.dataset.k] = e.target.value; });
    $("#formules").addEventListener("click", (e) => { if (e.target.matches("[data-rm]")) { formules.splice(e.target.closest(".row").dataset.i, 1); drawF(); dirty = true; } });
    $("#addF").addEventListener("click", () => { formules.push({ label: "", montant: "" }); drawF(); dirty = true; });
    drawF();

    const drawG = () => {
      $("#gal").innerHTML = galerie.length ? galerie.map((g, i) => `<figure data-i="${i}"><img src="${esc(img(g.src))}" alt="">
        <figcaption><input value="${esc(g.legende)}" placeholder="Légende" aria-label="Légende">
        <div><button type="button" class="btn btn--text" data-mv="-1" title="Avancer">←</button><button type="button" class="btn btn--text" data-mv="1" title="Reculer">→</button><button type="button" class="btn btn--danger" data-rm>Retirer</button></div></figcaption></figure>`).join("")
        : '<p class="empty">Aucune photo dans la galerie.</p>';
    };
    $("#gal").addEventListener("input", (e) => { galerie[e.target.closest("figure").dataset.i].legende = e.target.value; });
    $("#gal").addEventListener("click", (e) => {
      const fig = e.target.closest("figure"); if (!fig) return;
      const i = +fig.dataset.i;
      if (e.target.matches("[data-rm]")) galerie.splice(i, 1);
      else if (e.target.dataset.mv) { const j = i + +e.target.dataset.mv; if (j < 0 || j >= galerie.length) return; [galerie[i], galerie[j]] = [galerie[j], galerie[i]]; }
      else return;
      dirty = true; drawG();
    });
    $("#addG").addEventListener("click", () => pick((srcs) => { srcs.forEach((src) => galerie.push({ src, legende: "" })); drawG(); dirty = true; }, true));
    drawG();

    form.addEventListener("click", (e) => { const n = e.target.dataset.pick; if (n) pick(([src]) => setImg(form, n, src)); });
    form.addEventListener("input", () => { dirty = true; });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const body = {
        ville: f.get("ville"), nom: f.get("nom"), type: f.get("type"), typeLabel: f.get("typeLabel"), pieces: f.get("pieces"), surface: f.get("surface"),
        prixDes: f.get("prixDes"), documents: f.get("documents"), statut: f.get("statut"), badge: f.get("badge"), pill: f.get("pill"),
        visible: f.get("visible") === "on", ordre: f.get("ordre"), noteOffre: f.get("noteOffre"),
        titre1: f.get("titre1"), titre2: f.get("titre2"), accroche: f.get("accroche"), sousTitre1: f.get("sousTitre1"), sousTitre2: f.get("sousTitre2"),
        paragraphes: paras(f.get("paragraphes")), points: lines(f.get("points")),
        formules: formules.filter((x) => String(x.label).trim()), image: f.get("image"), carte: f.get("carte"), galerie,
        video: f.get("vsrc") ? { src: f.get("vsrc"), poster: f.get("vposter"), titre: f.get("vtitre"), texte: f.get("vtexte"), format: f.get("vformat") } : null,
      };
      if (!body.ville.trim() || !body.nom.trim()) return toast("La ville et le nom sont obligatoires.", true);
      const btn = $("[type=submit]", form); btn.disabled = true;
      try {
        const saved = await api(isNew ? "/api/programmes" : "/api/programmes/" + p.slug, { method: isNew ? "POST" : "PUT", body });
        dirty = false; toast(isNew ? "Programme créé" : "Modifications enregistrées");
        if (isNew) location.hash = "#programme/" + saved.slug;
      } catch (err) { fail(err); }
      btn.disabled = false;
    });
    const del = $("#del");
    if (del) del.addEventListener("click", async () => {
      if (!confirm(`Supprimer définitivement « ${p.nom} » ? Sa page disparaîtra du site.\n\nAstuce : pour le cacher sans le supprimer, décochez plutôt « Afficher ce programme sur le site ».`)) return;
      try { await api("/api/programmes/" + p.slug, { method: "DELETE" }); dirty = false; toast("Programme supprimé"); location.hash = "#programmes"; } catch (err) { fail(err); }
    });
  }

  /* ---------- Actualités ---------- */
  async function viewActualites() {
    const list = (await api("/api/actualites")).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    main.innerHTML = `
      <div class="top"><div><h1>Actualités</h1><p>La plus récente s'affiche en grand sur la page Actualités.</p></div>
        <div class="top__actions"><a class="btn btn--primary" href="#actualite/nouvelle">+ Nouvelle actualité</a></div></div>
      <div class="items">${list.map((a) => `
        <article class="item">
          <img src="${esc(img(a.image))}" alt="" loading="lazy" style="${a.image ? "" : "object-fit:contain;padding:30px"}">
          <div class="item__body"><small>${esc(a.dateTexte || new Date(a.date + "T12:00:00").toLocaleDateString("fr-FR", { dateStyle: "long" }))}</small><h3>${esc(a.titre)}</h3>
            <p>${a.publie === false ? '<span class="tag tag--off">Brouillon</span>' : '<span class="tag">Publiée</span>'}</p></div>
          <div class="item__foot"><a class="btn btn--sm btn--primary" href="#actualite/${esc(a.id)}">Modifier</a></div>
        </article>`).join("") || '<p class="empty">Aucune actualité.</p>'}</div>`;
  }

  async function viewActualite(id) {
    const isNew = id === "nouvelle";
    const a = isNew ? { date: new Date().toISOString().slice(0, 10), publie: true } : (await api("/api/actualites")).find((x) => x.id === id);
    if (!a) { main.innerHTML = '<p class="empty">Actualité introuvable.</p>'; return; }
    main.innerHTML = `
      <div class="top"><div><h1>${isNew ? "Nouvelle actualité" : "Modifier l'actualité"}</h1></div>
        <div class="top__actions"><a class="btn btn--text" href="#actualites">← Retour</a></div></div>
      <form class="form" id="af" novalidate>
        <section class="panel"><div class="grid">
          <label class="full"><span>Titre *</span><input name="titre" required value="${esc(a.titre)}" placeholder="Ex. Premières clés remises à Adiaké"></label>
          <label><span>Date</span><input type="date" name="date" value="${esc(a.date)}"><p class="hint">Sert à classer les actualités.</p></label>
          <label><span>Date affichée (facultatif)</span><input name="dateTexte" value="${esc(a.dateTexte)}" placeholder="Ex. 2026"><p class="hint">Laissez vide pour afficher la date complète.</p></label>
          <label class="full"><span>Texte</span><textarea name="texte" rows="5">${esc(a.texte)}</textarea></label>
          <label class="full"><span>Lien « En savoir plus » (facultatif)</span><input name="lien" value="${esc(a.lien)}" placeholder="Ex. programme-adiake.html"></label>
          ${imgField("image", "Photo", a.image)}
          <label class="check"><input type="checkbox" name="publie"${a.publie !== false ? " checked" : ""}> Publier sur le site</label>
        </div></section>
        <div class="savebar">
          ${isNew ? "" : '<button type="button" class="btn btn--danger" id="del">Supprimer</button>'}
          <button type="submit" class="btn btn--primary">${isNew ? "Publier" : "Enregistrer"}</button>
        </div>
      </form>`;
    const form = $("#af");
    form.addEventListener("input", () => { dirty = true; });
    form.addEventListener("click", (e) => { const n = e.target.dataset.pick; if (n) pick(([src]) => setImg(form, n, src)); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const body = { titre: f.get("titre"), date: f.get("date"), dateTexte: f.get("dateTexte"), texte: f.get("texte"), lien: f.get("lien"), image: f.get("image"), publie: f.get("publie") === "on" };
      if (!body.titre.trim()) return toast("Le titre est obligatoire.", true);
      try {
        const saved = await api(isNew ? "/api/actualites" : "/api/actualites/" + a.id, { method: isNew ? "POST" : "PUT", body });
        dirty = false; toast(isNew ? "Actualité publiée" : "Modifications enregistrées");
        if (isNew) location.hash = "#actualite/" + saved.id;
      } catch (err) { fail(err); }
    });
    const del = $("#del");
    if (del) del.addEventListener("click", async () => {
      if (!confirm("Supprimer définitivement cette actualité ?")) return;
      try { await api("/api/actualites/" + a.id, { method: "DELETE" }); dirty = false; toast("Actualité supprimée"); location.hash = "#actualites"; } catch (err) { fail(err); }
    });
  }

  /* ---------- Mon compte ---------- */
  async function viewCompte() {
    const me = await api("/api/me");
    main.innerHTML = `
      <div class="top"><div><h1>Mon compte</h1><p>Connecté en tant que <b>${esc(me.user)}</b></p></div></div>
      <form class="panel form" id="pw" style="max-width:520px">
        <h2>Changer le mot de passe</h2>
        <label><span>Mot de passe actuel</span><input type="password" name="current" autocomplete="current-password" required></label>
        <label><span>Nouveau mot de passe</span><input type="password" name="next" autocomplete="new-password" minlength="10" required><p class="hint">Au moins 10 caractères.</p></label>
        <label><span>Confirmer le nouveau mot de passe</span><input type="password" name="again" autocomplete="new-password" required></label>
        <div><button class="btn btn--primary" type="submit">Changer le mot de passe</button></div>
      </form>`;
    $("#pw").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (f.get("next") !== f.get("again")) return toast("Les deux nouveaux mots de passe ne sont pas identiques.", true);
      try { await api("/api/password", { method: "POST", body: { current: f.get("current"), next: f.get("next") } }); toast("Mot de passe changé. Reconnectez-vous."); setTimeout(showLogin, 1200); }
      catch (err) { fail(err); }
    });
  }

  /* ---------- Bibliothèque d'images + envoi ---------- */
  const dlg = $("#picker");
  let onPick = null, multi = false, chosen = [];
  async function pick(cb, many = false) {
    onPick = cb; multi = many; chosen = [];
    $("#pickerSearch").value = "";
    dlg.showModal();
    await drawPicker();
  }
  let images = [];
  async function drawPicker() {
    images = await api("/api/images");
    renderPicker();
  }
  function renderPicker() {
    const q = $("#pickerSearch").value.toLowerCase();
    $("#pickerGrid").innerHTML = images.filter((s) => !q || s.toLowerCase().includes(q)).map((s) =>
      `<button type="button" data-src="${esc(s)}"><img src="${esc(img(s))}" alt="" loading="lazy"><small>${esc(s.split("/").pop())}</small></button>`).join("") || '<p class="empty">Aucune image.</p>';
  }
  $("#pickerSearch").addEventListener("input", renderPicker);
  $("#pickerGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-src]"); if (!b) return;
    dlg.close(); onPick && onPick([b.dataset.src]);
  });
  $("[data-close]", dlg).addEventListener("click", () => dlg.close());

  // Réduit la photo dans le navigateur (1800 px max) avant de l'envoyer
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1800 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`« ${file.name} » n'est pas une image lisible.`)); };
      im.src = url;
    });
  }
  $("#pickerUpload").addEventListener("change", async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    if (!files.length) return;
    const done = [];
    for (const [i, file] of files.entries()) {
      toast(`Envoi de la photo ${i + 1} sur ${files.length}…`);
      try { const data = await shrink(file); const r = await api("/api/upload", { method: "POST", body: { name: file.name.replace(/\.[^.]+$/, ""), data } }); done.push(r.src); }
      catch (err) { fail(err); }
    }
    if (!done.length) return;
    toast(done.length > 1 ? `${done.length} photos envoyées` : "Photo envoyée");
    dlg.close();
    onPick && onPick(multi ? done : [done[0]]);
  });

  /* ---------- Démarrage ---------- */
  api("/api/me").then(showApp).catch(showLogin);
})();
