// Paramètres du site modifiables depuis le tableau de bord (onglet « Paramètres du site ») :
// coordonnées, réseaux sociaux, chiffres clés et principaux textes.
// Les pages contiennent des repères <!-- p-xxx:debut --> … <!-- p-xxx:fin --> ; le serveur y écrit les valeurs.
"use strict";
const { esc, between } = require("./render");

// Texte simple, avec *mots* mis en valeur (couleur verte du site)
const hl = (s) => esc(s).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>');
const digits = (s) => String(s || "").replace(/\D/g, "");
// Numéro ivoirien (10 chiffres) -> lien tel:+225…
const telHref = (n) => { const d = digits(n); return d.length === 10 ? `tel:+225${d}` : `tel:+${d}`; };
const waNumber = (n) => { const d = digits(n); return d.length === 10 ? `225${d}` : d; };

const RESEAUX = [
  ["facebook", "Facebook", '<path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.2c-.3 0-1.3-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.2H7.6V12h2.7v10H14V12h2.8l.4-3.5H14z"/>'],
  ["instagram", "Instagram", '<path d="M12 7.3a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm6-7.9a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0zM21.9 7c-.1-1.6-.4-3-1.6-4.2C19.1 1.6 17.6 1.3 16 1.2 14.4 1.1 9.6 1.1 8 1.2c-1.6.1-3 .4-4.2 1.6C2.6 4 2.3 5.4 2.2 7c-.1 1.6-.1 6.4 0 8 .1 1.6.4 3 1.6 4.2 1.2 1.2 2.6 1.5 4.2 1.6 1.6.1 6.4.1 8 0 1.6-.1 3-.4 4.2-1.6 1.2-1.2 1.5-2.6 1.6-4.2.1-1.6.1-6.4 0-8zm-2.1 9.8a3.3 3.3 0 0 1-1.8 1.8c-1.3.5-4.3.4-5.7.4s-4.4.1-5.7-.4a3.3 3.3 0 0 1-1.8-1.8c-.5-1.3-.4-4.3-.4-5.7s-.1-4.4.4-5.7A3.3 3.3 0 0 1 6.6 3.5C7.9 3 10.9 3.1 12.3 3.1s4.4-.1 5.7.4a3.3 3.3 0 0 1 1.8 1.8c.5 1.3.4 4.3.4 5.7s.1 4.4-.4 5.7z"/>'],
  ["tiktok", "TikTok", '<path d="M16.6 2h-3.3v13.3a2.9 2.9 0 1 1-2.9-2.9c.3 0 .6 0 .9.1V9.1a6.2 6.2 0 1 0 5.3 6.2V8.6a7.7 7.7 0 0 0 4.4 1.4V6.7A4.4 4.4 0 0 1 16.6 2z"/>'],
  ["linkedin", "LinkedIn", '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4V21H3V9.75zm6.5 0h3.8v1.6h.06c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5c0-1.2 0-2.75-1.68-2.75-1.68 0-1.94 1.31-1.94 2.66V21h-4V9.75z"/>'],
  ["youtube", "YouTube", '<path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9L15.6 12l-5.8 3.1z"/>'],
];

const telLinks = (list, sep) => (list || []).filter(Boolean).map((n) => `<a href="${telHref(n)}">${esc(n)}</a>`).join(sep);

