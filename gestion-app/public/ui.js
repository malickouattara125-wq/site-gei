/* GEI Gestion — interface : composants partagés (en-têtes, tableaux, badges, montants),
   champs stylés (calendrier jj/mm/aaaa, listes avec recherche, montants avec séparateur),
   recherche globale (Ctrl+K), notifications, thème clair/sombre, menu rétractable.
   Ne touche à aucune donnée : les champs d'origine restent dans le formulaire (cachés) et gardent leur nom et leur valeur. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G) return;
  const { esc, $, $$, main } = G;
  const I = (n, c = "") => window.GEI_ICON(n, c);
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

  /* ---------- Formats ---------- */
  const sep = (n) => Math.round(+n || 0).toLocaleString("fr-FR").replace(/[  ]/g, " ");
  const money = (n, unit = "FCFA") => `<span class="num">${sep(n)}<span class="cur">${unit}</span></span>`;
  const dateFr = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  /* ---------- Briques d'écran partagées ---------- */
  const texte = (h) => String(h).replace(/<[^>]*>/g, "").trim();
  // En-tête de page : titre, sous-titre, actions, fil d'Ariane [[libellé, lien], …]
  const PARENTS = { "g-chantier": ["Chantiers", "#g-chantiers"], "g-maison": ["Maisons et clients", "#g-maisons"], "g-depense": ["Dépenses", "#g-depenses"], "g-ouvrier": ["Équipes et paie", "#g-equipes/ouvriers"], "g-article": ["Stock de matériaux", "#g-stock"], "g-mouvement": ["Trésorerie", "#g-tresorerie"] };
  const GROUPES = { gestion: "Pilotage", "g-planning": "Pilotage", "g-rapport": "Pilotage", "g-chantiers": "Opérations", "g-maisons": "Opérations", "g-stock": "Opérations", "g-equipes": "Opérations", "g-depenses": "Finances", "g-tresorerie": "Finances", "g-import": "Paramètres", compte: "Paramètres" };
  function autoCrumbs(titre) {
    const v = (location.hash.slice(1) || "gestion").split("/")[0];
    if (PARENTS[v]) return [PARENTS[v], [texte(titre), ""]];
    if (GROUPES[v]) return [[GROUPES[v], ""], [texte(titre), ""]];
    return null;
  }
  const embellir = (a) => String(a).replace(/(<(?:button|a)\b[^>]*>)← Retour</g, (m, t) => `${t}${I("chevleft")}Retour<`).replace(/(<(?:button|a)\b[^>]*>)\+ /g, (m, t) => `${t}${I("plus")}`)
    .replace(/(<(?:button|a)\b[^>]*>)Exporter \(Excel\)</g, (m, t) => `${t}${I("download")}Exporter (Excel)<`).replace(/btn btn--text" href/g, 'btn btn--tertiary" href').replace(/btn--ghost/g, "btn--secondary");
  const head = (titre, sous, actions = "", crumbs) => { crumbs = crumbs || autoCrumbs(titre); actions = embellir(actions); return headHtml(titre, sous, actions, crumbs); };
  const headHtml = (titre, sous, actions, crumbs) => `<div class="top">${crumbs ? `<nav class="crumb" aria-label="Fil d'Ariane">${crumbs.map(([l, h], i) => (i < crumbs.length - 1 ? (h ? `<a href="${h}">${l}</a>` : `<span>${l}</span>`) + I("chevright") : `<b>${l}</b>`)).join("")}</nav>` : ""}
    <div class="top__row"><div class="top__txt"><h1>${titre}</h1>${sous ? `<p>${sous}</p>` : ""}</div><div class="top__actions">${actions}</div></div></div>`;
  const vide = (texte = "Rien pour le moment.", icone = "inbox") => `<div class="empty-state"><span class="empty-state__ic">${I(icone, "ic--20")}</span><p>${texte}</p></div>`;
  // Tableau : colonnes [[titre, rendu, numérique?]], lignes, lien de la ligne, pied
  const tableau = (cols, rows, href, foot) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th${c[2] ? ' class="num"' : ""}>${c[0]}</th>`).join("")}${href ? '<th class="acts-h" aria-label="Actions"></th>' : ""}</tr></thead>
    <tbody>${rows.map((r) => `<tr${href ? ` data-href="${esc(href(r))}"` : ""}>${cols.map((c) => `<td${c[2] ? ' class="num"' : ""} data-label="${esc(texte(c[0]))}"><span class="td">${c[1](r)}</span></td>`).join("")}${href ? `<td class="acts"><a class="btn btn--tertiary btn--sm btn--icon" href="${esc(href(r))}" aria-label="Ouvrir">${I("chevright")}</a></td>` : ""}</tr>`).join("") || `<tr class="tr-empty"><td colspan="${cols.length + (href ? 1 : 0)}">${vide()}</td></tr>`}</tbody>
    ${foot ? `<tfoot><tr>${foot.map((f, i) => `<td${cols[i] && cols[i][2] ? ' class="num"' : ""} data-label="${i && cols[i] ? esc(texte(cols[i][0])) : ""}">${f}</td>`).join("")}${href ? "<td></td>" : ""}</tr></tfoot>` : ""}</table></div>`;
  // Mini-courbe (sparkline)
  const spark = (vals, cls = "") => {
    const v = vals.length > 1 ? vals : [0, ...(vals.length ? vals : [0])];
    const max = Math.max(...v), min = Math.min(...v), k = max - min || 1;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * 96).toFixed(1)},${(28 - (x - min) / k * 24).toFixed(1)}`);
    return `<svg class="spark ${cls}" viewBox="0 0 96 32" aria-hidden="true"><polyline points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="96" cy="${pts[pts.length - 1].split(",")[1]}" r="2.5" fill="currentColor"/></svg>`;
  };
  // Variation : +12 % (sens : « bon » si hausse = bien)
  const delta = (txt, bon) => `<span class="delta ${bon === null ? "delta--flat" : bon ? "delta--up" : "delta--down"}">${txt}</span>`;
  const ring = (p) => `<div class="ring" style="--p:${Math.max(0, Math.min(100, p))}"><span>${Math.round(p)}%</span></div>`;

  /* ---------- Compteurs animés ---------- */
  function compteurs(root) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    $$("[data-count]", root).forEach((el) => {
      const fin = +el.dataset.count; if (!isFinite(fin) || el.dataset.done) return; el.dataset.done = 1;
      const txt = el.firstChild; if (!txt || txt.nodeType !== 3) return;
      const t0 = performance.now(), dur = 700;
      const step = (t) => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); txt.nodeValue = sep(fin * e); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  /* ---------- Fenêtres flottantes (calendrier, listes) ---------- */
  let pop = null, popAnchor = null, popClose = null;
  function openPop(anchor, html, onClose) {
    closePop();
    pop = document.createElement("div"); pop.className = "pop pop--float"; pop.innerHTML = html; document.body.appendChild(pop);
    popAnchor = anchor; popClose = onClose; placePop();
    requestAnimationFrame(() => pop && pop.classList.add("is-on"));
    return pop;
  }
  function placePop() {
    if (!pop || !popAnchor) return;
    const r = popAnchor.getBoundingClientRect(), w = Math.max(r.width, pop.dataset.w ? +pop.dataset.w : 0);
    pop.style.minWidth = Math.min(w, innerWidth - 24) + "px";
    const h = pop.offsetHeight, below = innerHeight - r.bottom;
    pop.style.left = Math.max(12, Math.min(r.left, innerWidth - pop.offsetWidth - 12)) + "px";
    pop.style.top = (below < h + 12 && r.top > h + 12 ? r.top - h - 6 : r.bottom + 6) + "px";
  }
  function closePop() { if (!pop) return; const cb = popClose; pop.remove(); pop = null; popAnchor = null; popClose = null; cb && cb(); }
  addEventListener("resize", placePop); addEventListener("scroll", placePop, true);
  document.addEventListener("mousedown", (e) => { if (pop && !pop.contains(e.target) && popAnchor && !popAnchor.contains(e.target)) closePop(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && pop) { closePop(); e.stopPropagation(); } });
  const fire = (el) => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };

  /* ---------- Calendrier (format jj/mm/aaaa) ---------- */
  function datePicker(orig) {
    if (orig.dataset.ui) return; orig.dataset.ui = "1";
    const ro = orig.readOnly || orig.disabled;
    const wrap = document.createElement("div"); wrap.className = "ig dp";
    const shown = document.createElement("input");
    shown.type = "text"; shown.inputMode = "numeric"; shown.placeholder = "jj/mm/aaaa"; shown.autocomplete = "off"; shown.className = "dp__in";
    shown.setAttribute("aria-label", orig.getAttribute("aria-label") || (orig.closest("label") && orig.closest("label").querySelector("span") ? orig.closest("label").querySelector("span").textContent : "Date"));
    if (ro) shown.readOnly = true;
    orig.parentNode.insertBefore(wrap, orig);
    wrap.insertAdjacentHTML("afterbegin", I("calendar"));
    wrap.appendChild(shown); wrap.appendChild(orig);
    orig.type = "hidden";
    const sync = () => { shown.value = dateFr(orig.value); };
    sync(); orig.addEventListener("change", sync);
    const set = (v) => { if (orig.value === v) { sync(); return; } orig.value = v; sync(); fire(orig); };
    const parse = () => {
      const m = shown.value.trim().match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2,4})$/);
      if (!shown.value.trim()) return set("");
      if (!m) return sync();
      const y = m[3].length === 2 ? 2000 + +m[3] : +m[3], d = new Date(y, +m[2] - 1, +m[1]);
      if (d.getDate() !== +m[1]) return sync();
      set(iso(d));
    };
    shown.addEventListener("input", () => { // saisie guidée : ajoute les « / »
      const d = shown.value.replace(/\D/g, "").slice(0, 8);
      shown.value = [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/");
      if (d.length === 8) parse();
    });
    shown.addEventListener("blur", () => setTimeout(() => { if (!pop || popAnchor !== wrap) parse(); }, 120));
    shown.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); parse(); closePop(); } if (e.key === "ArrowDown") { e.preventDefault(); open(); } });
    if (ro) return;
    let vue;
    const draw = (p) => {
      const sel = orig.value, today = iso(new Date());
      const first = new Date(vue.getFullYear(), vue.getMonth(), 1), off = (first.getDay() + 6) % 7;
      let h = `<div class="cal__head"><button type="button" class="btn btn--tertiary btn--sm btn--icon" data-m="-1" aria-label="Mois précédent">${I("chevleft")}</button><span>${MOIS[vue.getMonth()]} ${vue.getFullYear()}</span><button type="button" class="btn btn--tertiary btn--sm btn--icon" data-m="1" aria-label="Mois suivant">${I("chevright")}</button></div><div class="cal__grid">`;
      h += ["L", "M", "M", "J", "V", "S", "D"].map((j) => `<b>${j}</b>`).join("");
      for (let i = 0; i < 42; i++) {
        const d = new Date(vue.getFullYear(), vue.getMonth(), 1 - off + i), v = iso(d);
        if (i >= 35 && d.getMonth() !== vue.getMonth()) break;
        h += `<button type="button" data-d="${v}" class="${d.getMonth() !== vue.getMonth() ? "is-out " : ""}${v === today ? "is-today " : ""}${v === sel ? "is-sel" : ""}">${d.getDate()}</button>`;
      }
      h += `</div><div class="cal__foot"><button type="button" class="btn btn--tertiary btn--sm" data-clear>Effacer</button><button type="button" class="btn btn--secondary btn--sm" data-d="${today}">Aujourd'hui</button></div>`;
      p.innerHTML = h;
    };
    const open = () => {
      if (pop && popAnchor === wrap) return;
      vue = orig.value ? new Date(orig.value + "T12:00:00") : new Date(); vue.setDate(1);
      const p = openPop(wrap, ""); p.classList.add("cal"); draw(p); placePop();
      p.addEventListener("mousedown", (e) => e.preventDefault());
      p.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.m) { vue.setMonth(vue.getMonth() + +b.dataset.m); draw(p); placePop(); return; }
        if (b.hasAttribute("data-clear")) { set(""); closePop(); return; }
        if (b.dataset.d) { set(b.dataset.d); closePop(); }
      });
    };
    shown.addEventListener("click", open);
    shown.addEventListener("focus", open);
  }

  /* ---------- Liste déroulante stylée (avec recherche) ---------- */
  function selectBox(sel) {
    if (sel.dataset.ui || sel.multiple) return; sel.dataset.ui = "1";
    const wrap = document.createElement("div"); wrap.className = "ig sb";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "input sb__btn";
    btn.setAttribute("aria-haspopup", "listbox");
    const lab = sel.closest("label"); if (lab && lab.querySelector("span")) btn.setAttribute("aria-label", lab.querySelector("span").textContent);
    else if (sel.getAttribute("aria-label")) btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(btn); wrap.appendChild(sel);
    wrap.insertAdjacentHTML("beforeend", I("chevdown", "ig__chev"));
    sel.classList.add("sb__native"); sel.tabIndex = -1;
    if (sel.disabled) btn.disabled = true;
    const isChantier = /chantier/i.test(sel.name || "") || /^chantier/i.test(((lab && lab.textContent) || "").trim());
    if (isChantier) { wrap.classList.add("sb--icon"); wrap.insertAdjacentHTML("afterbegin", I("hardhat")); }
    const sync = () => { const o = sel.options[sel.selectedIndex]; btn.textContent = o ? o.textContent : ""; btn.classList.toggle("is-ph", !o || !o.value); };
    sync(); sel.addEventListener("change", sync);
    const open = () => {
      if (pop && popAnchor === wrap) return closePop();
      const items = [...sel.options].map((o, i) => ({ i, v: o.value, t: o.textContent }));
      const cherche = isChantier || items.length > 7;
      const p = openPop(wrap, `${cherche ? `<div class="ig pop__search">${I("search")}<input type="text" placeholder="Rechercher…" aria-label="Rechercher"></div>` : ""}<div class="pop__list" role="listbox"></div>`);
      let act = Math.max(0, sel.selectedIndex);
      const list = $(".pop__list", p), q = $("input", p);
      const draw = () => {
        const s = q ? q.value.trim().toLowerCase() : "";
        const vis = items.filter((x) => !s || x.t.toLowerCase().includes(s));
        if (!vis.find((x) => x.i === act) && vis.length) act = vis[0].i;
        list.innerHTML = vis.map((x) => `<div class="opt${x.i === sel.selectedIndex ? " is-sel" : ""}${x.i === act ? " is-active" : ""}${x.v ? "" : " is-ph"}" role="option" data-i="${x.i}" aria-selected="${x.i === sel.selectedIndex}">${esc(x.t)}${x.i === sel.selectedIndex ? I("check") : ""}</div>`).join("") || '<p class="pop__none">Aucun résultat</p>';
        const a = $(".is-active", list); if (a) a.scrollIntoView({ block: "nearest" });
      };
      const choose = (i) => { if (sel.selectedIndex !== i) { sel.selectedIndex = i; fire(sel); } sync(); closePop(); btn.focus(); };
      draw();
      p.addEventListener("mousedown", (e) => { if (!e.target.closest("input")) e.preventDefault(); });
      list.addEventListener("click", (e) => { const o = e.target.closest("[data-i]"); if (o) choose(+o.dataset.i); });
      const keys = (e) => {
        const vis = $$("[data-i]", list).map((o) => +o.dataset.i), k = vis.indexOf(act);
        if (e.key === "ArrowDown") { e.preventDefault(); act = vis[Math.min(vis.length - 1, k + 1)]; draw(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); act = vis[Math.max(0, k - 1)]; draw(); }
        else if (e.key === "Enter") { e.preventDefault(); if (vis.length) choose(act); }
        else if (e.key === "Tab") closePop();
      };
      if (q) { q.addEventListener("input", draw); q.addEventListener("keydown", keys); setTimeout(() => q.focus(), 10); }
      else { p.tabIndex = -1; p.addEventListener("keydown", keys); setTimeout(() => p.focus(), 10); }
    };
    btn.addEventListener("click", open);
    btn.addEventListener("keydown", (e) => { if (["ArrowDown", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); } });
  }

  /* ---------- Champ texte avec suggestions (fournisseur, programme, métier…) ---------- */
  function suggest(inp) {
    if (inp.dataset.ui) return; inp.dataset.ui = "1";
    const dl = document.getElementById(inp.getAttribute("list")); if (!dl) return;
    const vals = [...dl.options].map((o) => o.value).filter(Boolean);
    inp.removeAttribute("list"); inp.autocomplete = "off";
    const wrap = document.createElement("div"); wrap.className = "ig";
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
    if (/fournisseur/i.test(inp.name)) { wrap.insertAdjacentHTML("afterbegin", I("search")); }
    let act = -1;
    const draw = () => {
      const s = inp.value.trim().toLowerCase();
      const vis = vals.filter((v) => (!s || v.toLowerCase().includes(s)) && v.toLowerCase() !== s).slice(0, 8);
      if (!vis.length) { if (popAnchor === wrap) closePop(); return; }
      const p = popAnchor === wrap ? pop : openPop(wrap, '<div class="pop__list"></div>');
      p.onmousedown = (e) => e.preventDefault();
      act = Math.min(act, vis.length - 1);
      $(".pop__list", p).innerHTML = vis.map((v, i) => `<div class="opt${i === act ? " is-active" : ""}" data-v="${esc(v)}">${esc(v)}</div>`).join("");
      p.onclick = (e) => { const o = e.target.closest("[data-v]"); if (o) { inp.value = o.dataset.v; fire(inp); closePop(); } };
    };
    inp.addEventListener("focus", draw); inp.addEventListener("input", () => { act = -1; draw(); });
    inp.addEventListener("blur", () => setTimeout(() => { if (popAnchor === wrap) closePop(); }, 100));
    inp.addEventListener("keydown", (e) => {
      if (popAnchor !== wrap) return;
      const o = $$(".opt", pop);
      if (e.key === "ArrowDown") { e.preventDefault(); act = Math.min(o.length - 1, act + 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, act - 1); draw(); }
      else if (e.key === "Enter" && act >= 0 && o[act]) { e.preventDefault(); inp.value = o[act].dataset.v; fire(inp); closePop(); }
    });
  }

  /* ---------- Montants : 730 000 FCFA ---------- */
  function moneyField(inp) {
    if (inp.dataset.ui) return; inp.dataset.ui = "1";
    inp.type = "text"; inp.inputMode = "numeric"; inp.classList.add("money"); inp.autocomplete = "off";
    if (!inp.closest(".ig")) { const w = document.createElement("div"); w.className = "ig"; inp.parentNode.insertBefore(w, inp); w.appendChild(inp); w.insertAdjacentHTML("beforeend", '<span class="ig__suffix">FCFA</span>'); }
    const fmt = () => {
      const avant = inp.value, pos = inp.selectionStart == null ? avant.length : inp.selectionStart;
      const chiffresAvant = avant.slice(0, pos).replace(/\D/g, "").length;
      const d = avant.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
      const nv = d ? sep(+d) : "";
      if (nv === avant) return;
      inp.value = nv;
      if (document.activeElement === inp) { let n = 0, p = 0; while (p < nv.length && n < chiffresAvant) { if (/\d/.test(nv[p])) n++; p++; } inp.setSelectionRange(p, p); }
    };
    fmt(); inp.addEventListener("input", fmt, true);
  }

  /* ---------- Pagination automatique des longs tableaux ---------- */
  function paginer(tbl) {
    if (tbl.dataset.ui) return; tbl.dataset.ui = "1";
    const rows = $$("tbody > tr:not(.tr-empty)", tbl), N = 25;
    if (rows.length <= N) return;
    let page = 0; const pages = Math.ceil(rows.length / N);
    const bar = document.createElement("div"); bar.className = "pager";
    tbl.closest(".tbl-wrap").after(bar);
    const draw = () => {
      rows.forEach((r, i) => { r.hidden = Math.floor(i / N) !== page; });
      bar.innerHTML = `<span class="t-help">${page * N + 1}–${Math.min(rows.length, (page + 1) * N)} sur ${rows.length}</span><div><button type="button" class="btn btn--secondary btn--sm btn--icon" data-p="-1" aria-label="Page précédente"${page ? "" : " disabled"}>${I("chevleft")}</button><span class="pager__n">${page + 1} / ${pages}</span><button type="button" class="btn btn--secondary btn--sm btn--icon" data-p="1" aria-label="Page suivante"${page < pages - 1 ? "" : " disabled"}>${I("chevright")}</button></div>`;
    };
    bar.addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (!b) return; page = Math.max(0, Math.min(pages - 1, page + +b.dataset.p)); draw(); tbl.closest(".tbl-wrap").scrollIntoView({ block: "start", behavior: "smooth" }); });
    draw();
  }

  /* ---------- Application automatique sur chaque écran ---------- */
  const MONEY = 'input[inputmode=numeric]:not([data-k]):not(.dp__in), input.money, input[name=montant], input[name=budget], input[name=prix], input[name=tarifJour], input[name=prixUnitaire]';
  function enhance(root = main) {
    $$('input[type=date]', root).forEach(datePicker);
    $$("select", root).forEach(selectBox);
    $$("input[list]", root).forEach(suggest);
    $$(MONEY, root).forEach((i) => { if (i.type !== "hidden" && !i.closest(".pop")) moneyField(i); });
    $$("table.tbl", root).forEach(paginer);
    $$("button.btn, a.btn, label.btn", root).forEach((b) => { const t = b.firstChild; if (t && t.nodeType === 3 && /^\s*\+ /.test(t.nodeValue)) { t.nodeValue = t.nodeValue.replace(/^\s*\+ /, ""); b.insertAdjacentHTML("afterbegin", I("plus")); } });
    $$("input[type=number]", root).forEach((i) => { i.inputMode = i.inputMode || "decimal"; });
    compteurs(root);
  }
  let pending = false;
  new MutationObserver(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; enhance(document.getElementById("app")); }); })
    .observe(document.getElementById("app"), { childList: true, subtree: true });

  /* ---------- Validation élégante des formulaires ---------- */
  // regles : [[nom du champ, test(valeur, form) → message d'erreur ou ""]]
  function valider(form, regles) {
    $$(".field__err[data-auto]", form).forEach((x) => x.remove());
    $$(".is-error", form).forEach((x) => x.classList.remove("is-error"));
    let first = null;
    for (const [nom, test] of regles) {
      const el = form.elements[nom]; if (!el) continue;
      const msg = test(el.value, form); if (!msg) continue;
      const box = el.closest("label, .field") || el.parentNode;
      box.classList.add("is-error");
      box.insertAdjacentHTML("beforeend", `<span class="field__err" data-auto>${I("alertcircle")}${esc(msg)}</span>`);
      if (!first) first = box;
    }
    if (first) { first.scrollIntoView({ block: "center", behavior: "smooth" }); const f = $(".dp__in, .sb__btn, input:not([type=hidden]), textarea", first); if (f) setTimeout(() => f.focus(), 250); }
    return !first;
  }
  document.addEventListener("input", (e) => { const b = e.target.closest && e.target.closest(".is-error"); if (b) { b.classList.remove("is-error"); $$(".field__err[data-auto]", b).forEach((x) => x.remove()); } }, true);

  /* ---------- Thème clair / sombre ---------- */
  const applyTheme = (t) => { if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
  applyTheme(store.get("gei-theme"));
  const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  function toggleTheme() { const t = isDark() ? "light" : "dark"; applyTheme(t); store.set("gei-theme", t); drawThemeBtn(); }
  const drawThemeBtn = () => { const b = $("#themeBtn"); if (b) { b.innerHTML = I(isDark() ? "sun" : "moon", "ic--18"); b.setAttribute("aria-label", isDark() ? "Passer en mode clair" : "Passer en mode sombre"); } };

  /* ---------- Menu rétractable ---------- */
  const applySide = (mini) => { document.body.classList.toggle("side-mini", mini); document.documentElement.classList.remove("pre-mini"); };
  applySide(store.get("gei-side") === "mini");

  /* ---------- Recherche globale (Ctrl+K) ---------- */
  const MODULES = [["Tableau de gestion", "#gestion", "dashboard", "dg comptable"], ["Planning", "#g-planning", "planning"], ["Rapport mensuel", "#g-rapport", "report", "dg comptable"],
    ["Chantiers", "#g-chantiers", "hardhat"], ["Maisons et clients", "#g-maisons", "house", "dg comptable"], ["Stock de matériaux", "#g-stock", "package"], ["Équipes et paie", "#g-equipes", "users"],
    ["Dépenses", "#g-depenses", "receipt", "dg comptable"], ["Trésorerie", "#g-tresorerie", "wallet", "dg comptable"], ["Importer (Excel)", "#g-import", "sheet", "dg comptable"], ["Mon compte", "#compte", "account"],
    ["Nouvelle dépense", "#g-depense/nouvelle", "plus", "dg comptable"], ["Nouveau chantier", "#g-chantier/nouveau", "plus", "dg comptable"], ["Pointage du jour", "#g-equipes/pointage", "check"], ["Guide de style", "/guide-style.html", "image", "dg"]];
  const okRole = (r) => !r || r.split(" ").includes(G.me().role);
  let index = null;
  async function indexer() {
    const get = (n) => G.api("/api/g/" + n).catch(() => []);
    const [ch, dep, mai, ouv] = await Promise.all([get("chantiers"), okRole("dg comptable") ? get("depenses") : [], okRole("dg comptable") ? get("maisons") : [], get("ouvriers")]);
    index = [
      ...ch.map((c) => ({ t: c.nom, s: c.lieu || "Chantier", h: `#g-chantier/${c.id}`, i: "hardhat" })),
      ...dep.map((x) => ({ t: x.libelle, s: `${dateFr(x.date)} · ${sep(x.montant)} F`, h: `#g-depense/${x.id}`, i: "receipt" })),
      ...mai.map((m) => ({ t: `${m.programme} · lot ${m.lot}`, s: m.clientNom || "Maison", h: `#g-maison/${m.id}`, i: "house" })),
      ...ouv.map((o) => ({ t: o.nom, s: o.metier || "Ouvrier", h: `#g-ouvrier/${o.id}`, i: "users" })),
    ];
  }
  function palette() {
    const d = $("#cmdk"); if (!d || d.open) return;
    const q = $("#cmdkQ"), list = $("#cmdkList"); q.value = ""; index = null; d.showModal();
    let act = 0;
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      const mods = MODULES.filter((m) => okRole(m[3]) && (!s || m[0].toLowerCase().includes(s))).map((m) => ({ t: m[0], s: "Aller à", h: m[1], i: m[2] }));
      const res = s && index ? index.filter((x) => (x.t + " " + x.s).toLowerCase().includes(s)).slice(0, 12) : [];
      const all = [...mods.slice(0, s ? 5 : 11), ...res];
      act = Math.min(act, Math.max(0, all.length - 1));
      list.innerHTML = (mods.length ? `<p class="cmdk__grp">Navigation</p>` : "") + mods.slice(0, s ? 5 : 11).map((x, i) => item(x, i)).join("") +
        (res.length ? `<p class="cmdk__grp">Résultats</p>` + res.map((x, i) => item(x, i + Math.min(mods.length, s ? 5 : 11))).join("") : "") +
        (!all.length ? `<p class="pop__none">${index ? "Aucun résultat pour « " + esc(q.value) + " »" : "Recherche…"}</p>` : "");
      const a = $(".is-active", list); if (a) a.scrollIntoView({ block: "nearest" });
      list._all = all;
    };
    const item = (x, i) => `<a class="opt${i === act ? " is-active" : ""}" href="${esc(x.h)}" data-i="${i}">${I(x.i)}<span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span></a>`;
    q.oninput = () => { act = 0; draw(); };
    q.onkeydown = (e) => {
      const n = (list._all || []).length;
      if (e.key === "ArrowDown") { e.preventDefault(); act = Math.min(n - 1, act + 1); draw(); }
      if (e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, act - 1); draw(); }
      if (e.key === "Enter" && n) { e.preventDefault(); go(list._all[act].h); }
    };
    const go = (h) => { d.close(); if (h.startsWith("/")) location.href = h; else location.hash = h; };
    list.onclick = (e) => { const a = e.target.closest("a[href]"); if (a) { e.preventDefault(); go(a.getAttribute("href")); } };
    draw(); indexer().then(draw);
  }
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && !$("#app").hidden) { e.preventDefault(); palette(); } });

  /* ---------- Notifications (alertes calculées par l'application) ---------- */
  let alertes = [];
  async function chargerAlertes() {
    if (!G.alertes) return;
    try { alertes = await G.alertes(); } catch (_) { alertes = []; }
    const n = $("#notifN"); if (n) { n.textContent = alertes.length > 9 ? "9+" : alertes.length; n.hidden = !alertes.length; }
  }
  function notifs(btn) {
    if (pop && popAnchor === btn) return closePop();
    const p = openPop(btn, `<div class="notif__head"><b>Notifications</b><span class="t-help">${alertes.length} alerte(s)</span></div><div class="notif__list">${alertes.length ? alertes.map((a) => `<a class="notif" href="${esc(a.href)}"><span class="notif__ic notif__ic--${a.niveau}">${I(a.icone)}</span><span><b>${esc(a.titre)}</b><small>${esc(a.texte)}</small></span></a>`).join("") : `<div class="empty-state empty-state--sm"><span class="empty-state__ic">${I("check", "ic--20")}</span><p>Tout est en ordre.</p></div>`}</div>`);
    p.classList.add("notif-pop"); p.dataset.w = 360; placePop();
    p.addEventListener("click", (e) => { if (e.target.closest("a")) closePop(); });
  }

  /* ---------- Coquille : identité, menus, barre du haut ---------- */
  const ROLES = { dg: "Direction générale", comptable: "Comptabilité", chef: "Chef de chantier" };
  function shell() {
    const me = G.me();
    const nom = me.user || "";
    const ini = nom.replace(/[^a-zA-ZÀ-ÿ ]/g, " ").trim().split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase() || "G";
    if ($("#avatar")) $("#avatar").textContent = ini;
    if ($("#whoName")) $("#whoName").textContent = nom;
    if ($("#whoRole")) $("#whoRole").textContent = ROLES[me.role] || "";
    $$(".side__grp").forEach((g) => { g.hidden = !$$("a", g).some((a) => !a.hidden); });
    // Menu du bas (téléphone) : 4 raccourcis selon le rôle + « Plus »
    const sets = { chef: ["g-chantiers", "g-planning", "g-stock", "g-equipes"], comptable: ["gestion", "g-depenses", "g-tresorerie", "g-chantiers"], dg: ["gestion", "g-chantiers", "g-depenses", "g-tresorerie"] };
    const LIB = { gestion: ["Accueil", "dashboard"], "g-chantiers": ["Chantiers", "hardhat"], "g-planning": ["Planning", "planning"], "g-stock": ["Stock", "package"], "g-equipes": ["Équipes", "users"], "g-depenses": ["Dépenses", "receipt"], "g-tresorerie": ["Trésorerie", "wallet"] };
    const bn = $("#bnav");
    if (bn) bn.innerHTML = (sets[me.role] || sets.dg).map((v) => `<a href="#${v}" data-view="${v}">${I(LIB[v][1])}<span>${LIB[v][0]}</span></a>`).join("") + `<button type="button" id="bnMore">${I("menu")}<span>Plus</span></button>`;
    if ($("#bnMore")) $("#bnMore").onclick = () => document.body.classList.toggle("nav-open");
    drawThemeBtn();
    chargerAlertes();
  }
  function topbar() {
    const tb = $("#topbar"); if (!tb || tb.dataset.ui) return; tb.dataset.ui = 1;
    $("#searchBtn").onclick = palette;
    $("#themeBtn").onclick = toggleTheme;
    $("#notifBtn").onclick = () => notifs($("#notifBtn"));
    $("#sideToggle").onclick = () => { const mini = !document.body.classList.contains("side-mini"); applySide(mini); store.set("gei-side", mini ? "mini" : ""); };
    $("#navClose") && ($("#navClose").onclick = () => document.body.classList.remove("nav-open"));
    $("#scrim") && ($("#scrim").onclick = () => document.body.classList.remove("nav-open"));
    const mq = $("#cmdk"); if (mq) mq.addEventListener("click", (e) => { if (e.target === mq) mq.close(); });
  }
  // Après chaque changement d'écran : surligner le menu du bas, recharger les alertes
  addEventListener("hashchange", () => { setTimeout(() => { hl(); chargerAlertes(); }, 0); });
  const hl = () => { const on = $("#nav a.is-on"); $$("#bnav a").forEach((a) => a.classList.toggle("is-on", !!on && on.dataset.view === a.dataset.view)); };

  /* ---------- Chargement (skeleton) ---------- */
  const skeleton = () => `<div class="skel-page" aria-busy="true" aria-label="Chargement"><div class="skel" style="height:14px;width:140px"></div><div class="skel" style="height:30px;width:280px;margin:10px 0 28px"></div>
    <div class="skel-grid">${'<div class="card"><div class="skel" style="height:11px;width:50%"></div><div class="skel" style="height:28px;width:70%;margin:14px 0 10px"></div><div class="skel" style="height:8px"></div></div>'.repeat(4)}</div>
    <div class="card" style="margin-top:16px">${'<div class="skel" style="height:14px;margin:12px 0"></div>'.repeat(6)}</div></div>`;

  Object.assign(G, { ui: { head, tableau, vide, money, sep, dateFr, spark, delta, ring, enhance, valider, skeleton, shell, topbar, hl, chargerAlertes, closePop, I } });
})();
