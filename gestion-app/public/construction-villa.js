/* GEI Gestion — volet Construction, étape 4 : fiche villa (résumé, phases avec coche / % / dates / photos, galerie par phase)
   et panneau de saisie réutilisable (glisse depuis la droite sur ordinateur, depuis le bas sur téléphone). */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G || !G.construction) return;
  const { api, esc, toast, fail, views, main, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a), K = G.construction;
  const today = () => new Date().toISOString().slice(0, 10);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const argent = () => G.me().role !== "chef";
  const opts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const charger = async (...n) => Object.fromEntries(await Promise.all(n.map(async (x) => [x, await api("/api/g/" + x).catch(() => [])])));
  const NIVEAUX = K.NIVEAUX || { cle_en_main: "Clé en main", gros_oeuvre: "Gros œuvre" };
  const GAMMES = K.GAMMES || { standard: "Standard", confort: "Confort", premium: "Premium" };
  const img = (s) => (G.img ? G.img(s) : "/" + s);

  /* ---------- Panneau de saisie (réutilisé par les étapes suivantes) ---------- */
  let panneauOuvert = null;
  function fermerPanneau() {
    if (!panneauOuvert) return; const p = panneauOuvert; panneauOuvert = null;
    p.classList.remove("is-on"); document.body.classList.remove("panneau-open"); setTimeout(() => p.remove(), 260);
  }
  function panneau(titre, corps, { sous = "", pied = "" } = {}) {
    fermerPanneau();
    const p = document.createElement("div"); p.className = "pan-wrap";
    p.innerHTML = `<div class="pan__scrim" data-pclose></div><aside class="pan" role="dialog" aria-modal="true" aria-label="${esc(titre)}">
      <div class="pan__grip" aria-hidden="true"></div>
      <header class="pan__head"><div><h2>${esc(titre)}</h2>${sous ? `<p>${sous}</p>` : ""}</div><button type="button" class="btn btn--tertiary btn--icon" data-pclose aria-label="Fermer">${I("x")}</button></header>
      <div class="pan__body">${corps}</div>${pied ? `<footer class="pan__foot">${pied}</footer>` : ""}</aside>`;
    document.body.appendChild(p); panneauOuvert = p; document.body.classList.add("panneau-open");
    requestAnimationFrame(() => p.classList.add("is-on")); setTimeout(() => p.classList.add("is-on"), 30);
    p.addEventListener("click", (e) => { if (e.target.closest("[data-pclose]")) fermerPanneau(); });
    // Sur téléphone : glisser vers le bas pour fermer
    const pan = $(".pan", p); let y0 = null, dy = 0;
    $(".pan__grip", p).addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; pan.style.transition = "none"; }, { passive: true });
    $(".pan__grip", p).addEventListener("touchmove", (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); pan.style.transform = `translateY(${dy}px)`; }, { passive: true });
    $(".pan__grip", p).addEventListener("touchend", () => { pan.style.transition = ""; pan.style.transform = ""; if (dy > 80) fermerPanneau(); y0 = null; dy = 0; });
    return p;
  }
  addEventListener("keydown", (e) => { if (e.key === "Escape" && panneauOuvert) fermerPanneau(); });
  addEventListener("hashchange", fermerPanneau);
  K.panneau = panneau; K.fermerPanneau = fermerPanneau;

  // Photo : réduite à 1800 px puis envoyée (rapide même avec une petite connexion)
  const reduire = (file) => new Promise((ok, ko) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const k = Math.min(1, 1800 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.82)); };
    im.onerror = () => { URL.revokeObjectURL(url); ko(new Error(`« ${file.name} » n'est pas une image lisible.`)); };
    im.src = url;
  });
  async function envoyerPhoto(file, nom) { const data = await reduire(file); const r = await api("/api/g/upload", { method: "POST", body: { name: nom, data } }); return r.src; }
  K.envoyerPhoto = envoyerPhoto;

  /* ---------- Fiche villa ---------- */
  views["g-villa"] = async (arg) => {
    const vid = String(arg || "").split("/")[0];
    const d = await charger("villas", "chantiers", "stock", "articles", ...(argent() ? ["maisons"] : []));
    const v = d.villas.find((x) => x.id === vid);
    if (!v) { main.innerHTML = U.vide("Villa introuvable.", "house"); return; }
    const c = d.chantiers.find((x) => x.id === v.chantierId) || { nom: "Programme", id: v.chantierId };
    const m = (d.maisons || []).find((x) => x.id === v.maisonId);
    const e = K.etatVilla(v), a = K.avancementVilla(v);
    const gros = v.phases.filter((p) => p.bloc === "gros"), second = v.phases.filter((p) => p.bloc === "second");
    const nbPhotos = v.phases.reduce((t, p) => t + (p.photos || []).length, 0);
    const ligne = (p) => { const i = v.phases.indexOf(p), ok = p.avancement >= 100, retard = p.dateFin && p.dateFin < today() && !ok;
      return `<li class="ph${ok ? " is-ok" : ""}${retard ? " is-late" : ""}" data-i="${i}">
        <button type="button" class="ph__chk" data-chk="${i}" aria-label="${ok ? "Phase terminée" : "Marquer la phase comme terminée"}">${ok ? I("check") : ""}</button>
        <button type="button" class="ph__body" data-ph="${i}"><span class="ph__nom">${esc(p.nom)}</span>
          <span class="ph__meta">${retard ? `<b class="t-bad">En retard · prévue le ${U.dateFr(p.dateFin)}</b>` : p.dateFin ? `Fin prévue ${U.dateFr(p.dateFin)}` : "Dates à définir"}${(p.photos || []).length ? ` · ${I("image")} ${(p.photos || []).length}` : ""}</span>
          <span class="ph__bar"><i style="width:${p.avancement}%"></i></span></button>
        <span class="ph__pct">${p.avancement} %</span></li>`; };
    const recu = () => {
      const sorties = (d.stock || []).filter((s) => s.villaId === v.id && s.sens === "sortie").sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const art = (id) => (d.articles || []).find((a) => a.id === id) || { nom: "?", unite: "" };
      const tot = {}; sorties.forEach((s) => { tot[s.articleId] = (tot[s.articleId] || 0) + s.quantite; });
      const resume = Object.keys(tot).map((id) => `${String(Math.round(tot[id] * 100) / 100).replace(".", ",")} ${art(id).unite} de ${art(id).nom}`).join(" · ");
      return `<details class="onglet"><summary>${I("chevright")}<b>Matériel reçu du stock</b><span class="muted">${sorties.length ? esc(resume) : "rien pour le moment"}</span></summary>
        ${sorties.length ? U.tableau([["Date", (s) => U.dateFr(s.date)], ["Matériau", (s) => esc(art(s.articleId).nom)], ["Quantité", (s) => `${String(s.quantite).replace(".", ",")} ${esc(art(s.articleId).unite)}`, 1], ["Note", (s) => esc(s.notes || "")], ["Par", (s) => esc(s.creePar || "")]], sorties) : '<p class="muted">Utilisez « Sortir du stock » quand du matériel du chantier est utilisé pour cette villa.</p>'}</details>`;
    };
    const colonne = (titre, liste) => `<div class="phcol"><h3>${titre}</h3><ul class="phases">${liste.map(ligne).join("")}</ul></div>`;
    main.innerHTML = U.head(`Villa ${esc(v.lot)}`, `${esc(c.nom)}${v.type ? " · " + esc(v.type) : ""}`,
      `<a class="btn btn--tertiary" href="#g-chantier/${c.id}">${I("chevleft")}Programme</a>${argent() ? `<a class="btn btn--secondary" href="#g-depense/nouvelle/${c.id}/${v.id}">${I("receipt")}Nouvelle dépense</a>` : ""}<button type="button" class="btn btn--secondary" id="sortirV">${I("package")}Sortir du stock</button>`,
      [["Chantiers", "#g-chantiers"], [esc(c.nom), `#g-chantier/${c.id}`], [`Villa ${esc(v.lot)}`, ""]]) + `
      <section class="panel vres">
        <div class="vres__av">${U.ring(a)}<div><b>${a} %</b><span>${esc(K.ETATS[e])} · phase : ${esc(K.phaseEnCours(v))}</span></div></div>
        <dl class="vres__info">
          <div><dt>Type</dt><dd>${esc(v.type || "—")}</dd></div>
          <div><dt>Surface</dt><dd>${v.surface ? `${String(v.surface).replace(".", ",")} m²` : "—"}</dd></div>
          <div><dt>Livraison</dt><dd>${esc(NIVEAUX[v.niveau])}</dd></div>
          <div><dt>Finitions</dt><dd>${v.niveau === "gros_oeuvre" ? "—" : esc(GAMMES[v.gamme])}</dd></div>
          ${argent() ? `<div><dt>Budget prévu</dt><dd>${v.budget ? fcfa(v.budget) : "—"}</dd></div><div><dt>Client</dt><dd>${m && m.clientNom ? esc(m.clientNom) : "—"}</dd></div>` : ""}
        </dl>
        ${argent() ? `<button type="button" class="btn btn--secondary btn--sm vres__edit" id="editV">${I("pencil")}Modifier</button>` : ""}
      </section>
      <section class="panel"><div class="sec__head"><span class="sec__n">${I("planning")}</span><div><h2>Phases</h2><p>Touchez une phase pour mettre à jour son avancement, ses dates et ajouter une photo. Le rond coche la phase comme terminée.</p></div></div>
        <div class="phcols${v.niveau === "gros_oeuvre" ? " phcols--1" : ""}">${colonne("Gros œuvre", gros)}${v.niveau === "gros_oeuvre" ? "" : colonne("Second œuvre et finitions", second)}</div>
      </section>
      <div id="villaPlus"></div>
      ${recu()}
      <details class="onglet"${nbPhotos ? " open" : ""}><summary>${I("chevright")}<b>Photos</b><span class="muted">${nbPhotos} photo(s), classées par phase</span></summary>
        ${nbPhotos ? K.phasesUtiles(v).filter((p) => (p.photos || []).length).map((p) => `<h4 class="gal__t">${esc(p.nom)}</h4><div class="vgal">${p.photos.slice().reverse().map((ph) => `<a href="${esc(img(ph.src))}" target="_blank" rel="noopener"><img src="${esc(img(ph.src))}" alt="${esc(ph.legende || p.nom)}" loading="lazy"><span>${ph.date ? U.dateFr(ph.date) : ""}${ph.legende ? " · " + esc(ph.legende) : ""}</span></a>`).join("")}</div>`).join("")
          : '<p class="muted">Aucune photo pour le moment. Touchez une phase puis « Prendre une photo ».</p>'}
      </details>`;

    const enregistrer = async (phases, msg) => {
      try { await api(`/api/g/villas/${v.id}`, { method: "PUT", body: { phases } }); toast(msg || "Avancement enregistré"); views["g-villa"](v.id); }
      catch (err) { fail(err); }
    };
    // Coche rapide : la phase passe à 100 % ; si elle l'est déjà, on ouvre le détail
    $$("[data-chk]").forEach((b) => (b.onclick = () => {
      const i = +b.dataset.chk; if (v.phases[i].avancement >= 100) return ouvrirPhase(i);
      const phases = v.phases.map((p, j) => (j === i ? { ...p, avancement: 100 } : p)); enregistrer(phases, `${v.phases[i].nom} : terminée`);
    }));
    $$("[data-ph]").forEach((b) => (b.onclick = () => ouvrirPhase(+b.dataset.ph)));

    function ouvrirPhase(i) {
      const p = { ...v.phases[i], photos: (v.phases[i].photos || []).map((x) => ({ ...x })) };
      const vignettes = () => p.photos.length ? p.photos.map((ph, k) => `<figure><img src="${esc(img(ph.src))}" alt=""><button type="button" class="btn btn--tertiary btn--icon" data-rmph="${k}" aria-label="Retirer la photo">${I("x")}</button></figure>`).join("") : '<p class="muted">Aucune photo pour cette phase.</p>';
      const pn = panneau(p.nom, `
        <div class="phx__pct"><b id="phv">${p.avancement} %</b><span>réalisé</span></div>
        <input type="range" id="phr" min="0" max="100" step="5" value="${p.avancement}" aria-label="Avancement en %" class="phx__range">
        <div class="phx__vite">${[0, 25, 50, 75, 100].map((x) => `<button type="button" class="chip" data-v="${x}">${x} %</button>`).join("")}</div>
        <div class="grid phx__dates"><label class="field"><span>Début prévu</span><input type="date" id="phd" value="${esc(p.dateDebut || "")}"></label><label class="field"><span>Fin prévue</span><input type="date" id="phf" value="${esc(p.dateFin || "")}"></label></div>
        <div class="phx__photos"><span class="lbl">Photos de la phase</span><div class="phx__vig" id="phvig">${vignettes()}</div>
          <label class="btn btn--secondary phx__cam">${I("image")}Prendre ou choisir une photo<input type="file" accept="image/*" capture="environment" id="phfile" hidden></label>
          <label class="field"><span>Légende (facultatif)</span><input id="phleg" placeholder="Ex. coulage de la dalle"></label></div>`,
        { sous: `Villa ${esc(v.lot)} · ${esc(c.nom)}`, pied: `<button type="button" class="btn btn--secondary" data-pclose>Annuler</button><button type="button" class="btn btn--primary" id="phok">${I("check")}Enregistrer</button>` });
      const r = $("#phr", pn), val = $("#phv", pn);
      const maj = (x) => { p.avancement = Math.max(0, Math.min(100, Math.round(+x))); r.value = p.avancement; val.textContent = `${p.avancement} %`; $$("[data-v]", pn).forEach((b) => b.classList.toggle("is-on", +b.dataset.v === p.avancement)); };
      r.addEventListener("input", () => maj(r.value)); $$("[data-v]", pn).forEach((b) => (b.onclick = () => maj(b.dataset.v))); maj(p.avancement);
      $("#phvig", pn).addEventListener("click", (ev) => { const b = ev.target.closest("[data-rmph]"); if (!b) return; p.photos.splice(+b.dataset.rmph, 1); $("#phvig", pn).innerHTML = vignettes(); });
      $("#phfile", pn).addEventListener("change", async (ev) => {
        const files = [...ev.target.files]; if (!files.length) return;
        const cam = $(".phx__cam", pn); cam.classList.add("is-busy");
        for (const file of files) {
          try { toast("Envoi de la photo…"); const src = await envoyerPhoto(file, `${v.lot}-${p.cle}`); p.photos.push({ src, date: today(), legende: $("#phleg", pn).value.trim() }); $("#phvig", pn).innerHTML = vignettes(); toast("Photo ajoutée : pensez à enregistrer"); }
          catch (err) { fail(err); }
        }
        cam.classList.remove("is-busy"); ev.target.value = "";
      });
      $("#phok", pn).onclick = () => {
        p.dateDebut = $("#phd", pn).value; p.dateFin = $("#phf", pn).value;
        if (p.dateDebut && p.dateFin && p.dateFin < p.dateDebut) return toast("La fin prévue est avant le début.", true);
        const phases = v.phases.map((x, j) => (j === i ? p : x)); fermerPanneau(); enregistrer(phases, `${p.nom} : ${p.avancement} %`);
      };
    }

    if (K.villaPlus) K.villaPlus(v, c, d);
    if ($("#sortirV")) $("#sortirV").onclick = () => (G.sortirStock ? G.sortirStock({ chantierId: c.id, villaId: v.id }) : null);
    if ($("#editV")) $("#editV").onclick = () => {
      const pn = panneau(`Modifier la villa ${v.lot}`, `<form id="fv" class="grid grid--1">
          <label class="field"><span>Numéro de lot <i class="req">*</i></span><input name="lot" value="${esc(v.lot)}"></label>
          <label class="field"><span>Type</span><input name="type" value="${esc(v.type || "")}" placeholder="Ex. Duplex 5 pièces"></label>
          <div class="grid"><label class="field"><span>Surface (m²)</span><input name="surface" inputmode="decimal" value="${v.surface || ""}"></label><label class="field"><span>Budget prévu</span><input name="budget" inputmode="numeric" value="${v.budget || ""}"></label></div>
          <div class="grid"><label class="field"><span>Niveau de livraison</span><select name="niveau">${opts(NIVEAUX, v.niveau)}</select></label><label class="field"><span>Gamme de finitions</span><select name="gamme">${opts(GAMMES, v.gamme)}</select></label></div>
          <label class="field"><span>Fiche maison liée (vente ou location, facultatif)</span><select name="maisonId"><option value="">— Aucune —</option>${(d.maisons || []).map((x) => `<option value="${x.id}"${x.id === v.maisonId ? " selected" : ""}>${esc(`${x.programme} · lot ${x.lot}${x.clientNom ? " · " + x.clientNom : ""}`)}</option>`).join("")}</select></label>
          <label class="field"><span>Notes</span><textarea name="notes" rows="3">${esc(v.notes || "")}</textarea></label></form>`,
        { sous: esc(c.nom), pied: `<button type="button" class="btn btn--danger" id="delV">${I("trash")}Supprimer</button><button type="button" class="btn btn--primary" id="saveV">${I("check")}Enregistrer</button>` });
      $("#saveV", pn).onclick = async () => {
        const x = Object.fromEntries(new FormData($("#fv", pn))); if (!x.lot.trim()) return toast("Le numéro de lot est obligatoire.", true);
        try { await api(`/api/g/villas/${v.id}`, { method: "PUT", body: { ...x, surface: num(x.surface), budget: num(x.budget) } }); fermerPanneau(); toast("Villa enregistrée"); views["g-villa"](v.id); } catch (err) { fail(err); }
      };
      $("#delV", pn).onclick = async () => { if (!confirm(`Supprimer définitivement la villa ${v.lot} ? Ses dépenses restent enregistrées.`)) return; try { await api(`/api/g/villas/${v.id}`, { method: "DELETE" }); fermerPanneau(); toast("Villa supprimée"); location.hash = `#g-chantier/${c.id}`; } catch (err) { fail(err); } };
    };
  };
})();
