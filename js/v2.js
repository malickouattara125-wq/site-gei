/* Global Empire Immobilier — version claire (v2) : interactions, sans bibliothèque */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Apparitions au défilement ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$("[data-anim]").forEach((el) => io.observe(el));

  /* ---------- Compteurs ---------- */
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min((now - t0) / 1600, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + (k === 1 ? suffix : "");
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      cio.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => cio.observe(el));

  /* ---------- En-tête : ombre au défilement ---------- */
  const header = $("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 10);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Menu mobile ---------- */
  const burger = $("[data-burger]");
  if (burger) burger.addEventListener("click", () => {
    const open = !document.body.classList.contains("menu-open");
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
  });
  $$("[data-mnav] a").forEach((a) => a.addEventListener("click", () => document.body.classList.remove("menu-open")));

  /* ---------- Programmes : onglets + recherche du héro ---------- */
  const cards = $$("[data-programs] .prog");
  const empty = $("[data-empty]");
  const tabs = $$("[data-tabs] button");
  const apply = ({ type = "all", ville = "", budget = "" }) => {
    let shown = 0;
    cards.forEach((c) => {
      const ok = (type === "all" || c.dataset.type === type) && (!ville || c.dataset.ville === ville) &&
        (!budget || +c.dataset.price < +budget);
      c.classList.toggle("is-hidden", !ok);
      if (ok) {
        shown++;
        c.classList.remove("is-in");
        requestAnimationFrame(() => setTimeout(() => c.classList.add("is-in"), 30 * shown));
      }
    });
    if (empty) empty.hidden = shown > 0;
  };
  tabs.forEach((b) => b.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("is-on", t === b));
    apply({ type: b.dataset.filter });
  }));
  const finder = $("[data-finder]");
  if (finder) finder.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    tabs.forEach((t) => t.classList.toggle("is-on", t.dataset.filter === "all"));
    apply({ ville: f.get("ville"), budget: f.get("budget") });
    $("#programmes").scrollIntoView({ behavior: "smooth" });
  });

  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Slider plein écran de l'accueil ---------- */
  const slider = $("[data-slider]");
  if (slider) {
    const slides = $$("[data-slide]", slider);
    const dots = $("[data-dots]", slider);
    const cur = $("[data-cur]", slider), tot = $("[data-tot]", slider);
    const DUR = 6500;
    let i = 0, timer = null;
    const pad = (n) => String(n).padStart(2, "0");
    if (tot) tot.textContent = pad(slides.length);
    if (dots) dots.innerHTML = slides.map((_, k) => `<button type="button" aria-label="Photo ${k + 1}"><i></i></button>`).join("");
    const dotBtns = dots ? $$("button", dots) : [];
    slider.style.setProperty("--dur", DUR / 1000 + "s");
    const show = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle("is-on", k === i); s.setAttribute("aria-hidden", k !== i); });
      dotBtns.forEach((b, k) => { b.classList.remove("is-on"); if (k === i) { void b.offsetWidth; b.classList.add("is-on"); } });
      if (cur) cur.textContent = pad(i + 1);
    };
    const play = () => { clearInterval(timer); if (!calm && slides.length > 1) timer = setInterval(() => show(i + 1), DUR); };
    const go = (n) => { show(n); play(); };
    dotBtns.forEach((b, k) => b.addEventListener("click", () => go(k)));
    const prev = $("[data-prev]", slider), next = $("[data-next]", slider);
    if (prev) prev.addEventListener("click", () => go(i - 1));
    if (next) next.addEventListener("click", () => go(i + 1));
    slider.addEventListener("mouseenter", () => { clearInterval(timer); slider.classList.add("is-paused"); });
    slider.addEventListener("mouseleave", () => { slider.classList.remove("is-paused"); play(); });
    let x0 = null;
    slider.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 45) go(i + (dx < 0 ? 1 : -1));
    });
    // Les photos suivantes se chargent après la première
    slides.slice(1).forEach((s) => { const im = $("img", s); if (im) im.loading = "eager"; });
    show(0); play();
  }

  /* ---------- Cartes projets : les photos défilent doucement ---------- */
  const rolls = $$("[data-roll]");
  if (rolls.length && !calm) {
    const visible = new Set();
    const rio = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { threshold: 0.2 });
    rolls.forEach((r, k) => {
      rio.observe(r);
      const imgs = $$("img", r);
      let n = 0;
      // Décalage entre les cartes pour qu'elles ne changent pas toutes en même temps
      setTimeout(() => setInterval(() => {
        if (!visible.has(r) || document.hidden) return;
        imgs[n].classList.remove("is-on");
        n = (n + 1) % imgs.length;
        imgs[n].classList.add("is-on");
      }, 4200), k * 1100);
    });
  }

  /* ---------- FAQ : une seule question ouverte à la fois ---------- */
  $$("[data-faq] details").forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) $$("[data-faq] details").forEach((o) => { if (o !== d) o.open = false; });
  }));

  /* ---------- Formulaire : message WhatsApp pré-rempli ---------- */
  $$("[data-form]").forEach((form) => form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    // Enregistre la demande dans le tableau de bord (si le site tourne avec son serveur)
    try {
      fetch("api/contact", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: f.get("nom"), tel: f.get("tel"), programme: f.get("programme") || "",
          message: f.get("message") || "", site: f.get("site") || "", page: location.pathname }) }).catch(() => {});
    } catch (_) { /* site statique : on passe directement à WhatsApp */ }
    const msg = [`Bonjour GEI, je suis ${f.get("nom")} (${f.get("tel")}).`,
      f.get("programme") && `Programme : ${f.get("programme")}`, f.get("message")].filter(Boolean).join("\n");
    open(`https://wa.me/2250709718530?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }));

  /* ---------- Galerie : agrandissement des photos ---------- */
  const shots = $$("[data-lightbox]");
  if (shots.length) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = '<img alt=""><p></p><button data-lb-close aria-label="Fermer">×</button>' +
      '<button data-lb-prev aria-label="Photo précédente">‹</button><button data-lb-next aria-label="Photo suivante">›</button>';
    document.body.appendChild(box);
    const img = $("img", box), cap = $("p", box);
    let i = 0, last = null;
    const show = (n) => {
      i = (n + shots.length) % shots.length;
      img.src = shots[i].dataset.lightbox;
      img.alt = cap.textContent = $("img", shots[i]).alt;
    };
    const close = () => { box.classList.remove("is-open"); if (last) last.focus(); };
    shots.forEach((s, n) => s.addEventListener("click", () => {
      last = s; show(n); box.classList.add("is-open"); $("[data-lb-close]", box).focus();
    }));
    $("[data-lb-close]", box).addEventListener("click", close);
    $("[data-lb-prev]", box).addEventListener("click", () => show(i - 1));
    $("[data-lb-next]", box).addEventListener("click", () => show(i + 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    addEventListener("keydown", (e) => {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(i - 1);
      if (e.key === "ArrowRight") show(i + 1);
    });
  }

  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
