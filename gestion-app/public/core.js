/* Application « GEI Gestion » — socle : connexion, navigation, messages, envoi de photos.
   Application séparée du tableau de bord du site (adresse /gestion, connexion propre). */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const main = $("#main");
  const img = (src) => (src ? (/^(https?:|\/)/.test(src) ? src : "/" + src) : "/logo-gei.png");
  const lines = (v) => String(v || "").split("\n").map((s) => s.trim()).filter(Boolean);

  /* ---------- Échanges avec le serveur (toujours sous /api/g/) ---------- */
  async function api(url, opts = {}) {
    const res = await fetch(url, {
      method: opts.method || "GET", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-GEI": "1" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (_) { /* réponse vide */ }
    if (res.status === 401 && url !== "/api/g/login") { showLogin(); throw new Error("Session expirée, reconnectez-vous."); }
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
  let me = { role: "comptable" };
  function showLogin() { $("#app").hidden = true; $("#login").hidden = false; $("[name=user]", $("#loginForm")).focus(); }
  function showApp(m) {
    if (m && m.role) me = m;
    document.body.classList.toggle("role-dg", me.role === "dg");
    $$("#nav [data-roles]").forEach((a) => { a.hidden = !a.dataset.roles.split(" ").includes(me.role); });
    if (me.role === "chef" && (!location.hash || location.hash === "#gestion")) history.replaceState(null, "", "#g-chantiers");
    $("#who").textContent = (me.user || "") + (me.role === "chef" ? " (chef de chantier)" : me.role === "comptable" ? " (comptable)" : "");
    $("#login").hidden = true; $("#app").hidden = false; route();
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $("button", e.target); btn.disabled = true; $("#loginErr").hidden = true;
    try {
      await api("/api/g/login", { method: "POST", body: { user: f.get("user"), password: f.get("password") } });
      e.target.reset(); showApp(await api("/api/g/me"));
    } catch (err) { $("#loginErr").textContent = err.message; $("#loginErr").hidden = false; }
    btn.disabled = false;
  });
  $("#logout").addEventListener("click", async () => { try { await api("/api/g/logout", { method: "POST" }); } catch (_) {} showLogin(); });

  /* ---------- Navigation ---------- */
  const views = {};
  let dirty = false;
  function route() {
    const h = location.hash.slice(1) || "gestion";
    const cut = h.indexOf("/");
    const name = cut < 0 ? h : h.slice(0, cut), arg = cut < 0 ? "" : h.slice(cut + 1);
    const v = views[name] || views.gestion;
    $$("#nav a").forEach((a) => a.classList.toggle("is-on", name === a.dataset.view || name.startsWith(a.dataset.view.replace(/s$/, "") + "/") || (a.dataset.view !== "gestion" && name.startsWith(a.dataset.view.replace(/s$/, "")))));
    dirty = false;
    main.innerHTML = '<p class="empty">Chargement…</p>';
    Promise.resolve(v(arg ? arg.split("/").map(decodeURIComponent).join("/") : undefined)).catch(fail);
    scrollTo(0, 0);
    document.body.classList.remove("nav-open");
  }
  addEventListener("hashchange", (e) => {
    if (dirty && !confirm("Des modifications ne sont pas enregistrées. Quitter quand même ?")) {
      history.replaceState(null, "", e.oldURL.slice(e.oldURL.indexOf("#"))); return;
    }
    route();
  });
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- Mon compte : mot de passe ---------- */
  views.compte = async () => {
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
      try { await api("/api/g/password", { method: "POST", body: { current: f.get("current"), next: f.get("next") } }); toast("Mot de passe changé. Reconnectez-vous."); setTimeout(showLogin, 1200); }
      catch (err) { fail(err); }
    });
  };

  /* ---------- Photos de chantier : choisir ou envoyer ---------- */
  const dlg = $("#picker");
  let onPick = null, multi = false, images = [];
  async function pick(cb, many = false) {
    onPick = cb; multi = many;
    $("#pickerSearch").value = "";
    dlg.showModal();
    images = (await api("/api/g/images")).filter((s) => s.startsWith("uploads/"));
    renderPicker();
  }
  function renderPicker() {
    const q = $("#pickerSearch").value.toLowerCase();
    $("#pickerGrid").innerHTML = images.filter((s) => !q || s.toLowerCase().includes(q)).map((s) =>
      `<button type="button" data-src="${esc(s)}"><img src="${esc(img(s))}" alt="" loading="lazy"><small>${esc(s.split("/").pop())}</small></button>`).join("") || '<p class="empty">Aucune photo envoyée pour le moment. Utilisez le bouton « Envoyer des photos ».</p>';
  }
  $("#pickerSearch").addEventListener("input", renderPicker);
  $("#pickerGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-src]"); if (!b) return; dlg.close(); onPick && onPick([b.dataset.src]); });
  $("[data-close]", dlg).addEventListener("click", () => dlg.close());
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1800 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.85));
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
      try { const data = await shrink(file); const r = await api("/api/g/upload", { method: "POST", body: { name: "chantier-" + file.name.replace(/\.[^.]+$/, ""), data } }); done.push(r.src); }
      catch (err) { fail(err); }
    }
    if (!done.length) return;
    toast(done.length > 1 ? `${done.length} photos envoyées` : "Photo envoyée");
    dlg.close(); onPick && onPick(multi ? done : [done[0]]);
  });

  /* ---------- Menu sur téléphone ---------- */
  $("#burger").addEventListener("click", () => document.body.classList.toggle("nav-open"));

  window.GEI = { api, esc, toast, fail, pick, img, lines, views, main, $, $$, me: () => me, setDirty: (v) => { dirty = v; } };
  window.GEI_START = () => api("/api/g/me").then(showApp).catch(showLogin);
})();
