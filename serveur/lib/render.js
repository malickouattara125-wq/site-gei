// Fabrication des pages à partir des données (programmes, actualités).
"use strict";
const fs = require("fs");
const path = require("path");

const TPL = path.join(__dirname, "..", "templates");

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const num = (n) => String(n).replace(".", ",");

const NAV = [["index.html", "Accueil"], ["programmes.html", "Programmes"], ["realisations.html", "Réalisations"],
  ["services.html", "Services"], ["a-propos.html", "À propos"], ["contact.html", "Contact"]];

const EXTRA_OPTIONS = ["Construction ou rénovation", "Préfinancement ou bail", "Autre demande"];

function layout({ title, desc, og, nav, body }) {
  const tpl = fs.readFileSync(path.join(TPL, "layout.html"), "utf8");
  const navHtml = NAV.map(([h, l]) => `<a href="${h}"${h === nav ? ' class="is-current"' : ""}>${l}</a>`).join("\n        ");
  const mnav = NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join("");
  return tpl.replace("{{TITLE}}", esc(title)).replace("{{TITLE}}", esc(title))
    .replace("{{DESC}}", esc(desc)).replace("{{DESC}}", esc(desc)).replace("{{OG}}", esc(og))
    .replace("{{NAV}}", navHtml).replace("{{MNAV}}", mnav).replace("{{BODY}}", body);
}

const BADGES = { ok: "badge badge--ok", new: "badge badge--new", "": "badge" };

function chips(p) {
  return [p.typeLabel, p.pieces, p.surface].filter(Boolean).map((c) => `<li>${esc(c)}</li>`).join("");
}

// Photos de la carte : la photo de carte, puis la grande photo et la galerie (elles défilent doucement)
function cardImages(p) {
  const all = [p.carte, p.image, ...(p.galerie || []).map((g) => g.src)].filter(Boolean);
  return [...new Set(all)].slice(0, 5);
}

function card(p, i = 0) {
  const imgs = cardImages(p);
  const badge = p.statut ? `<span class="tile__badge${p.badge === "ok" ? " tile__badge--ok" : ""}">${esc(p.statut)}</span>` : "";
  return `          <a class="prog tile" href="programme-${esc(p.slug)}.html" data-type="${esc(p.type)}" data-ville="${esc(p.slug)}" data-price="${esc(p.prixDes)}" data-anim style="--d:${(0.06 * i).toFixed(2)}s">
            <div class="tile__img"${imgs.length > 1 ? " data-roll" : ""}>${imgs.map((src, k) => `<img src="${esc(src)}" alt="${k ? "" : esc(p.nom + ", " + p.ville)}" loading="lazy"${k ? "" : ' class="is-on"'}>`).join("")}</div>
            ${badge}
            <div class="tile__txt">
              <h3><b>Nos villas</b> à ${esc(p.ville)}</h3>
              <p>${esc(p.nom)} · À partir de <strong>${num(p.prixDes)} M FCFA</strong></p>
            </div>
          </a>`;
}

/* ---------- Slides de l'accueil ---------- */
function slides(list) {
  return list.map((s, i) => {
    const h = i === 0 ? "h1" : "h2";
    return `    <div class="slide${i === 0 ? " is-on" : ""}" data-slide>
      <img src="${esc(s.image)}" alt="${esc(s.alt || [s.titre1, s.titre2].filter(Boolean).join(" "))}"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}>
      <div class="slide__in"><div class="wrap"><div class="slide__txt">
        ${s.kicker ? `<p class="kicker">${esc(s.kicker)}</p>` : ""}
        <${h}>${esc(s.titre1)}${s.titre2 ? ` <em>${esc(s.titre2)}</em>` : ""}</${h}>
        ${s.texte ? `<p>${esc(s.texte)}</p>` : ""}
        <div class="slide__btns">${s.bouton && s.lien ? `<a href="${esc(s.lien)}" class="btn btn--gold">${esc(s.bouton)}</a>` : ""}</div>
      </div></div></div>
    </div>`;
  }).join("\n");
}

