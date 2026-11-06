/* Global Empire Immobilier — interactions et animations (JavaScript natif, sans bibliothèque) */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Titres découpés en mots ---------- */
  $$("[data-split]").forEach((el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const w = document.createElement("span");
            w.className = "w";
            const inner = document.createElement("span");
            inner.style.setProperty("--i", i++);
            inner.textContent = part;
            w.append(inner);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
  });

  /* ---------- Écran de chargement ---------- */
  const TOP = ".hero, .page-hero"; // zones animées dès l'arrivée sur la page
  const showTop = () => {
    document.body.classList.remove("is-loading");
    document.body.classList.add("is-ready");
    $$(".hero [data-split], .hero [data-reveal], .page-hero [data-split], .page-hero [data-reveal]")
      .forEach((el) => el.classList.add("is-in"));
  };
  const loader = $(".loader");
  if (loader) { // accueil : écran de chargement avec pourcentage
    const count = $("[data-loader-count]");
    const bar = $(".loader__bar span");
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(p + Math.random() * 14, 92);
      count.textContent = Math.floor(p);
      bar.style.width = p + "%";
    }, 90);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(tick);
      count.textContent = 100;
      bar.style.width = "100%";
      setTimeout(() => { loader.classList.add("is-done"); showTop(); }, 250);
    };
    if (document.readyState === "complete") setTimeout(finish, 600);
    else addEventListener("load", () => setTimeout(finish, 400));
    setTimeout(finish, 4500); // sécurité si la vidéo tarde
  } else { // pages intérieures : rideau qui se lève
    // pas de requestAnimationFrame ici : il ne se déclenche pas dans un onglet ouvert en arrière-plan
    setTimeout(() => { document.body.classList.add("is-arrived"); showTop(); }, 80);
  }

  /* ---------- Transition entre les pages : le rideau retombe avant de changer de page ---------- */
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || !/\.html$|\/$/.test(url.pathname)) return;
    e.preventDefault();
    document.body.classList.add("is-leaving");
    setTimeout(() => { location.href = a.href; }, 550);
  });
  addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("is-leaving"); });

  /* ---------- Apparitions au défilement ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      $$("[data-split]", e.target).forEach((s) => s.classList.add("is-in"));
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
  $$("[data-reveal], [data-split], [data-img-reveal]").forEach((el) => { if (!el.closest(TOP)) io.observe(el); });

  /* ---------- Texte qui s'allume mot à mot au défilement ---------- */
  const HIGHLIGHT = new Set(["engagements,", "différence.", "durer,", "délais."]);
  const scrubs = $$("[data-scrub]").map((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    const spans = words.map((w, i) => {
      const s = document.createElement("span");
      s.className = "sw" + (HIGHLIGHT.has(w) ? " hl" : "");
      s.textContent = w;
      el.append(s, i < words.length - 1 ? " " : "");
      return s;
    });
    return { el, spans };
  });
  const onScrollScrub = () => {
    scrubs.forEach(({ el, spans }) => {
      const r = el.getBoundingClientRect();
      const k = Math.min(Math.max((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35), 0), 1);
      const n = Math.round(k * spans.length);
      spans.forEach((s, i) => s.classList.toggle("on", i < n));
    });
  };

  /* ---------- Compteurs ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const end = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const t0 = performance.now();
      const dur = 1800;
      const step = (now) => {
        const k = Math.min((now - t0) / dur, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4))) + (k === 1 ? suffix : "");
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      countIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- En-tête : fond au défilement, masqué en descendant ---------- */
  const header = $("[data-header]");
  let lastY = 0;
  const onScrollHeader = () => {
    const y = scrollY;
    header.classList.toggle("is-solid", y > 60);
    header.classList.toggle("is-hidden", y > 400 && y > lastY && !document.body.classList.contains("menu-open"));
    lastY = y;
  };

  /* ---------- Menu mobile ---------- */
  const burger = $("[data-burger]");
  const menu = $("[data-menu]");
  const toggleMenu = (open) => {
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
    menu.setAttribute("aria-hidden", !open);
  };
  burger.addEventListener("click", () => toggleMenu(!document.body.classList.contains("menu-open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

  /* ---------- Programmes : défilement horizontal piloté par le défilement vertical ---------- */
  const hs = $("[data-hscroll]");
  const track = $("[data-htrack]");
  const prog = $("[data-hprogress]");
  const desktop = matchMedia("(min-width: 861px)");
  const sizeH = () => {
    if (!hs) return;
    if (!desktop.matches) { hs.style.height = ""; track.style.transform = ""; return; }
    const extra = track.scrollWidth - innerWidth;
    hs.style.height = innerHeight + Math.max(0, extra) + "px";
  };
  const onScrollH = () => {
    if (!hs || !desktop.matches) return;
    const r = hs.getBoundingClientRect();
    const max = hs.offsetHeight - innerHeight;
    const k = Math.min(Math.max(-r.top / max, 0), 1);
    const extra = track.scrollWidth - innerWidth;
    track.style.transform = `translate3d(${-extra * k}px,0,0)`;
    prog.style.width = k * 100 + "%";
  };

  /* ---------- Méthode : image qui change selon l'étape ---------- */
  const steps = $$("[data-step]");
  const imgs = $$("[data-step-img]");
  const idx = $("[data-step-index]");
  const stepIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = +e.target.dataset.step;
      steps.forEach((s) => s.classList.toggle("is-active", s === e.target));
      imgs.forEach((im) => im.classList.toggle("is-active", +im.dataset.stepImg === n));
      if (idx) idx.textContent = String(n + 1).padStart(2, "0");
    });
  }, { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((s) => stepIO.observe(s));

  /* ---------- Parallaxe douce ---------- */
  const par = $$("[data-parallax]");
  const onScrollPar = () => {
    par.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      el.firstElementChild.style.transform = `translate3d(0,${k * -60}px,0) scale(1.06)`;
    });
  };

  /* ---------- Boutons magnétiques ---------- */
  if (!reduce && matchMedia("(hover: hover)").matches) {
    $$("[data-magnetic]").forEach((b) => {
      b.addEventListener("mousemove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      b.addEventListener("mouseleave", () => { b.style.transform = ""; });
    });
  }

  /* ---------- Visionneuse photo ---------- */
  const lb = $("[data-lightbox-box]");
  $$("[data-lightbox]").forEach((g) => g.addEventListener("click", () => {
    $("img", lb).src = g.dataset.lightbox;
    $("img", lb).alt = $("img", g).alt;
    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden", "false");
  }));
  const closeLb = () => { if (lb) { lb.classList.remove("is-open"); lb.setAttribute("aria-hidden", "true"); } };
  if (lb) lb.addEventListener("click", (e) => { if (e.target !== $("img", lb)) closeLb(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") { closeLb(); toggleMenu(false); } });

  /* ---------- Formulaire : envoi du message sur WhatsApp ---------- */
  $$("[data-form]").forEach((form) => form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = [`Bonjour GEI, je suis ${f.get("nom")} (${f.get("tel")}).`,
      f.get("programme") && `Programme : ${f.get("programme")}`, f.get("message")].filter(Boolean).join("\n");
    open(`https://wa.me/2250709718530?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  }));

  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Héro : la vidéo s'éloigne et le texte s'efface en descendant ; léger suivi de la souris ---------- */
  const heroVideo = $("[data-hero-video]");
  const heroContent = $(".hero__content");
  let mx = 0, my = 0;
  const onScrollHero = () => {
    if (!heroVideo || !heroContent) return;
    const y = Math.min(scrollY, innerHeight);
    heroVideo.style.transform = `scale(${1 + y / innerHeight * 0.18})`;
    heroContent.style.transform = `translate3d(${mx * 14}px,${y * 0.35 + my * 10}px,0)`;
    heroContent.style.opacity = 1 - y / (innerHeight * 0.75);
  };
  if (!reduce && $(".hero")) {
    $(".hero").addEventListener("mousemove", (e) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
      onScrollHero();
    });
  }

  /* ---------- Barre de progression ---------- */
  const progress = $("[data-progress]");
  const onScrollProgress = () => {
    if (!progress) return;
    progress.style.transform = `scaleX(${scrollY / (document.documentElement.scrollHeight - innerHeight)})`;
  };

  /* ---------- Bande géante : les deux lignes glissent en sens opposés ---------- */
  const bands = $$("[data-band]");
  const onScrollBand = () => {
    bands.forEach((row) => {
      const r = row.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const k = (innerHeight - r.top) / (innerHeight + r.height);
      row.style.transform = `translate3d(${(-k * 40 + (row.dataset.band < 0 ? -30 : 0)) * +row.dataset.band}%,0,0)`;
    });
  };

  /* ---------- Bandeau des villes : accélère et change de sens avec le défilement ---------- */
  const mq = $(".marquee__track");
  let mqX = 0, vel = 0, lastScroll = scrollY, dir = 1;
  const loopMarquee = () => {
    const d = scrollY - lastScroll;
    lastScroll = scrollY;
    if (d) dir = d > 0 ? 1 : -1;
    vel += (Math.abs(d) * 0.6 - vel) * 0.1;
    mqX -= (0.6 + vel) * dir;
    const half = mq.scrollWidth / 2;
    if (mqX <= -half) mqX += half;
    if (mqX > 0) mqX -= half;
    mq.style.transform = `translate3d(${mqX}px,0,0)`;
    requestAnimationFrame(loopMarquee);
  };
  if (!reduce && mq) requestAnimationFrame(loopMarquee);

  /* ---------- Cartes qui s'inclinent en 3D sous la souris ---------- */
  if (!reduce && matchMedia("(hover: hover)").matches) {
    $$("[data-tilt]").forEach((c) => {
      c.addEventListener("mousemove", (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform = `perspective(900px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateY(-8px)`;
      });
      c.addEventListener("mouseleave", () => { c.style.transform = ""; });
    });
  }

  /* ---------- Curseur personnalisé ---------- */
  if (!reduce && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.body.classList.add("has-cursor");
    const cur = $(".cursor");
    const dot = $(".cursor__dot");
    const ring = $(".cursor__ring");
    const label = $("[data-cursor-label]");
    let cx = innerWidth / 2, cy = innerHeight / 2, rx = cx, ry = cy;
    addEventListener("mousemove", (e) => {
      cx = e.clientX; cy = e.clientY;
      dot.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    });
    const loopCursor = () => {
      rx += (cx - rx) * 0.16;
      ry += (cy - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(loopCursor);
    };
    requestAnimationFrame(loopCursor);
    document.addEventListener("mouseover", (e) => {
      const lab = e.target.closest("[data-cursor]");
      const link = e.target.closest("a, button, input, select, textarea, [data-tilt]");
      cur.classList.toggle("is-label", !!lab);
      cur.classList.toggle("is-link", !lab && !!link);
      label.textContent = lab ? lab.dataset.cursor : "";
    });
    document.addEventListener("mouseleave", () => cur.style.opacity = 0);
    document.addEventListener("mouseenter", () => cur.style.opacity = 1);
  }

  /* ---------- Frise de l'histoire : la ligne se remplit au défilement ---------- */
  const tl = $("[data-timeline]");
  const tlFill = $("[data-timeline-fill]");
  const onScrollTimeline = () => {
    if (!tl) return;
    const r = tl.getBoundingClientRect();
    const k = Math.min(Math.max((innerHeight * 0.6 - r.top) / r.height, 0), 1);
    tlFill.style.height = k * 100 + "%";
  };

  /* ---------- Boucle de défilement ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      onScrollHeader(); onScrollH(); onScrollPar(); onScrollScrub(); onScrollHero(); onScrollProgress(); onScrollBand();
      onScrollTimeline();
      ticking = false;
    });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { sizeH(); onScroll(); });
  sizeH();
  onScroll();
})();