const blocks = {
  "p-topbar": (p) => `
      <span><i class="ico ico--pin"></i>${esc(p.adresse)}</span>
      <span class="hide-sm"><i class="ico ico--clock"></i>${esc(p.horairesCourt || p.horaires)}</span>
      ${p.email ? `<span class="push hide-sm"><i class="ico ico--mail"></i><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : ""}
      ${(p.telephones || [])[0] ? `<span><i class="ico ico--phone"></i>${telLinks([(p.telephones || [])[0]], "")}</span>` : ""}
      `,
  "p-contact": (p) => `
              ${(p.telephones || []).length ? `<li><i class="ico ico--phone"></i><span>${telLinks(p.telephones, " · ")}</span></li>` : ""}
              ${p.email ? `<li><i class="ico ico--mail"></i><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></li>` : ""}
              ${p.adresseDetail || p.adresse ? `<li><i class="ico ico--pin"></i>${esc(p.adresseDetail || p.adresse)}</li>` : ""}
              ${p.horaires ? `<li><i class="ico ico--clock"></i>${esc(p.horaires)}</li>` : ""}
              ${reseaux(p, "social social--light")}
              `,
  "p-infos": (p) => {
    const tels = (p.telephones || []).filter(Boolean);
    const rows = []; for (let i = 0; i < tels.length; i += 2) rows.push(telLinks(tels.slice(i, i + 2), " · "));
    return `
          <div class="info" data-anim><span class="ico-wrap"><i class="ico ico--pin"></i></span><h3>Siège social</h3><p>${esc(p.adresseDetail || p.adresse)}</p></div>
          <div class="info" data-anim style="--d:.06s"><span class="ico-wrap"><i class="ico ico--clock"></i></span><h3>Horaires</h3><p>${esc(p.horaires)}</p></div>
          <div class="info" data-anim style="--d:.12s"><span class="ico-wrap"><i class="ico ico--phone"></i></span><h3>Téléphones</h3><p>${rows.join("<br>")}</p></div>
          <div class="info" data-anim style="--d:.18s"><span class="ico-wrap"><i class="ico ico--mail"></i></span><h3>E-mail</h3><p>${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ""}</p></div>`;
  },
  "p-pied": (p) => `<h4>Nous joindre</h4>${telLinks(p.telephones, "")}${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ""}`,
  "p-slogan": (p) => `<p>${esc(p.slogan)}</p>${reseaux(p, "social")}`,
  "p-chiffres": (p) => chiffres(p.chiffresAccueil),
  "p-chiffres2": (p) => chiffres(p.chiffresAPropos),
  "p-histoire": (p) => `
          <p class="kicker" data-anim>${esc(p.histoireSurtitre || "Notre histoire")}</p>
          <h2 data-anim style="--d:.06s">${hl(p.histoireTitre)}</h2>
          ${(p.histoireTexte || []).map((t, i) => `<p data-anim style="--d:${(0.1 + i * 0.02).toFixed(2)}s">${hl(t)}</p>`).join("\n          ")}
          ${p.dgNom ? `<p class="story-v__sign" data-anim style="--d:.14s">${esc(p.dgNom)}<span>${esc(p.dgTitre)}</span></p>` : ""}`,
  "p-apropos": (p) => `
          <p class="kicker" data-anim>Qui sommes-nous</p>
          <h2 data-anim style="--d:.06s">${hl(p.aproposTitre)}</h2>
          ${(p.aproposTexte || []).map((t, i) => `<p data-anim style="--d:${(0.1 + i * 0.02).toFixed(2)}s">${hl(t)}</p>`).join("\n          ")}`,
  "p-citation": (p) => `
          <blockquote>${hl(p.citation)}</blockquote>
          <figcaption><img src="assets/img/logo-gei.png" alt=""><span><strong>${esc(p.dgNom)}</strong><span>${esc(p.dgTitre)}</span></span></figcaption>`,
  "p-dates": (p) => (p.dates || []).map((d) => `
          <li data-anim><time>${esc(d.date)}</time><div><h3>${esc(d.titre)}</h3>${d.texte ? `<p>${esc(d.texte)}</p>` : ""}</div></li>`).join(""),
};

function reseaux(p, cls) {
  const links = RESEAUX.filter(([k]) => /^https:\/\//.test((p.reseaux || {})[k] || "")).map(([k, label, svg]) =>
    `<a href="${esc(p.reseaux[k])}" target="_blank" rel="noopener" aria-label="${label}" title="${label}"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg></a>`);
  if (!links.length) return "";
  return cls.includes("light") ? `<li class="${cls}">${links.join("")}</li>` : `<div class="${cls}">${links.join("")}</div>`;
}

function chiffres(list) {
  return (list || []).map((c) => {
    const m = /^(\D*?)(\d+)(\D*)$/.exec(String(c.valeur || "").trim());
    const val = m ? `<b data-count="${m[2]}"${m[1] ? ` data-prefix="${esc(m[1])}"` : ""}${m[3] ? ` data-suffix="${esc(m[3])}"` : ""}>${esc(c.valeur)}</b>` : `<b>${esc(c.valeur)}</b>`;
    return `
            <div>${val}<span>${esc(c.libelle)}</span></div>`;
  }).join("");
}

// Applique les paramètres à une page HTML (les repères absents sont ignorés)
function apply(html, p) {
  if (!p) return html;
  for (const [name, fn] of Object.entries(blocks)) {
    if (html.includes(`<!-- ${name}:debut -->`)) html = between(html, name, fn(p));
  }
  const wa = waNumber(p.whatsapp || (p.telephones || [])[0]);
  if (wa) html = html.replace(/https:\/\/wa\.me\/\d+/g, `https://wa.me/${wa}`);
  return html;
}

module.exports = { apply, waNumber, RESEAUX: RESEAUX.map(([k, l]) => [k, l]) };