/* ---------- Services ---------- */
// Texte échappé, avec **mots en gras** autorisés
const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const svcTitle = (s) => `${esc(s.titre1)}${s.titre2 ? ` <span class="hl">${esc(s.titre2)}</span>` : ""}`;

// Tuiles de l'accueil (« Un seul interlocuteur »)
function servicesCards(list) {
  return list.map((s, i) => `          <a class="tile" href="services.html#service-${String(i + 1).padStart(2, "0")}" data-anim${i ? ` style="--d:${(0.06 * i).toFixed(2)}s"` : ""}>
            <div class="tile__img"><img src="${esc(s.image)}" alt="" loading="lazy"></div>
            <div class="tile__txt">
              <h3><b>${esc(s.titre1)}</b> ${esc(s.titre2 || "")}</h3>
              ${s.resume ? `<p>${esc(s.resume)}</p>` : ""}
            </div>
          </a>`).join("\n");
}

// Blocs détaillés de la page Services
function servicesRows(list) {
  return list.map((s, i) => `        <div class="split split--mid${i % 2 ? " split--rev" : ""} svc-row" id="service-${String(i + 1).padStart(2, "0")}">
          <div class="prose">
            <span class="num-tag" data-anim>Service ${String(i + 1).padStart(2, "0")}</span>
            <h2 data-anim style="--d:.06s">${svcTitle(s)}</h2>
            ${(s.paragraphes || []).map((t, k) => `<p data-anim style="--d:${(0.1 + k * 0.02).toFixed(2)}s">${rich(t)}</p>`).join("\n            ")}
            ${s.points && s.points.length ? `<ul class="checks checks--2" data-anim style="--d:.16s">${s.points.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
          </div>
          <div class="media-card" data-anim style="--d:.1s"><img src="${esc(s.image)}" alt="${esc([s.titre1, s.titre2].join(" "))}" loading="lazy"></div>
        </div>`).join("\n\n");
}

/* ---------- Réalisations livrées ---------- */
function realisations(list) {
  return list.map((r, i) => {
    const tag = r.lien ? "a" : "article";
    return `          <${tag} class="tile"${r.lien ? ` href="${esc(r.lien)}"` : ""} data-anim style="--d:${((i % 3) * 0.06).toFixed(2)}s">
            <div class="tile__img"><img src="${esc(r.image || "assets/img/logo-gei.png")}" alt="${esc(r.titre)}" loading="lazy"></div>
            ${r.date ? `<span class="tile__badge">${esc(r.date)}</span>` : ""}
            <div class="tile__txt">
              <h3><b>${esc(r.titre)}</b> ${esc(r.lieu || "")}</h3>
              ${r.chiffres && r.chiffres.length ? `<p>${r.chiffres.map(esc).join(" · ")}</p>` : ""}
            </div>
          </${tag}>`;
  }).join("\n");
}

// Accueil : mise en page éditoriale (une grande réalisation à la une + deux à côté), légendes sous les photos
function realisationsUne(list) {
  return list.slice(0, 3).map((r, i) => {
    const tag = r.lien ? "a" : "article";
    const meta = [r.lieu, r.date].filter(Boolean).map(esc).join(" · ");
    return `          <${tag} class="re-item${i === 0 ? " re-item--une" : ""}"${r.lien ? ` href="${esc(r.lien)}"` : ""} data-anim style="--d:${(0.08 * i).toFixed(2)}s">
            <div class="re-item__img"><img src="${esc(r.image || "assets/img/logo-gei.png")}" alt="${esc(r.titre)}" loading="lazy"></div>
            <div class="re-item__cap">
              ${meta ? `<p class="re-item__meta">${meta}</p>` : ""}
              <h3>${esc(r.titre)}</h3>
              ${i === 0 && r.texte ? `<p class="re-item__txt">${esc(r.texte)}</p>` : ""}
              ${r.chiffres && r.chiffres.length ? `<p class="re-item__fig">${r.chiffres.map(esc).join("<i></i>")}</p>` : ""}
            </div>
          </${tag}>`;
  }).join("\n");
}

function cards(list) { return list.map((p, i) => card(p, i)).join("\n"); }

function contactBlock(programmes, selected, titleHtml) {
  const opts = programmes.map((p) => `${p.ville} · ${p.nom}`).concat(EXTRA_OPTIONS)
    .map((o) => `<option${o === selected ? " selected" : ""}>${esc(o)}</option>`).join("");
  return `
    <section class="section" id="contact">
      <div class="wrap">
        <div class="contact" data-anim>
          <div class="contact__text">
            <p class="kicker kicker--light">Contactez-nous</p>
            <h2>${titleHtml || "Parlons de votre <span>future maison</span>"}</h2>
            <p>Les rendez-vous sont gratuits et sans engagement. Un conseiller vous rappelle rapidement sur WhatsApp.</p>
            <ul class="contact__list">
              <li><i class="ico ico--phone"></i><a href="tel:+2250709718530">07 09 71 85 30</a> · <a href="tel:+2250704755306">07 04 75 53 06</a></li>
              <li><i class="ico ico--mail"></i><a href="mailto:contact@gei-sarl.ci">contact@gei-sarl.ci</a></li>
              <li><i class="ico ico--pin"></i>Cocody, Cité des Arts (derrière la banque NSIA)</li>
              <li><i class="ico ico--clock"></i>Lundi au vendredi · 8h – 16h30</li>
            </ul>
          </div>
          <form class="cform" data-form>
            <label><span>Nom complet</span><input name="nom" required maxlength="120" autocomplete="name" placeholder="Votre nom"></label>
            <label><span>Téléphone / WhatsApp</span><input name="tel" required maxlength="40" inputmode="tel" autocomplete="tel" placeholder="+225 …"></label>
            <label><span>Votre projet</span><select name="programme">${opts}</select></label>
            <label><span>Message</span><textarea name="message" rows="3" maxlength="2000" placeholder="Visite, formule de paiement, questions…"></textarea></label>
            <label class="hp" aria-hidden="true">Site <input name="site" tabindex="-1" autocomplete="off"></label>
            <button class="btn btn--light" type="submit">Être rappelé sur WhatsApp</button>
          </form>
        </div>
      </div>
    </section>`;
}

function gallery(items) {
  return items.map((g, i) => {
    const cls = i % 6 === 0 ? "g g--tall" : i % 6 === 3 ? "g g--wide" : "g";
    return `          <button class="${cls}" data-lightbox="${esc(g.src)}" data-anim style="--d:${((i % 3) * 0.05).toFixed(2)}s"><img src="${esc(g.src)}" alt="${esc(g.legende)}" loading="lazy"><span>${esc(g.legende)}</span></button>`;
  }).join("\n");
}

/* ---------- Comment souscrire (bas de chaque fiche programme) ---------- */
function souscrire(p, waText) {
  const f = (p.formules || []).filter((x) => x.label);
  const choix = f.length ? f.map((x) => x.label.toLowerCase()).join(", ") : "la formule adaptée à votre budget";
  return `
    <section class="section" id="souscrire">
      <div class="wrap">
        <div class="head head--row">
          <div>
            <p class="kicker" data-anim>Comment souscrire</p>
            <h2 data-anim style="--d:.06s">Devenir propriétaire <span class="hl">à ${esc(p.ville)}</span></h2>
          </div>
          <p data-anim>Un conseiller vous accompagne à chaque étape, sur place ou à distance.</p>
        </div>
        <ol class="sub-steps" data-anim>
          <li><h3>Prenez contact</h3><p>Appelez-nous ou écrivez-nous sur WhatsApp : un conseiller répond à vos questions et organise une visite gratuite.</p></li>
          <li><h3>Choisissez votre formule</h3><p>${esc(choix.charAt(0).toUpperCase() + choix.slice(1))} : vous choisissez selon votre budget.</p></li>
          <li><h3>Réservez</h3><p>Vous réglez les frais de dossier (300 000 FCFA) et signez votre contrat de réservation.</p></li>
          <li><h3>Recevez vos clés</h3><p>Nos équipes construisent et contrôlent chaque étape, jusqu'à la remise des clés.</p></li>
        </ol>
        <div class="sub-docs" data-anim style="--d:.08s">
          <div>
            <h3>Les conditions <span>en bref</span></h3>
            <ul>
              ${f.map((x) => `<li>${esc(x.label)} : <b>${num(x.montant)} M FCFA</b></li>`).join("\n              ")}
              ${p.noteOffre ? `<li>${esc(p.noteOffre)}</li>` : ""}
              <li>Frais de dossier : 300 000 FCFA</li>
              <li>Documents du programme : ${esc(p.documents || "ACD & permis de construire")}</li>
            </ul>
          </div>
          <div class="sub-docs__cta">
            <p>Prêt à réserver votre villa à ${esc(p.ville)} ?</p>
            <a href="https://wa.me/2250709718530?text=${waText}" class="btn btn--gold" target="_blank" rel="noopener">Souscrire sur WhatsApp</a>
            <a href="#contact" class="btn btn--line">Être rappelé</a>
          </div>
        </div>
      </div>
    </section>`;
}

function programmePage(p, all) {
  const others = all.filter((o) => o.slug !== p.slug);
  const waText = encodeURIComponent(`Bonjour GEI, je souhaite des informations sur ${p.nom} (${p.ville}).`);
  const v = p.video && p.video.src ? p.video : null;
  const body = `
    <section class="phero">
      <div class="wrap phero__grid">
        <div>
          <p class="crumbs" data-anim><a href="index.html">Accueil</a><span>/</span><a href="programmes.html">Programmes</a><span>/</span>${esc(p.ville)}</p>
          ${p.statut ? `<span class="pill" data-anim style="--d:.04s"><i></i>${esc(p.pill || p.statut)}</span>` : ""}
          <h1 data-anim style="--d:.08s">${esc(p.titre1)} <span class="hl">${esc(p.titre2)}</span></h1>
          <p class="phero__lead" data-anim style="--d:.14s">${esc(p.accroche)}</p>
          <div class="phero__btns" data-anim style="--d:.2s">
            <a href="#souscrire" class="btn btn--gold">Comment souscrire</a>
            <a href="#contact" class="btn btn--line">Réserver une visite</a>
            ${p.galerie && p.galerie.length ? '<a href="#galerie" class="btn btn--line">Voir les photos</a>' : ""}
          </div>
        </div>
        <div class="phero__media" data-anim style="--d:.1s">
          <img src="${esc(p.image)}" alt="${esc(p.nom + ", " + p.ville)}">
          <div class="float float--price"><small>À partir de</small><b>${num(p.prixDes)} M <em>FCFA</em></b></div>
        </div>
      </div>
      <div class="wrap">
        <div class="stats stats--5 stats--txt" data-anim>
          <div><b>${esc(p.typeLabel)}</b><span>Type</span></div>
          <div><b>${esc(p.pieces)}</b><span>Pièces</span></div>
          <div><b>${esc(p.surface)}</b><span>Superficie</span></div>
          <div><b>${esc(p.documents || "ACD & permis")}</b><span>Documents</span></div>
          <div><b>${esc(p.statut)}</b><span>Statut</span></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap split">
        <div class="prose">
          <p class="kicker" data-anim>Le programme</p>
          <h2 data-anim style="--d:.06s">${esc(p.sousTitre1)} <span class="hl">${esc(p.sousTitre2)}</span></h2>
          ${(p.paragraphes || []).map((t, i) => `<p data-anim style="--d:${(0.1 + i * 0.02).toFixed(2)}s">${esc(t)}</p>`).join("\n          ")}
          ${p.points && p.points.length ? `<ul class="checks checks--2" data-anim style="--d:.18s">${p.points.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
        </div>
        <aside class="offer" data-anim style="--d:.1s">
          <h3>Formules d'acquisition</h3>
          ${(p.formules || []).map((f) => `<div class="offer__row"><span>${esc(f.label)}</span><b>${num(f.montant)}<small>M FCFA</small></b></div>`).join("\n          ")}
          ${p.noteOffre ? `<p class="offer__note">${esc(p.noteOffre)}</p>` : ""}
          <ul class="tags"><li>ACD</li><li>Permis de construire</li><li>Frais de dossier 300 000 FCFA</li></ul>
          <a href="#contact" class="btn btn--primary">Réserver une visite</a>
          <a href="https://wa.me/2250709718530?text=${waText}" class="btn btn--wa" target="_blank" rel="noopener">Écrire sur WhatsApp</a>
        </aside>
      </div>
    </section>
${p.galerie && p.galerie.length ? `
    <section class="section section--soft" id="galerie">
      <div class="wrap">
        <div class="head head--row">
          <div>
            <p class="kicker" data-anim>Galerie</p>
            <h2 data-anim style="--d:.06s">${esc(p.ville)} <span class="hl">en images</span></h2>
          </div>
          <p data-anim>Cliquez sur une photo pour l'agrandir.</p>
        </div>
        <div class="gallery">
${gallery(p.galerie)}
        </div>
      </div>
    </section>` : ""}
${v ? `
    <section class="section">
      <div class="wrap">
        <div class="band${v.format === "vertical" ? " band--tall" : ""}">
          <div data-anim>
            <p class="kicker kicker--light">En vidéo</p>
            <h2>${esc(v.titre || "Découvrez le programme")}</h2>
            ${v.texte ? `<p>${esc(v.texte)}</p>` : ""}
            <a href="#contact" class="btn btn--light">Visiter sur place</a>
          </div>
          <div class="vid${v.format === "vertical" ? " vid--tall" : ""}" data-anim style="--d:.1s">
            <video controls playsinline preload="none"${v.poster ? ` poster="${esc(v.poster)}"` : ""}><source src="${esc(v.src)}" type="video/mp4"></video>
          </div>
        </div>
      </div>
    </section>` : ""}
${souscrire(p, waText)}
${others.length ? `
    <section class="section section--soft">
      <div class="wrap">
        <div class="head head--row">
          <div>
            <p class="kicker" data-anim>Nos autres programmes</p>
            <h2 data-anim style="--d:.06s">Découvrez aussi</h2>
          </div>
          <a href="programmes.html" class="btn btn--ghost" data-anim>Tous les programmes</a>
        </div>
        <div class="others">
${cards(others.slice(0, 3))}
        </div>
      </div>
    </section>` : ""}
${contactBlock(all, `${p.ville} · ${p.nom}`, `Votre villa à <span>${esc(p.ville)}</span>`)}`;
  return layout({ title: `${p.nom} · ${p.ville} · Global Empire Immobilier`, desc: p.accroche, og: p.image, nav: "programmes.html", body });
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function dateFr(a) {
  if (a.dateTexte) return a.dateTexte;
  const d = new Date(a.date);
  return isNaN(d) ? "" : `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

function newsList(list) {
  return list.map((a, i) => {
    const featured = i === 0;
    const img = a.image
      ? `<div class="post__img"><img src="${esc(a.image)}" alt="${esc(a.titre)}" loading="lazy"></div>`
      : `<div class="post__img post__img--logo"><img src="assets/img/logo-gei.png" alt="" loading="lazy"></div>`;
    const lien = a.lien ? `<p style="margin-top:20px"><a href="${esc(a.lien)}" class="btn btn--ghost">En savoir plus</a></p>` : "";
    return `          <article class="post${featured ? " post--featured" : ""}" data-anim style="--d:${((i % 3) * 0.06).toFixed(2)}s">
            ${img}
            <div class="post__body"><time>${esc(dateFr(a))}</time><h3>${esc(a.titre)}</h3><p>${esc(a.texte)}</p>${featured ? lien : ""}</div>
          </article>`;
  }).join("\n");
}

// Remplace le contenu entre deux repères <!-- nom:debut --> et <!-- nom:fin -->
function between(html, name, content) {
  const re = new RegExp(`(<!-- ${name}:debut -->)[\\s\\S]*?(<!-- ${name}:fin -->)`);
  return html.replace(re, (_, a, b) => `${a}\n${content}\n          ${b}`);
}

module.exports = { esc, layout, card, cards, slides, realisations, realisationsUne, servicesCards, servicesRows, programmePage, newsList, between, contactBlock };
