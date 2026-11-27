/* GEI Gestion — volet Construction, étape 3 : fiche Programme (grille des villas), ajout de villas, fiche villa simple. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G || !G.construction) return;
  const { api, esc, toast, fail, views, main, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a), K = G.construction;
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const argent = () => G.me().role !== "chef";
  const opts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const NIVEAUX = { cle_en_main: "Clé en main", gros_oeuvre: "Gros œuvre" };
  const GAMMES = { standard: "Standard", confort: "Confort", premium: "Premium" };
  const CAT = { materiaux: "Matériaux", main_oeuvre: "Main-d'œuvre", sous_traitance: "Sous-traitance", transport: "Transport", location: "Engins et outillage", frais_chantier: "Frais de chantier", administratif: "Études et administratif", autre: "Divers" };
  const STATUT_PROG = { preparation: "En préparation", en_cours: "En cours", pause: "En pause", termine: "Terminé" };
  const charger = async (...n) => Object.fromEntries(await Promise.all(n.map(async (x) => [x, await api("/api/g/" + x).catch(() => [])])));
  const triLot = (a, b) => String(a.lot).localeCompare(String(b.lot), "fr", { numeric: true });
  G.construction.NIVEAUX = NIVEAUX; G.construction.GAMMES = GAMMES; G.construction.CAT = CAT;

  // Le formulaire d'origine sert à créer et à modifier un programme ; la fiche Programme devient la vue par défaut
  const formulaireProgramme = views["g-chantier"];
  views["g-chantier"] = async (arg) => {
    const a = String(arg || "");
    if (a === "nouveau" || a === "nouveau-particulier" || a.includes("/etape/")) return formulaireProgramme(a);
    if (a.endsWith("/modifier")) return formulaireProgramme(a.replace(/\/modifier$/, ""));
    return fiche(a.split("/")[0]);
  };

  async function fiche(cid) {
    const d = await charger("chantiers", "villas", "articles", "stock", "ouvriers", "pointages", ...(argent() ? ["depenses", "maisons"] : []));
    if (!d.depenses) d.depenses = [];
    if (!d.maisons) d.maisons = [];
    const c = d.chantiers.find((x) => x.id === cid);
    if (!c) { main.innerHTML = U.vide("Programme introuvable.", "hardhat"); return; }
    // Chantier de particulier : pas de villas, sa fiche est le formulaire complet (étapes, photos, client et paiements)
    if (c.nature === "particulier") return formulaireProgramme(c.id);
    const vs = d.villas.filter((v) => v.chantierId === c.id).sort(triLot);
    const av = K.avancementProgramme(c, d.villas), alertes = K.alertesProgramme(c, d);
    const n = { demarrer: 0, encours: 0, terminee: 0, retard: 0 }; vs.forEach((v) => n[K.etatVilla(v)]++);
    const dates = [c.dateDebut && `début ${U.dateFr(c.dateDebut)}`, c.dateFin && `livraison prévue ${U.dateFr(c.dateFin)}`].filter(Boolean).join(" · ");
    let chiffres;
    if (argent()) {
      const dep = G.calc.depenseChantier(c, d), p = c.budget ? Math.round(dep / c.budget * 100) : 0;
      chiffres = `<div class="kpi"><small>Avancement global</small><b>${av} %</b><div class="progress"><i style="width:${av}%"></i></div></div>
        <div class="kpi${p > 100 ? " kpi--alert" : ""}"><small>Dépensé</small><b>${U.money(dep)}</b><span>${c.budget ? `${p} % du budget de ${fcfa(c.budget)}` : "budget à définir"}</span></div>
        <div class="kpi"><small>Reste du budget</small><b class="${c.budget && dep > c.budget ? "t-bad" : ""}">${c.budget ? U.money(c.budget - dep) : "—"}</b><span>${vs.length} villa(s)</span></div>`;
    } else {
      chiffres = `<div class="kpi"><small>Avancement global</small><b>${av} %</b><div class="progress"><i style="width:${av}%"></i></div></div>
        <div class="kpi"><small>Villas en cours</small><b>${n.encours + n.retard}</b><span>${n.retard ? `dont ${n.retard} en retard` : "aucun retard"}</span></div>
        <div class="kpi"><small>Villas terminées</small><b>${n.terminee}</b><span>sur ${vs.length}</span></div>`;
    }
    const menu = argent() ? `<details class="menu-p"><summary class="btn btn--tertiary btn--icon" aria-label="Autres actions" title="Autres actions">${I("more")}</summary><div class="menu-p__pop">
        <a href="#g-chantier/${c.id}/modifier">${I("pencil")}Modifier le programme</a>
        <button type="button" id="archiver">${I("check")}${c.statut === "termine" ? "Réactiver le programme" : "Archiver (terminé)"}</button>
        <button type="button" id="xpvp">${I("printer")}Villas : PDF</button><button type="button" id="xpv">${I("sheet")}Villas : Excel</button></div></details>` : "";
    const actions = argent() ? `${menu}<a class="btn btn--secondary" href="#g-depense/nouvelle/${c.id}">${I("receipt")}Nouvelle dépense</a><button type="button" class="btn btn--primary" id="addV">${I("plus")}Ajouter des villas</button>` : "";
    main.innerHTML = U.head(esc(c.nom), `${esc(STATUT_PROG[c.statut] || c.statut)}${c.lieu ? " · " + esc(c.lieu) : ""}${dates ? " · " + dates : ""}`, actions, [["Chantiers", "#g-chantiers"], [esc(c.nom), ""]]) + `
      ${alertes.length ? `<p class="prog__msg prog__msg--page">${I("alertcircle")}${esc(alertes.join(" · "))}</p>` : ""}
      <div class="kpis kpis--3">${chiffres}</div>
      <section class="panel">
        <div class="vgrid__head"><h2>Villas</h2><div class="vlegende">${Object.entries(K.ETATS).map(([k, l]) => `<span><i class="vt-dot vt-dot--${k}"></i>${l} <b>${n[k]}</b></span>`).join("")}</div></div>
        ${vs.length ? `<div class="vgrid">${vs.map((v) => tuile(v, d)).join("")}</div>` : U.vide(argent() ? "Aucune villa pour le moment. Cliquez sur « Ajouter des villas » : une seule, ou une série (A01 à A20) en une fois." : "Aucune villa pour le moment.", "house")}
      </section>
      <div id="progPlus"></div>
      ${onglets(c, d)}`;
    if (K.progPlus) K.progPlus(c, vs, d);
    if ($("#addV")) $("#addV").onclick = () => ajouterVillas(c, vs, () => fiche(c.id));
    if ($("#archiver")) $("#archiver").onclick = async () => {
      const fin = c.statut !== "termine"; if (!confirm(fin ? "Marquer ce programme comme terminé ? Il restera consultable." : "Remettre ce programme en cours ?")) return;
      try { await api(`/api/g/chantiers/${c.id}`, { method: "PUT", body: { statut: fin ? "termine" : "en_cours" } }); toast(fin ? "Programme archivé" : "Programme réactivé"); fiche(c.id); } catch (err) { fail(err); }
    };
    const xpVillas = (format) => G.calc.exporter(`Villas ${c.nom}`, [["Lot", (v) => v.lot], ["Type", (v) => v.type], ["Surface m²", (v) => v.surface || ""], ["Niveau", (v) => NIVEAUX[v.niveau]], ["Gamme", (v) => GAMMES[v.gamme]],
      ["Avancement %", K.avancementVilla], ["Phase en cours", K.phaseEnCours], ["État", (v) => K.ETATS[K.etatVilla(v)]], ["Budget", (v) => v.budget || ""]], vs, format, { titre: `Villas du programme ${c.nom}`, filtres: `Programme : ${c.nom}` });
    if ($("#xpv")) $("#xpv").onclick = () => xpVillas("xlsx");
    if ($("#xpvp")) $("#xpvp").onclick = () => xpVillas("pdf");
  }

  function tuile(v, d) {
    const e = K.etatVilla(v), a = K.avancementVilla(v), m = (d.maisons || []).find((x) => x.id === v.maisonId);
    return `<a class="vt vt--${e}" href="#g-villa/${v.id}" title="${esc(`${v.lot} · ${K.ETATS[e]} · ${K.phaseEnCours(v)}`)}">
      <span class="vt__lot">${esc(v.lot)}</span>
      <span class="vt__type">${esc(v.type || "Type à préciser")}</span>
      <span class="vt__niv">${v.niveau === "gros_oeuvre" ? "Gros œuvre" : "Clé en main"}${m && m.clientNom ? " · " + esc(m.clientNom) : ""}</span>
      <span class="vt__pct"><b>${a} %</b><i style="--p:${a}%"></i></span>
    </a>`;
  }

  function onglets(c, d) {
    const blocs = [];
    if (argent()) {
      const communes = d.depenses.filter((x) => x.chantierId === c.id && !x.villaId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const total = sum(communes, (x) => x.montant), reste = sum(communes, (x) => (G.resteDep ? G.resteDep(x) : 0));
      blocs.push(`<details class="onglet"><summary>${I("chevright")}<b>Dépenses communes du programme</b><span class="muted">${communes.length} · ${fcfa(total)}${reste ? ` · reste à payer ${fcfa(reste)}` : ""}</span></summary>
        <p class="t-help">Clôture, gardiennage, VRD, études… : les dépenses sans villa précise. Elles seront réparties entre les villas pour calculer leur coût réel.</p>
        ${communes.length ? U.tableau([["Date", (x) => U.dateFr(x.date)], ["Libellé", (x) => `<b>${esc(x.libelle)}</b>${x.fournisseur ? `<br><small class="muted">${esc(x.fournisseur)}</small>` : ""}`], ["Catégorie", (x) => esc(CAT[x.categorie] || x.categorie)],
          ["Montant", (x) => fcfa(x.montant), 1], ["Reste", (x) => { const r = G.resteDep ? G.resteDep(x) : 0; return r ? `<b class="t-bad">${fcfa(r)}</b>` : "—"; }, 1]], communes, (x) => `#g-depense/${x.id}`) : '<p class="muted">Aucune dépense commune pour le moment.</p>'}
        <div class="pay-actions"><a class="btn btn--secondary btn--sm" href="#g-depense/nouvelle/${c.id}">${I("plus")}Nouvelle dépense commune</a></div></details>`);
    }
    const mv = (d.stock || []).filter((s) => s.chantierId === c.id);
    const art = (id) => (d.articles || []).find((a) => a.id === id) || { nom: "?", unite: "" };
    const ids = [...new Set(mv.map((s) => s.articleId))];
    blocs.push(`<details class="onglet"><summary>${I("chevright")}<b>Stock du chantier</b><span class="muted">${ids.length} matériau(x) · ${mv.length} mouvement(s)</span></summary>
      ${mv.length ? `<div class="tbl-wrap"><table class="tbl" data-nopage><thead><tr><th>Matériau</th><th class="num">Entré</th><th class="num">Sorti</th><th class="num">Reste</th></tr></thead><tbody>${ids.map((id) => {
        const a = art(id), e = sum(mv.filter((s) => s.articleId === id && s.sens === "entree"), (s) => s.quantite), so = sum(mv.filter((s) => s.articleId === id && s.sens === "sortie"), (s) => s.quantite), r = Math.round((e - so) * 100) / 100;
        return `<tr><td><b>${esc(a.nom)}</b></td><td class="num">${e} ${esc(a.unite)}</td><td class="num">${so} ${esc(a.unite)}</td><td class="num"><b class="${a.seuil && r <= a.seuil ? "t-bad" : ""}">${r} ${esc(a.unite)}</b></td></tr>`; }).join("")}</tbody></table></div>` : '<p class="muted">Aucun mouvement de stock sur ce programme pour le moment.</p>'}
      <div class="pay-actions"><a class="btn btn--secondary btn--sm" href="#g-stock/mouvement">${I("package")}Entrée / sortie de stock</a></div></details>`);
    if (argent()) blocs.push(`<details class="onglet"><summary>${I("chevright")}<b>Documents</b><span class="muted">${(c.documents || []).length} document(s)</span></summary>
      ${(c.documents || []).length ? `<ul class="docs">${c.documents.map((x) => `<li><a href="/api/g/fichiers/${esc(x.fichier)}" target="_blank" rel="noopener">${I(/\.pdf$/.test(x.fichier) ? "file" : "image")} ${esc(x.nom || x.fichier)}</a> <span class="muted">${x.date ? U.dateFr(x.date) : ""}</span></li>`).join("")}</ul>` : '<p class="muted">Aucun document (plans, permis, contrats…).</p>'}
      <div class="pay-actions"><a class="btn btn--secondary btn--sm" href="#g-chantier/${c.id}/modifier">${I("upload")}Ajouter des documents</a></div></details>`);
    return `<div class="onglets">${blocs.join("")}</div>`;
  }

  /* ---------- Ajouter des villas : une seule, ou une série (A01 à A20) ---------- */
  function ajouterVillas(c, existantes, apres) {
    const dlg = document.createElement("dialog"); dlg.className = "enc";
    dlg.innerHTML = `<form method="dialog" class="enc__f"><h2>Ajouter des villas</h2><p class="muted">${esc(c.nom)}</p>
      <div class="seg" role="group" aria-label="Mode"><button type="button" data-mode="serie" class="is-on">En série</button><button type="button" data-mode="une">Une villa</button></div>
      <div data-bloc="serie" class="grid grid--3c"><label class="field"><span>Préfixe</span><input name="prefixe" value="A" maxlength="6"></label><label class="field"><span>Du n°</span><input name="de" inputmode="numeric" value="${existantes.length + 1}"></label><label class="field"><span>Au n°</span><input name="a" inputmode="numeric" value="${existantes.length + 20}"></label></div>
      <div data-bloc="une" hidden><label class="field"><span>Numéro de lot</span><input name="lot" placeholder="Ex. A21"></label></div>
      <label class="field"><span>Type</span><input name="type" placeholder="Ex. Duplex 5 pièces" list="vtypes"><datalist id="vtypes">${[...new Set(existantes.map((v) => v.type).filter(Boolean))].map((t) => `<option value="${esc(t)}">`).join("")}</datalist></label>
      <div class="grid"><label class="field"><span>Surface (m²)</span><input name="surface" inputmode="decimal" placeholder="Ex. 150"></label><label class="field"><span>Budget par villa</span><input name="budget" inputmode="numeric" placeholder="Ex. 30000000"></label></div>
      <div class="grid"><label class="field"><span>Niveau de livraison</span><select name="niveau">${opts(NIVEAUX, "cle_en_main")}</select></label><label class="field"><span>Gamme de finitions</span><select name="gamme">${opts(GAMMES, "standard")}</select></label></div>
      <p class="t-help" id="apercu"></p>
      <div class="enc__acts"><button type="button" class="btn btn--secondary" data-x>Annuler</button><button type="submit" class="btn btn--primary">${I("plus")}Créer</button></div></form>`;
    document.body.appendChild(dlg); dlg.showModal();
    const f = $("form", dlg); let mode = "serie";
    const lots = () => {
      if (mode === "une") return f.lot.value.trim() ? [f.lot.value.trim().toUpperCase()] : [];
      const de = Math.max(0, Math.round(num(f.de.value))), a = Math.round(num(f.a.value)), larg = Math.max(2, String(a).length);
      if (!de || a < de || a - de > 199) return [];
      return Array.from({ length: a - de + 1 }, (_, i) => `${f.prefixe.value.trim().toUpperCase()}${String(de + i).padStart(larg, "0")}`);
    };
    const existe = new Set(existantes.map((v) => String(v.lot).toUpperCase()));
    const majApercu = () => {
      const l = lots(), dbl = l.filter((x) => existe.has(x)), nv = l.filter((x) => !existe.has(x));
      $("#apercu", dlg).innerHTML = !l.length ? "Indiquez les numéros de lot." : `${nv.length ? `Va créer <b>${nv.length}</b> villa(s) : ${esc(nv.length > 6 ? `${nv[0]}, ${nv[1]} … ${nv[nv.length - 1]}` : nv.join(", "))}.` : "Aucune nouvelle villa."}${dbl.length ? ` <span class="t-warn">${dbl.length} lot(s) existent déjà et seront ignorés.</span>` : ""} Les 10 phases sont ajoutées automatiquement.`;
    };
    $$("[data-mode]", dlg).forEach((b) => (b.onclick = () => { mode = b.dataset.mode; $$("[data-mode]", dlg).forEach((x) => x.classList.toggle("is-on", x === b)); $$("[data-bloc]", dlg).forEach((x) => { x.hidden = x.dataset.bloc !== mode; }); majApercu(); }));
    f.addEventListener("input", majApercu); majApercu();
    $("[data-x]", dlg).onclick = () => dlg.close();
    dlg.addEventListener("close", () => setTimeout(() => dlg.remove(), 50));
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nv = lots().filter((x) => !existe.has(x)); if (!nv.length) return toast("Aucune villa à créer : vérifiez les numéros de lot.", true);
      const base = { chantierId: c.id, type: f.type.value.trim(), surface: num(f.surface.value), budget: num(f.budget.value), niveau: f.niveau.value, gamme: f.gamme.value };
      const btn = $("button[type=submit]", f); btn.disabled = true; let ok = 0;
      try { for (const lot of nv) { await api("/api/g/villas", { method: "POST", body: { ...base, lot } }); ok++; btn.textContent = `Création… ${ok}/${nv.length}`; } dlg.close(); toast(`${ok} villa(s) créée(s)`); apres(); }
      catch (err) { fail(err); btn.disabled = false; if (ok) toast(`${ok} villa(s) créée(s) avant l'erreur`, true); }
    });
  }

  /* ---------- Fiche villa (étape 3 : résumé ; phases détaillées, finitions et dépenses aux étapes suivantes) ---------- */
  views["g-villa"] = async (arg) => {
    const vid = String(arg || "").split("/")[0];
    const d = await charger("villas", "chantiers", ...(argent() ? ["maisons"] : []));
    const v = d.villas.find((x) => x.id === vid);
    if (!v) { main.innerHTML = U.vide("Villa introuvable.", "house"); return; }
    const c = d.chantiers.find((x) => x.id === v.chantierId) || { nom: "Programme", id: v.chantierId };
    const e = K.etatVilla(v), a = K.avancementVilla(v), ro = !argent();
    main.innerHTML = U.head(`Villa ${esc(v.lot)}`, `${esc(c.nom)} · ${esc(K.ETATS[e])} · ${a} % · phase : ${esc(K.phaseEnCours(v))}`,
      `<a class="btn btn--tertiary" href="#g-chantier/${c.id}">${I("chevleft")}Retour au programme</a>`, [["Chantiers", "#g-chantiers"], [esc(c.nom), `#g-chantier/${c.id}`], [`Villa ${esc(v.lot)}`, ""]]) + `
      <form class="form" id="fv" novalidate><section class="panel"><div class="sec__head"><span class="sec__n">1</span><div><h2>Résumé</h2><p>Lot, type, surface, niveau de livraison et gamme de finitions.</p></div></div>
        <div class="grid">
          <label><span>Numéro de lot <i class="req">*</i></span><input name="lot" value="${esc(v.lot)}"${ro ? " readonly" : ""}></label>
          <label><span>Type</span><input name="type" value="${esc(v.type || "")}" placeholder="Ex. Duplex 5 pièces"${ro ? " readonly" : ""}></label>
          <label><span>Surface (m²)</span><input name="surface" inputmode="decimal" value="${v.surface || ""}"${ro ? " readonly" : ""}></label>
          <label><span>Niveau de livraison</span><select name="niveau"${ro ? " disabled" : ""}>${opts(NIVEAUX, v.niveau)}</select></label>
          <label><span>Gamme de finitions</span><select name="gamme"${ro ? " disabled" : ""}>${opts(GAMMES, v.gamme)}</select></label>
          ${argent() ? `<label><span>Budget prévu</span><input name="budget" class="money" inputmode="numeric" value="${v.budget || ""}"></label>
          <label class="full"><span>Fiche maison liée (vente ou location, facultatif)</span><select name="maisonId"><option value="">— Aucune —</option>${(d.maisons || []).map((m) => `<option value="${m.id}"${m.id === v.maisonId ? " selected" : ""}>${esc(`${m.programme} · lot ${m.lot}${m.clientNom ? " · " + m.clientNom : ""}`)}</option>`).join("")}</select></label>` : ""}
          <label class="full"><span>Notes</span><textarea name="notes" rows="2"${ro ? " readonly" : ""}>${esc(v.notes || "")}</textarea></label>
        </div></section>
        <section class="panel"><div class="sec__head"><span class="sec__n">2</span><div><h2>Phases</h2><p>Avancement de chaque phase. La mise à jour détaillée et les photos arrivent à l'étape suivante.</p></div></div>
          <ul class="vphases">${K.phasesUtiles(v).map((p) => `<li class="${p.avancement >= 100 ? "is-ok" : ""}"><span>${p.avancement >= 100 ? I("check") : ""}</span><b>${esc(p.nom)}</b><em>${p.avancement} %</em></li>`).join("")}</ul></section>
        ${ro ? "" : `<div class="savebar"><button type="button" class="btn btn--danger" id="delV">${I("trash")}Supprimer</button><button type="submit" class="btn btn--primary">${I("check")}Enregistrer</button></div>`}
      </form>`;
    const f = $("#fv"); f.addEventListener("input", () => G.setDirty(true));
    if (ro) return;
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault(); const x = Object.fromEntries(new FormData(f));
      if (!x.lot.trim()) return toast("Le numéro de lot est obligatoire.", true);
      try { await api(`/api/g/villas/${v.id}`, { method: "PUT", body: { ...x, surface: num(x.surface), budget: num(x.budget) } }); G.setDirty(false); toast("Villa enregistrée"); views["g-villa"](v.id); } catch (err) { fail(err); }
    });
    $("#delV").onclick = async () => { if (!confirm(`Supprimer définitivement la villa ${v.lot} ? Ses dépenses restent enregistrées.`)) return; try { await api(`/api/g/villas/${v.id}`, { method: "DELETE" }); G.setDirty(false); toast("Villa supprimée"); location.hash = `#g-chantier/${c.id}`; } catch (err) { fail(err); } };
  };
})();
