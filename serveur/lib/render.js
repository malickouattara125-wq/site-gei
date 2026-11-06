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

function card(p, i = 0) {
  return `          <a class="prog" href="programme-${esc(p.slug)}.html" data-type="${esc(p.type)}" data-ville="${esc(p.slug)}" data-price="${esc(p.prixDes)}" data-anim style="--d:${(0.06 * i).toFixed(2)}s">
            <div class="prog__img"><img src="${esc(p.carte || p.image)}" alt="${esc(p.nom)}" loading="lazy">${p.statut ? `<span class="${BADGES[p.badge || ""] || "badge"}">${esc(p.statut)}</span>` : ""}</div>
            <div class="prog__body">
              <p class="prog__city"><i class="ico ico--pin"></i>${esc(p.ville)}</p>
              <h3>${esc(p.nom)}</h3>
              <ul class="chips">${chips(p)}</ul>
              <div class="prog__foot"><span>Dès <b>${num(p.prixDes)} M FCFA</b></span><i class="arrow"></i></div>
            </div>
          </a>`;
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
            <a href="#contact" class="btn btn--primary">Réserver une visite</a>
            ${p.galerie && p.galerie.length ? '<a href="#galerie" class="btn btn--ghost">Voir les photos</a>' : ""}
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

module.exports = { esc, layout, card, cards, programmePage, newsList, between, contactBlock };
