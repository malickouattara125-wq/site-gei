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
  const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 10);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Menu mobile ---------- */
  const burger = $("[data-burger]");
  burger.addEventListener("click", () => {
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
    empty.hidden = shown > 0;
  };
  tabs.forEach((b) => b.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.toggle("is-on", t === b));
    apply({ type: b.dataset.filter });
  }));
  $("[data-finder]").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    tabs.forEach((t) => t.classList.toggle("is-on", t.dataset.filter === "all"));
    apply({ ville: f.get("ville"), budget: f.get("budget") });
    $("#programmes").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------- FAQ : une seule question ouverte à la fois ---------- */
  $$("[data-faq] details").forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) $$("[data-faq] details").forEach((o) => { if (o !== d) o.open = false; });
  }));

  /* ---------- Formulaire : message WhatsApp pré-rempli ---------- */
  $$("[data-form]").forEach((form) => form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const msg = [`Bonjour GEI, je suis ${f.get("nom")} (${f.get("tel")}).`,
      f.get("programme") && `Programme : ${f.get("programme")}`, f.get("message")].filter(Boolean).join("\n");
    open(`https://wa.me/2250709718530?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }));

  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
