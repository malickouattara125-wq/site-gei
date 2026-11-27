/* Page de connexion : afficher / masquer le mot de passe, avertissement « Majuscules activées »,
   indicateur de chargement et secousse en cas d'erreur. La connexion elle-même reste dans core.js. */
(() => {
  "use strict";
  const form = document.getElementById("loginForm");
  if (!form) return;
  const pw = document.getElementById("loginPw"), eye = document.getElementById("loginEye");
  const caps = document.getElementById("loginCaps"), err = document.getElementById("loginErr");
  const btn = form.querySelector("button[type=submit]");

  // Œil : afficher / masquer le mot de passe (souris, Entrée ou Espace)
  const basculer = () => {
    const visible = pw.type === "password";
    pw.type = visible ? "text" : "password";
    eye.setAttribute("aria-pressed", String(visible));
    eye.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Afficher le mot de passe");
    pw.focus({ preventScroll: true });
  };
  eye.addEventListener("mousedown", (e) => e.preventDefault()); // garde le focus dans le champ
  eye.addEventListener("click", basculer);
  eye.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); basculer(); } });

  // Majuscules activées
  const majuscules = (e) => { if (e.getModifierState) caps.hidden = !e.getModifierState("CapsLock"); };
  form.addEventListener("keydown", majuscules);
  form.addEventListener("keyup", majuscules);
  pw.addEventListener("blur", () => { caps.hidden = true; });

  // Chargement : core.js désactive le bouton pendant la connexion
  new MutationObserver(() => {
    btn.classList.toggle("is-busy", btn.disabled);
    btn.setAttribute("aria-busy", String(btn.disabled));
  }).observe(btn, { attributes: true, attributeFilter: ["disabled"] });

  // Erreur : légère secousse de la carte, puis retour au mot de passe
  new MutationObserver(() => {
    if (err.hidden) return;
    form.classList.remove("is-shake"); void form.offsetWidth; form.classList.add("is-shake");
    pw.select();
  }).observe(err, { attributes: true, attributeFilter: ["hidden"], childList: true });
  form.addEventListener("animationend", () => form.classList.remove("is-shake"));

  // Remettre le mot de passe masqué à chaque affichage de la page
  new MutationObserver(() => {
    const login = document.getElementById("login");
    if (login && !login.hidden) { pw.type = "password"; eye.setAttribute("aria-pressed", "false"); eye.setAttribute("aria-label", "Afficher le mot de passe"); caps.hidden = true; }
  }).observe(document.getElementById("login"), { attributes: true, attributeFilter: ["hidden"] });
})();
