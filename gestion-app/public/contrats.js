/* GEI Gestion — contrats : location de maison, travail, ouvrier / tâcheron, autre.
   Modèles par défaut modifiables, paiements (loyers, salaires, avances), impression avec les coordonnées de GEI. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G) return;
  const { api, esc, toast, fail, views, main, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a);
  const today = () => new Date().toISOString().slice(0, 10);
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const dfr = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "…");
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const argent = () => G.me().role !== "chef";
  const opts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const lettres = (n) => (G.enLettres ? G.enLettres(n) : String(n));

  const TYPES = {
    location: { nom: "Location de maison", court: "Location", ic: "house", prefixe: "LOC", desc: "Bail d'une maison ou d'un appartement : loyer, caution, durée." },
    travail: { nom: "Contrat de travail", court: "Travail", ic: "users", prefixe: "TRA", desc: "Personnel de GEI : fonction, salaire, période d'essai, commissions." },
    ouvrier: { nom: "Contrat d'ouvrier / tâcheron", court: "Ouvrier", ic: "hardhat", prefixe: "OUV", desc: "Travaux à la tâche ou au forfait sur un chantier, avec avances." },
    autre: { nom: "Autre contrat", court: "Autre", ic: "file", prefixe: "CTR", desc: "Fournisseur, sous-traitant, prestataire, assurance…" },
  };
  const STATUTS = { brouillon: "Brouillon", actif: "Actif", termine: "Terminé", resilie: "Résilié" };
  const STATUT_CLASSE = { brouillon: "preparation", actif: "en_cours", termine: "termine", resilie: "pause" };
  const MODES = { especes: "Espèces", virement: "Virement", cheque: "Chèque", mobile_money: "Mobile Money", autre: "Autre" };
  const PERIODES = { mensuel: "par mois", unique: "en une fois (forfait)", journalier: "par jour", hebdomadaire: "par semaine", trimestriel: "par trimestre" };
  // Libellés des champs selon le type de contrat
  const CHAMPS = {
    location: { partie: "Nom et prénoms du locataire", objet: "Désignation du bien loué", lieu: "Situation du bien", montant: "Loyer mensuel" },
    travail: { partie: "Nom et prénoms du salarié", objet: "Fonction(s)", lieu: "Lieu de travail", montant: "Salaire / rémunération" },
    ouvrier: { partie: "Nom de l'ouvrier ou du chef d'équipe", objet: "Travaux confiés", lieu: "Lieu des travaux", montant: "Montant convenu" },
    autre: { partie: "Nom de l'autre partie", objet: "Objet du contrat", lieu: "Lieu", montant: "Montant" },
  };
  const badge = (s) => `<span class="st st--${STATUT_CLASSE[s] || "preparation"}">${esc(STATUTS[s] || s)}</span>`;
  const moisEntre = (a, b) => { if (!a || !b || b < a) return 0; const A = new Date(a + "T12:00:00"), B = new Date(b + "T12:00:00"); return (B.getFullYear() - A.getFullYear()) * 12 + B.getMonth() - A.getMonth() + (B.getDate() >= A.getDate() ? 1 : 0); };
  const dureeTexte = (c) => { const m = c.dateDebut && c.dateFin ? moisEntre(c.dateDebut, c.dateFin) : 0; return m ? (m % 12 === 0 ? `${m / 12} an${m > 12 ? "s" : ""}` : `${m} mois`) : "durée indéterminée"; };
  const joursAvant = (d) => (d ? Math.round((new Date(d + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5) : null);
  const verse = (c, filtre = () => true) => sum((c.paiements || []).filter(filtre), (p) => p.montant);

  // Loyers : ce qui est dû à aujourd'hui (mois commencés depuis le début du bail) et ce qui manque
  function etatLoyer(c) {
    if (c.type !== "location" || !c.montant || !c.dateDebut || c.statut !== "actif") return { du: 0, paye: 0, retard: 0, mois: 0 };
    const fin = c.dateFin && c.dateFin < today() ? c.dateFin : today();
    const mois = Math.max(0, moisEntre(c.dateDebut, fin));
    const paye = verse(c, (p) => !/caution/i.test(p.libelle || ""));
    const du = mois * c.montant;
    return { du, paye, retard: Math.max(0, du - paye), mois };
  }
  // Ce qui reste à payer pour un forfait (ouvrier, prestation)
  const resteForfait = (c) => (c.periodicite === "unique" && c.montant ? Math.max(0, c.montant - verse(c)) : 0);

  /* ---------- Modèles par défaut (modifiables dans « Modèles de contrat ») ---------- */
  const DEFAUTS = {
    location: { titre: "CONTRAT DE BAIL À USAGE D'HABITATION", texte: `ENTRE LES SOUSSIGNÉS :

La société {{entreprise}}, société à responsabilité limitée immatriculée au RCCM sous le numéro {{rccm}}, dont le siège social est situé à {{siege}}, représentée par son Gérant, ci-après dénommée « le Bailleur »,

D'UNE PART,

ET

M./Mme {{partie}}, né(e) le {{naissance}}, titulaire de la pièce d'identité n° {{piece}}, demeurant à {{adresse}}, joignable au {{telephone}}, ci-après dénommé(e) « le Preneur »,

D'AUTRE PART,

IL A ÉTÉ ARRÊTÉ ET CONVENU CE QUI SUIT :

Article 1 : Objet
Le Bailleur donne en location au Preneur, qui accepte, le bien désigné ci-après : {{bien}}, situé à {{lieu}}. Le bien est loué à usage exclusif d'habitation.

Article 2 : Durée
Le présent bail est consenti pour une durée de {{duree}}, à compter du {{date_debut}} jusqu'au {{date_fin}}. Il se renouvellera par tacite reconduction, sauf dénonciation par l'une des parties par écrit, avec un préavis de trois (3) mois.

Article 3 : Loyer
Le loyer mensuel est fixé à {{montant}} ({{montant_lettres}} francs CFA). Il est payable d'avance, au plus tard le cinq (5) de chaque mois, auprès du Bailleur, contre reçu.

Article 4 : Caution et avance
À la signature du présent contrat, le Preneur verse une caution de {{caution}} ({{caution_lettres}} francs CFA) et une avance sur loyer de {{avance}}. La caution sera restituée en fin de bail, déduction faite des loyers impayés et des frais de remise en état éventuels.

Article 5 : Obligations du Preneur
Le Preneur s'engage à :
- payer le loyer aux échéances convenues ;
- user paisiblement des lieux, en bon père de famille, et les entretenir ;
- ne pas sous-louer ni céder le bail sans l'accord écrit du Bailleur ;
- ne faire aucune transformation des lieux sans l'accord écrit du Bailleur ;
- payer les consommations d'eau, d'électricité et les autres charges liées à son occupation ;
- permettre la visite des lieux par le Bailleur, après avoir été prévenu.

Article 6 : Obligations du Bailleur
Le Bailleur s'engage à délivrer le bien en bon état d'usage, à en assurer la jouissance paisible au Preneur et à effectuer les grosses réparations qui lui incombent.

Article 7 : État des lieux
Un état des lieux contradictoire est établi à l'entrée et à la sortie du Preneur.

Article 8 : Résiliation
À défaut de paiement d'un seul terme de loyer à son échéance, ou d'inexécution de l'une des clauses du présent contrat, et un mois après une mise en demeure restée sans effet, le bail sera résilié de plein droit si bon semble au Bailleur.

Article 9 : Litiges
Les parties s'engagent à régler à l'amiable tout différend né de l'exécution du présent contrat. À défaut, le litige sera porté devant les juridictions compétentes d'Abidjan.

Fait à Abidjan, le {{date_signature}}, en deux (2) exemplaires originaux.` },

    travail: { titre: "CONTRAT DE TRAVAIL", texte: `ENTRE LES SOUSSIGNÉS :

La société {{entreprise}}, société à responsabilité limitée immatriculée au RCCM sous le numéro {{rccm}}, dont le siège social est situé à {{siege}}, représentée par son Gérant, ci-après dénommée « l'Employeur »,

D'UNE PART,

ET

M./Mme {{partie}}, né(e) le {{naissance}}, titulaire de la pièce d'identité n° {{piece}}, demeurant à {{adresse}}, joignable au {{telephone}}, ci-après dénommé(e) « le Salarié »,

D'AUTRE PART,

IL A ÉTÉ ARRÊTÉ ET CONVENU CE QUI SUIT :

Article 1 : Objet
Le présent contrat tient lieu d'engagement réciproque entre les parties. L'Employeur s'oblige à verser un salaire au Salarié en contrepartie de l'exécution de sa tâche au sein de l'entreprise.

Article 2 : Fonction et obligations du Salarié
Le Salarié exercera les fonctions de : {{objet}}.
Il s'engage à exécuter avec soin les tâches qui lui sont confiées, à respecter les instructions de l'Employeur et le règlement intérieur de l'entreprise.

Article 3 : Nature et durée du contrat
Le présent contrat est un {{type_contrat}}. Il prend effet le {{date_debut}}{{fin_contrat}}.

Article 4 : Période d'essai
Le présent contrat est soumis à une période d'essai de {{essai}}, pendant laquelle chacune des parties peut y mettre fin sans préavis ni indemnité.

Article 5 : Lieu de travail
Le Salarié exercera ses fonctions à {{lieu}}. Il pourra être amené à se déplacer sur les chantiers et les programmes de l'entreprise.

Article 6 : Rémunération
En contrepartie de son travail, le Salarié percevra une rémunération de {{montant}} ({{montant_lettres}} francs CFA) {{periodicite}}, payable à la fin de chaque mois.

Article 7 : Horaires et congés
Les horaires de travail et les congés sont ceux en vigueur dans l'entreprise, conformément au Code du travail ivoirien.

Article 8 : Confidentialité
Le Salarié s'engage à ne divulguer aucune information concernant l'entreprise, ses clients, ses prix et ses projets, pendant et après l'exécution du présent contrat.

Article 9 : Commission sur vente immobilière (le cas échéant)
En sa qualité d'apporteur d'affaires, le Salarié bénéficiera d'une commission sur toute vente de bien immobilier réalisée et effectivement conclue grâce à son intervention. Les commissions sont fixées comme suit :
- Vente d'une maison située à Abengourou : un montant forfaitaire de 200 000 FCFA sur les villas basses de trois et quatre pièces dont le prix de vente est évalué à 10 500 000 FCFA ;
- Vente d'une maison située à Adiaké : 4 % sur une villa de 40 000 000 FCFA à 45 000 000 FCFA ;
- Vente d'une maison située à Djorobité 1 : 4 % sur une villa dont le prix de vente est compris entre 70 000 000 FCFA et 95 000 000 FCFA ;
- Vente d'une maison située à Bingerville : 3 % sur une villa estimée entre 75 000 000 FCFA et 95 000 000 FCFA ;
- Vente d'une maison au stade de gros œuvre : 500 000 FCFA sur une maison évaluée entre 65 000 000 FCFA et 75 000 000 FCFA ;
- 2,5 % sur la vente des biens allant de 150 000 000 à 350 000 000 FCFA (terrain ou maison) ;
- une commission comprise entre 2 et 3 % sur le devis des marchés de construction de maison.
La commission est payable après validation de la vente par l'entreprise et encaissement effectif des frais liés à ladite vente. L'entreprise se réserve le droit de modifier le barème des commissions selon les besoins et les réalités commerciales, après information préalable du Salarié.

Article 10 : Décharge de responsabilité
Les biens objets des ventes appartiennent à l'entreprise GLOBAL EMPIRE IMMOBILIER Sarl (GEI). Le Salarié, agissant comme apporteur d'affaires, a uniquement pour mission de rechercher de potentiels acquéreurs moyennant rétribution.

Article 11 : Rupture du contrat
Chacune des parties peut mettre fin au présent contrat dans les conditions prévues par le Code du travail ivoirien, en respectant le préavis légal, sauf faute grave.

Article 12 : Litiges
Tout différend relatif à l'exécution du présent contrat sera réglé à l'amiable ou, à défaut, porté devant l'Inspection du travail puis le Tribunal du travail d'Abidjan.

Fait à Abidjan, le {{date_signature}}, en deux (2) exemplaires originaux.` },

    ouvrier: { titre: "CONTRAT DE PRESTATION DE TRAVAUX (TÂCHERON)", texte: `ENTRE LES SOUSSIGNÉS :

La société {{entreprise}}, société à responsabilité limitée immatriculée au RCCM sous le numéro {{rccm}}, dont le siège social est situé à {{siege}}, représentée par son Gérant, ci-après dénommée « le Maître d'ouvrage »,

D'UNE PART,

ET

M. {{partie}}, titulaire de la pièce d'identité n° {{piece}}, demeurant à {{adresse}}, joignable au {{telephone}}, ci-après dénommé « le Prestataire »,

D'AUTRE PART,

IL A ÉTÉ ARRÊTÉ ET CONVENU CE QUI SUIT :

Article 1 : Objet
Le Maître d'ouvrage confie au Prestataire, qui accepte, l'exécution des travaux suivants : {{objet}}, sur le chantier {{chantier}}, situé à {{lieu}}.

Article 2 : Délai d'exécution
Les travaux débuteront le {{date_debut}} et devront être achevés au plus tard le {{date_fin}} (délai : {{delai}}).

Article 3 : Prix
Le prix des travaux est fixé à {{montant}} ({{montant_lettres}} francs CFA) {{periodicite}}. Ce prix comprend la main-d'œuvre du Prestataire et de son équipe.

Article 4 : Modalités de paiement
Le paiement se fera par avances successives selon l'avancement des travaux constaté par le Maître d'ouvrage. Le solde sera versé après la réception des travaux. Chaque paiement donne lieu à un reçu signé par le Prestataire.

Article 5 : Obligations du Prestataire
Le Prestataire s'engage à :
- exécuter les travaux selon les règles de l'art, les plans et les instructions du Maître d'ouvrage ;
- respecter les délais convenus ;
- utiliser avec soin les matériaux mis à sa disposition et éviter tout gaspillage ;
- veiller à la sécurité de son équipe sur le chantier ;
- reprendre à ses frais les travaux mal exécutés.

Article 6 : Pénalités de retard
Tout retard non justifié dans l'exécution des travaux pourra entraîner une retenue sur le montant restant dû, fixée d'un commun accord entre les parties.

Article 7 : Réception des travaux
À la fin des travaux, une réception est faite contradictoirement. Les éventuelles réserves doivent être levées par le Prestataire avant le paiement du solde.

Article 8 : Résiliation
En cas de manquement grave du Prestataire (abandon de chantier, malfaçons répétées, vol de matériel), le Maître d'ouvrage peut résilier le présent contrat sans indemnité, après simple constat. Les travaux réellement exécutés seront payés au prorata.

Article 9 : Litiges
Les parties s'engagent à régler à l'amiable tout différend. À défaut, les juridictions compétentes d'Abidjan seront seules saisies.

Fait à Abidjan, le {{date_signature}}, en deux (2) exemplaires originaux.` },

    autre: { titre: "CONTRAT", texte: `ENTRE LES SOUSSIGNÉS :

La société {{entreprise}}, société à responsabilité limitée immatriculée au RCCM sous le numéro {{rccm}}, dont le siège social est situé à {{siege}}, représentée par son Gérant,

D'UNE PART,

ET

{{partie}}, demeurant à {{adresse}}, joignable au {{telephone}},

D'AUTRE PART,

IL A ÉTÉ ARRÊTÉ ET CONVENU CE QUI SUIT :

Article 1 : Objet
Le présent contrat a pour objet : {{objet}}.

Article 2 : Durée
Le présent contrat prend effet le {{date_debut}} pour une durée de {{duree}}.

Article 3 : Prix et paiement
Le montant convenu est de {{montant}} ({{montant_lettres}} francs CFA) {{periodicite}}.

Article 4 : Obligations des parties
Chacune des parties s'engage à exécuter de bonne foi les obligations prévues au présent contrat.

Article 5 : Résiliation
En cas de manquement de l'une des parties, l'autre partie pourra résilier le présent contrat après une mise en demeure restée sans effet pendant quinze (15) jours.

Article 6 : Litiges
Tout différend sera réglé à l'amiable ou, à défaut, devant les juridictions compétentes d'Abidjan.

Fait à Abidjan, le {{date_signature}}, en deux (2) exemplaires originaux.` },
  };
  const VARIABLES = [["partie", "nom de l'autre partie"], ["piece", "n° de pièce d'identité"], ["naissance", "date et lieu de naissance"], ["adresse", "adresse"], ["telephone", "téléphone"],
    ["objet", "objet / fonction / travaux"], ["bien", "bien loué"], ["lieu", "lieu"], ["chantier", "chantier"], ["montant", "montant"], ["montant_lettres", "montant en lettres"],
    ["caution", "caution"], ["avance", "avance"], ["periodicite", "périodicité"], ["date_debut", "date de début"], ["date_fin", "date de fin"], ["duree", "durée"], ["essai", "période d'essai"],
    ["delai", "délai"], ["type_contrat", "CDI, CDD…"], ["date_signature", "date de signature"], ["reference", "référence"], ["entreprise", "nom de GEI"], ["rccm", "RCCM"], ["siege", "siège social"]];

  let modelesCache = null;
  async function modeles() {
    if (!modelesCache) { const l = await api("/api/g/modeles").catch(() => []); modelesCache = {}; for (const m of l) modelesCache[m.type] = m; }
    return modelesCache;
  }
  const modeleDe = async (type) => { const m = (await modeles())[type]; return m ? { titre: m.titre || DEFAUTS[type].titre, texte: m.texte } : DEFAUTS[type]; };

  // Remplace les {{variables}} par les informations du contrat
  function remplir(texte, c, ctx) {
    const e = ctx.entreprise || {}, p = e.pied || {};
    const ch = (ctx.chantiers || []).find((x) => x.id === c.chantierId), ma = (ctx.maisons || []).find((x) => x.id === c.maisonId);
    const v = {
      entreprise: e.nom || "Global Empire Immobilier SARL", rccm: p.rccm || "", siege: p.siege || e.adresse || "",
      partie: c.partie, piece: c.partiePiece, naissance: c.partieNaissance, adresse: c.partieAdresse, telephone: c.partieTel,
      objet: c.objet, lieu: c.lieu || (ch && ch.lieu) || "", chantier: ch ? ch.nom : "", bien: c.objet || (ma ? `${ma.type || "maison"}, ${ma.programme} lot ${ma.lot}` : ""),
      montant: c.montant ? fcfa(c.montant).replace(" F", " FCFA") : "", montant_lettres: c.montant ? lettres(c.montant) : "", caution: c.caution ? fcfa(c.caution).replace(" F", " FCFA") : "0 FCFA",
      caution_lettres: lettres(c.caution || 0), avance: c.avance ? fcfa(c.avance).replace(" F", " FCFA") : "0 FCFA", periodicite: PERIODES[c.periodicite] || "",
      date_debut: dfr(c.dateDebut), date_fin: dfr(c.dateFin), duree: dureeTexte(c), essai: c.essai || "…", delai: c.delai || dureeTexte(c),
      type_contrat: c.contratType || "contrat à durée indéterminée (CDI)", fin_contrat: c.dateFin ? ` et prend fin le ${dfr(c.dateFin)}` : "",
      date_signature: dfr(c.dateSignature || today()), reference: c.reference || "",
    };
    return String(texte || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in v ? (v[k] || "…………………") : m));
  }

  /* ---------- Liste des contrats ---------- */
  views["g-contrats"] = async (filtre) => {
    if (!argent()) { location.replace("#g-chantiers"); return; }
    const liste = await api("/api/g/contrats");
    const ft = TYPES[filtre] ? filtre : "";
    const actifs = liste.filter((c) => c.statut === "actif");
    const bientot = actifs.filter((c) => { const j = joursAvant(c.dateFin); return j !== null && j >= 0 && j <= 30; });
    const loyers = actifs.filter((c) => c.type === "location");
    const loyerMois = sum(loyers, (c) => c.montant), impayes = sum(loyers, (c) => etatLoyer(c).retard);
    const vus = liste.filter((c) => !ft || c.type === ft).sort((a, b) => String(b.dateDebut || b.creeLe || "").localeCompare(String(a.dateDebut || a.creeLe || "")));
    const n = (t) => liste.filter((c) => c.type === t).length;
    main.innerHTML = U.head("Contrats", "Locations, contrats de travail, ouvriers et autres : le contrat, les paiements et les échéances.",
      `<a class="btn btn--secondary" href="#g-modeles">${I("file")}Modèles de contrat</a><a class="btn btn--primary" href="#g-contrat/nouveau">${I("plus")}Nouveau contrat</a>`, [["Opérations", "#g-contrats"], ["Contrats", ""]]) + `
      <div class="kpis kpis--4">
        <div class="kpi"><small>Contrats actifs</small><b>${actifs.length}</b><span>${liste.length} au total</span></div>
        <div class="kpi"><small>Loyers attendus par mois</small><b>${fcfa(loyerMois)}</b><span>${loyers.length} location(s) active(s)</span></div>
        <div class="kpi${impayes ? " kpi--alert" : ""}"><small>Loyers impayés</small><b>${fcfa(impayes)}</b><span>à ce jour</span></div>
        <div class="kpi${bientot.length ? " kpi--alert" : ""}"><small>Fin dans 30 jours</small><b>${bientot.length}</b><span>à renouveler ou clôturer</span></div>
      </div>
      <section class="panel">
        <div class="chips" role="group" aria-label="Type de contrat"><a class="chip${!ft ? " is-on" : ""}" href="#g-contrats">Tous <b>${liste.length}</b></a>${Object.entries(TYPES).map(([k, t]) => `<a class="chip${k === ft ? " is-on" : ""}" href="#g-contrats/${k}">${t.court} <b>${n(k)}</b></a>`).join("")}</div>
        ${vus.length ? U.tableau([
          ["Référence", (c) => `<b>${esc(c.reference || "—")}</b>`],
          ["Type", (c) => esc(TYPES[c.type].court)],
          ["Partie", (c) => `<b>${esc(c.partie)}</b>${c.partieTel ? `<br><small class="muted">${esc(c.partieTel)}</small>` : ""}`],
          ["Objet", (c) => esc(c.objet || "—")],
          ["Montant", (c) => (c.montant ? `${fcfa(c.montant)}<br><small class="muted">${esc(PERIODES[c.periodicite] || "")}</small>` : "—"), 1],
          ["Fin", (c) => { const j = joursAvant(c.dateFin); return c.dateFin ? `${U.dateFr(c.dateFin)}${c.statut === "actif" && j !== null && j <= 30 ? `<br><small class="${j < 0 ? "t-bad" : "t-warn"}">${j < 0 ? "dépassée" : `dans ${j} j`}</small>` : ""}` : "—"; }],
          ["À suivre", (c) => { const r = etatLoyer(c).retard || resteForfait(c); return r ? `<b class="t-bad">${fcfa(r)}</b><br><small class="muted">${c.type === "location" ? "loyers impayés" : "reste à payer"}</small>` : "—"; }, 1],
          ["Statut", (c) => badge(c.statut)],
        ], vus, (c) => `#g-contrat/${c.id}`) : U.vide(ft ? `Aucun contrat de type « ${TYPES[ft].court} » pour le moment.` : "Aucun contrat pour le moment. Cliquez sur « Nouveau contrat ».", "file")}
      </section>`;
  };

  /* ---------- Fiche contrat ---------- */
  views["g-contrat"] = async (arg) => {
    if (!argent()) { location.replace("#g-chantiers"); return; }
    const [cid, quoi] = String(arg || "").split("/");
    if (cid === "nouveau" && !TYPES[quoi]) {
      main.innerHTML = U.head("Nouveau contrat", "Choisissez le type de contrat : le modèle correspondant se remplit tout seul.", `<a class="btn btn--tertiary" href="#g-contrats">${I("chevleft")}Retour</a>`, [["Contrats", "#g-contrats"], ["Nouveau contrat", ""]]) +
        `<section class="panel"><div class="imp-cards">${Object.entries(TYPES).map(([k, t]) => `<a class="imp-card" href="#g-contrat/nouveau/${k}" style="text-decoration:none"><span class="imp-card__ic">${I(t.ic, "ic--20")}</span><b>${esc(t.nom)}</b><p>${esc(t.desc)}</p><span class="btn btn--secondary btn--sm">${I("plus")}Créer</span></a>`).join("")}</div></section>`;
      return;
    }
    const isNew = cid === "nouveau";
    const [liste, chantiers, maisons, entreprise] = await Promise.all([api("/api/g/contrats"), api("/api/g/chantiers"), api("/api/g/maisons").catch(() => []), api("/api/g/entreprise").catch(() => ({}))]);
    let c;
    if (isNew) {
      const m = await modeleDe(quoi), an = new Date().getFullYear();
      const rang = liste.filter((x) => x.type === quoi && String(x.reference || "").includes(`-${an}-`)).length + 1;
      c = { type: quoi, statut: "brouillon", reference: `GEI-${TYPES[quoi].prefixe}-${an}-${String(rang).padStart(3, "0")}`, titre: m.titre, texte: m.texte,
        periodicite: quoi === "ouvrier" || quoi === "autre" ? "unique" : "mensuel", dateSignature: today(), dateDebut: today(), contratType: quoi === "travail" ? "contrat à durée indéterminée (CDI)" : "", paiements: [], documents: [] };
    } else c = liste.find((x) => x.id === cid);
    if (!c) { main.innerHTML = U.vide("Contrat introuvable.", "file"); return; }
    if (quoi === "imprimer") return imprimer(c, { entreprise, chantiers, maisons });
    const pay = (c.paiements || []).map((p) => ({ ...p })), documents = (c.documents || []).map((d) => ({ ...d }));
    const L = () => CHAMPS[$("#f [name=type]") ? $("#f [name=type]").value : c.type];
    const sec = (n, t, s) => `<div class="sec__head"><span class="sec__n">${n}</span><div><h2>${t}</h2><p>${s}</p></div></div>`;
    const champ = (types, html) => `<div class="ct-f" data-types="${types}">${html}</div>`;
    main.innerHTML = U.head(isNew ? `Nouveau : ${TYPES[c.type].nom.toLowerCase()}` : esc(c.reference || c.partie), isNew ? "Remplissez les informations : le texte du contrat se met à jour tout seul." : `${badge(c.statut)} · ${esc(TYPES[c.type].nom)} · ${esc(c.partie)}`,
      `<a class="btn btn--tertiary" href="#g-contrats">${I("chevleft")}Retour</a>`, [["Contrats", "#g-contrats"], [isNew ? "Nouveau contrat" : esc(c.reference || c.partie), ""]]) + `
      <form class="form form--split" id="f" novalidate>
        <div class="form__main">
          <section class="panel">${sec(1, "Type et parties", "Le type de contrat et la personne avec qui GEI signe.")}
            <div class="grid">
              <label><span>Type de contrat</span><select name="type">${opts(Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, t.nom])), c.type)}</select></label>
              <label><span>Statut</span><select name="statut">${opts(STATUTS, c.statut)}</select></label>
              <label><span>Référence</span><input name="reference" value="${esc(c.reference || "")}"></label>
              <label><span>Date de signature</span><input type="date" name="dateSignature" value="${esc(c.dateSignature || "")}"></label>
              <label class="full"><span id="lPartie">${esc(CHAMPS[c.type].partie)} <i class="req">*</i></span><input name="partie" value="${esc(c.partie || "")}" autocomplete="off"></label>
              <label><span>Téléphone</span><input name="partieTel" value="${esc(c.partieTel || "")}" inputmode="tel" placeholder="Ex. 07 00 00 00 00"></label>
              <label><span>N° de pièce d'identité</span><input name="partiePiece" value="${esc(c.partiePiece || "")}" placeholder="CNI, passeport, attestation…"></label>
              <label><span>Date et lieu de naissance</span><input name="partieNaissance" value="${esc(c.partieNaissance || "")}" placeholder="Ex. 12 mars 1990 à Bouaké"></label>
              <label><span>Adresse</span><input name="partieAdresse" value="${esc(c.partieAdresse || "")}" placeholder="Commune, quartier"></label>
            </div></section>
          <section class="panel">${sec(2, "Conditions", "Ce qui est loué, la fonction ou les travaux, les dates et le montant.")}
            <div class="grid">
              ${champ("location", `<label class="full"><span>Maison concernée (facultatif)</span><select name="maisonId"><option value="">— Aucune / autre bien —</option>${maisons.map((m) => `<option value="${m.id}"${m.id === c.maisonId ? " selected" : ""}>${esc(`${m.programme} · lot ${m.lot}${m.type ? " · " + m.type : ""}`)}</option>`).join("")}</select></label>`)}
              ${champ("ouvrier", `<label class="full"><span>Chantier</span><select name="chantierId"><option value="">— Aucun —</option>${chantiers.map((x) => `<option value="${x.id}"${x.id === c.chantierId ? " selected" : ""}>${esc(x.nom)}</option>`).join("")}</select></label>`)}
              <label class="full"><span id="lObjet">${esc(CHAMPS[c.type].objet)}</span><input name="objet" value="${esc(c.objet || "")}"></label>
              <label><span id="lLieu">${esc(CHAMPS[c.type].lieu)}</span><input name="lieu" value="${esc(c.lieu || "")}"></label>
              ${champ("travail", `<label><span>Nature du contrat</span><select name="contratType">${opts({ "contrat à durée indéterminée (CDI)": "CDI", "contrat à durée déterminée (CDD)": "CDD", "contrat de prestation": "Prestation", "contrat de stage": "Stage" }, c.contratType)}</select></label>`)}
              <label><span>Date de début</span><input type="date" name="dateDebut" value="${esc(c.dateDebut || "")}"></label>
              <label><span>Date de fin <small class="muted">(vide si indéterminée)</small></span><input type="date" name="dateFin" value="${esc(c.dateFin || "")}"></label>
              ${champ("travail", `<label><span>Période d'essai</span><input name="essai" value="${esc(c.essai || "")}" placeholder="Ex. trois (3) mois"></label>`)}
              ${champ("ouvrier", `<label><span>Délai d'exécution</span><input name="delai" value="${esc(c.delai || "")}" placeholder="Ex. 45 jours"></label>`)}
              <label><span id="lMontant">${esc(CHAMPS[c.type].montant)}</span><input name="montant" class="money" inputmode="numeric" value="${c.montant || ""}"></label>
              <label><span>Payé</span><select name="periodicite">${opts(PERIODES, c.periodicite)}</select></label>
              ${champ("location", `<label><span>Caution</span><input name="caution" class="money" inputmode="numeric" value="${c.caution || ""}"></label>`)}
              ${champ("location", `<label><span>Avance sur loyer</span><input name="avance" class="money" inputmode="numeric" value="${c.avance || ""}"></label>`)}
            </div></section>
          <section class="panel">${sec(3, "Paiements", "Loyers reçus, salaires ou avances versés. Ils comptent dans la trésorerie.")}
            <div class="ct-pay" id="pay"></div>
            <div class="pay-actions"><button type="button" class="btn btn--secondary btn--sm" id="addPay">${I("plus")}Ajouter un paiement</button></div></section>
          <section class="panel">${sec(4, "Texte du contrat", "Modifiable pour ce contrat. Les mots entre {{ }} sont remplacés automatiquement à l'impression.")}
            <label class="field"><span>Titre</span><input name="titre" value="${esc(c.titre || "")}"></label>
            <label class="field" style="margin-top:14px"><span>Articles</span><textarea name="texte" rows="18" class="ct-texte">${esc(c.texte || "")}</textarea></label>
            <details class="howto"><summary>${I("chevright")}Mots remplacés automatiquement</summary><p class="ct-vars">${VARIABLES.map(([k, l]) => `<code>{{${k}}}</code> ${esc(l)}`).join(" · ")}</p></details>
            <div class="pay-actions"><button type="button" class="btn btn--tertiary btn--sm" id="reset">Remettre le modèle par défaut</button></div></section>
          <section class="panel">${sec(5, "Contrat signé et notes", "Joignez le contrat signé scanné (PDF ou photo).")}
            <div id="docs"></div>
            <label class="field" style="margin-top:14px"><span>Notes</span><textarea name="notes" rows="3">${esc(c.notes || "")}</textarea></label></section>
        </div>
        <aside class="form__side">
          <section class="panel recap" aria-live="polite">
            <div class="recap__top"><span class="t-micro">Récapitulatif</span><span id="kSt"></span></div>
            <div class="recap__total" id="kMont"></div><span class="t-help" id="kPer"></span>
            <div class="recap__lines">
              <div><span>Période</span><b id="kDates"></b></div>
              <div class="is-ok"><span>Total versé</span><b id="kVerse"></b></div>
              <div id="kResteL"><span id="kResteT">Reste à payer</span><b id="kReste"></b></div>
              <div id="kFinL"><span>Échéance</span><b id="kFin"></b></div>
            </div>
            <div class="recap__acts">
              ${isNew ? "" : `<a class="btn btn--primary btn--sm" href="#g-contrat/${c.id}/imprimer" target="_blank" id="print">${I("printer")}Imprimer le contrat</a>`}
              <button type="button" class="btn btn--secondary btn--sm" id="apercu">${I("file")}Aperçu du contrat</button>
            </div>
            ${isNew ? "" : `<p class="recap__meta">Créé par ${esc(c.creePar || "?")}${c.modifiePar ? `, modifié par ${esc(c.modifiePar)}` : ""}.</p>`}
          </section>
          <div class="tip">${I("alertcircle")}<span>Imprimez le contrat, faites-le signer, puis joignez la version signée scannée (section 5).</span></div>
        </aside>
        <div class="savebar">${isNew ? "" : `<button type="button" class="btn btn--danger" id="del">${I("trash")}Supprimer</button>`}<button type="submit" class="btn btn--primary">${I("check")}Enregistrer</button></div>
      </form>`;
    const f = $("#f");
    f.addEventListener("input", () => G.setDirty(true));
    // Champs et libellés selon le type
    const selonType = () => {
      const t = f.type.value, l = CHAMPS[t];
      $$(".ct-f", f).forEach((d) => { d.hidden = !d.dataset.types.split(" ").includes(t); });
      $("#lPartie").innerHTML = `${esc(l.partie)} <i class="req">*</i>`; $("#lObjet").textContent = l.objet; $("#lLieu").textContent = l.lieu; $("#lMontant").textContent = l.montant;
    };
    f.type.addEventListener("change", async () => {
      selonType();
      if (confirm("Mettre le modèle de contrat de ce type à la place du texte actuel ?")) { const m = await modeleDe(f.type.value); f.titre.value = m.titre; f.texte.value = m.texte; }
      calc();
    });
    selonType();
    // Paiements
    const drawPay = () => {
      $("#pay").innerHTML = pay.length ? `<div class="r r--head" style="--cols:150px 1fr 140px 1.2fr 36px"><span>Date</span><span>Montant</span><span>Mode</span><span>Libellé</span><span></span></div>` + pay.map((p, i) => `<div class="r" style="--cols:150px 1fr 140px 1.2fr 36px" data-i="${i}">
          <input type="date" data-k="date" value="${esc(p.date || "")}" aria-label="Date"><div class="ig"><input data-k="montant" class="money" inputmode="numeric" value="${p.montant ? U.sep(p.montant) : ""}" aria-label="Montant"><span class="ig__suffix">FCFA</span></div>
          <select data-k="mode" aria-label="Mode">${opts(MODES, p.mode)}</select><input data-k="libelle" value="${esc(p.libelle || "")}" placeholder="Ex. loyer de mars, avance 1" aria-label="Libellé">
          <button type="button" class="btn btn--tertiary btn--sm btn--icon" data-rm aria-label="Retirer">${I("x")}</button></div>`).join("") : '<p class="muted">Aucun paiement enregistré.</p>';
    };
    $("#pay").addEventListener("input", (e) => { const r = e.target.closest(".r"); if (!r) return; const k = e.target.dataset.k; pay[r.dataset.i][k] = k === "montant" ? num(e.target.value) : e.target.value; G.setDirty(true); calc(); });
    $("#pay").addEventListener("change", (e) => { const r = e.target.closest(".r"); if (r && e.target.dataset.k) { const k = e.target.dataset.k; pay[r.dataset.i][k] = k === "montant" ? num(e.target.value) : e.target.value; calc(); } });
    $("#pay").addEventListener("click", (e) => { if (e.target.closest("[data-rm]")) { pay.splice(+e.target.closest(".r").dataset.i, 1); drawPay(); G.setDirty(true); calc(); } });
    $("#addPay").onclick = () => {
      const t = f.type.value, n = pay.length + 1;
      const lib = t === "location" ? `Loyer ${new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}` : t === "travail" ? `Salaire ${new Date().toLocaleDateString("fr-FR", { month: "long" })}` : `Avance ${n}`;
      pay.push({ date: today(), montant: t === "location" || t === "travail" ? num(f.montant.value) : "", mode: "especes", libelle: lib }); drawPay(); G.setDirty(true); calc();
    };
    drawPay();
    if ($("#docs") && G.docsEditor) G.docsEditor($("#docs"), documents);
    const valeurs = () => { const v = Object.fromEntries(new FormData(f)); return { ...c, ...v, montant: num(v.montant), caution: num(v.caution), avance: num(v.avance), paiements: pay.filter((p) => num(p.montant)).map((p) => ({ ...p, montant: num(p.montant) })), documents }; };
    function calc() {
      const v = valeurs(), tv = verse(v), el = etatLoyer(v), rf = resteForfait(v), j = joursAvant(v.dateFin);
      $("#kSt").innerHTML = badge(v.statut);
      $("#kMont").innerHTML = v.montant ? U.money(v.montant) : '<span class="t-help" style="font:400 15px var(--font-ui)">Montant à indiquer</span>';
      $("#kPer").textContent = v.montant ? PERIODES[v.periodicite] : "";
      $("#kDates").textContent = `${v.dateDebut ? U.dateFr(v.dateDebut) : "?"} → ${v.dateFin ? U.dateFr(v.dateFin) : "indéterminée"}`;
      $("#kVerse").innerHTML = U.money(tv);
      const reste = v.type === "location" ? el.retard : rf;
      $("#kResteT").textContent = v.type === "location" ? "Loyers impayés" : "Reste à payer";
      $("#kReste").innerHTML = v.type === "location" || v.periodicite === "unique" ? U.money(reste) : "—";
      $("#kResteL").className = reste ? "is-bad" : "";
      $("#kFin").textContent = j === null ? "—" : j < 0 ? `dépassée de ${-j} j` : `dans ${j} jour(s)`;
      $("#kFinL").className = v.statut === "actif" && j !== null && j <= 30 ? "is-bad" : "";
    }
    f.addEventListener("input", calc); f.addEventListener("change", calc); calc();
    $("#reset").onclick = async () => { if (!confirm("Remplacer le texte de ce contrat par le modèle par défaut ?")) return; const m = await modeleDe(f.type.value); f.titre.value = m.titre; f.texte.value = m.texte; G.setDirty(true); };
    $("#apercu").onclick = () => imprimer(valeurs(), { entreprise, chantiers, maisons }, true);
    if ($("#print")) $("#print").onclick = (e) => { e.preventDefault(); imprimer(valeurs(), { entreprise, chantiers, maisons }, true); };
    const ok = () => U.valider(f, [["partie", (x) => (x.trim() ? "" : "Indiquez le nom de l'autre partie.")]]);
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!ok()) return;
      const v = valeurs(); delete v.id; delete v.creePar; delete v.creeLe; delete v.modifiePar; delete v.modifieLe;
      try { const r = await api(isNew ? "/api/g/contrats" : `/api/g/contrats/${c.id}`, { method: isNew ? "POST" : "PUT", body: v }); G.setDirty(false); toast("Contrat enregistré"); location.hash = `#g-contrat/${r.id}`; }
      catch (err) { fail(err); }
    });
    if ($("#del")) $("#del").onclick = async () => { if (!confirm("Supprimer définitivement ce contrat ?")) return; try { await api(`/api/g/contrats/${c.id}`, { method: "DELETE" }); G.setDirty(false); toast("Contrat supprimé"); location.hash = "#g-contrats"; } catch (err) { fail(err); } };
  };

  /* ---------- Impression : document A4 avec en-tête et pied de page GEI ---------- */
  function imprimer(c, ctx, fenetre) {
    const e = ctx.entreprise || {}, p = e.pied || {};
    const corps = remplir(c.texte, c, ctx).split(/\n{2,}/).map((bloc) => {
      const lignes = bloc.split("\n");
      if (lignes.every((l) => /^\s*-\s+/.test(l))) return `<ul>${lignes.map((l) => `<li>${esc(l.replace(/^\s*-\s+/, ""))}</li>`).join("")}</ul>`;
      return lignes.map((l) => {
        if (/^\s*-\s+/.test(l)) return `<p class="li">• ${esc(l.replace(/^\s*-\s+/, ""))}</p>`;
        const m = /^(Article\s+\d+\s*:)(.*)$/i.exec(l);
        if (m) return `<h3><u>${esc(m[1].replace(/\s*:$/, ""))}</u> :${esc(m[2])}</h3>`;
        if (/^(ENTRE LES SOUSSIGNÉS|D'UNE PART|D'AUTRE PART|ET|IL A ÉTÉ ARRÊTÉ)/.test(l.trim())) return `<p class="c">${esc(l)}</p>`;
        return `<p>${esc(l)}</p>`;
      }).join("");
    }).join("");
    const signataires = { location: ["Le Bailleur", "Le Preneur"], travail: ["L'Employeur", "Le Salarié"], ouvrier: ["Le Maître d'ouvrage", "Le Prestataire"], autre: ["Pour GEI", "L'autre partie"] }[c.type] || ["Pour GEI", "L'autre partie"];
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(c.reference || "Contrat")} — ${esc(c.partie || "")}</title><style>
      @page { size: A4; margin: 16mm 16mm 30mm; }
      body { font: 11.5pt/1.5 Calibri, "Segoe UI", Arial, sans-serif; color: #111; margin: 0 auto; max-width: 180mm; padding: 10mm 0 34mm; }
      .ent { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #7B7FC4; padding-bottom: 8px; }
      .ent img { width: 92px; height: auto; } .ent .act { font: 900 30pt/1 "Arial Black", Arial, sans-serif; color: #8E92D6; letter-spacing: 1px; -webkit-text-stroke: 1px #5A5FA8; }
      h1 { text-align: center; font-size: 15pt; margin: 22px 0 4px; letter-spacing: .5px; } .ref { text-align: center; color: #555; font-size: 10pt; margin: 0 0 18px; }
      h3 { font-size: 11.5pt; margin: 16px 0 4px; } p { margin: 0 0 6px; text-align: justify; } p.c { font-weight: 700; margin: 10px 0; } p.li { margin: 0 0 3px 14px; }
      ul { margin: 4px 0 8px 18px; padding: 0; } li { margin: 0 0 3px; text-align: justify; }
      .sign { display: flex; justify-content: space-between; margin-top: 36px; page-break-inside: avoid; } .sign div { width: 45%; text-align: center; font-weight: 700; } .sign small { display: block; font-weight: 400; color: #555; margin-top: 4px; } .sign .z { height: 70px; }
      .pied { position: fixed; bottom: 0; left: 0; right: 0; border-top: 2px solid #7B7FC4; padding: 5px 0 0; text-align: center; font: 9.5pt/1.35 "Times New Roman", serif; color: #333; background: #fff; }
      .pied a { color: #333; }
      .bar { text-align: center; margin: 18px 0; } .bar button { padding: 10px 22px; font-size: 14px; border-radius: 999px; border: 0; background: #2F5A1F; color: #fff; cursor: pointer; }
      @media print { .bar { display: none; } body { padding: 0 0 6mm; } }
    </style></head><body>
      <div class="bar"><button onclick="print()">Imprimer / enregistrer en PDF</button></div>
      <div class="ent"><img src="${location.origin}/logo-gei.png" alt="GEI"><span class="act">${esc((p.activite || "Génie civil & BTP").toUpperCase())}</span></div>
      <h1>${esc(c.titre || TYPES[c.type].nom.toUpperCase())}</h1>
      <p class="ref">Référence : ${esc(c.reference || "—")}</p>
      ${corps}
      <div class="sign"><div>${esc(signataires[0])}<small>(signature et cachet)</small><div class="z"></div></div><div>${esc(signataires[1])}<small>(lu et approuvé, signature)</small><div class="z"></div></div></div>
      <div class="pied">Siège Social : ${esc(p.siege || e.adresse || "")}, ${esc(p.banque || "")}<br>RCCM : ${esc(p.rccm || "")} – Cel : ${esc(p.tel || (e.telephones || []).join(" / "))}<br>Email : <a href="mailto:${esc(p.email || e.email || "")}">${esc(p.email || e.email || "")}</a></div>
    </body></html>`;
    if (fenetre) {
      const w = open("", "_blank"); if (!w) return toast("Autorisez les fenêtres pour afficher le contrat.", true);
      w.document.write(html); w.document.close(); return;
    }
    main.innerHTML = `<p class="muted">Le contrat s'ouvre dans une nouvelle fenêtre.</p>`;
    const w = open("", "_blank"); if (!w) { toast("Autorisez les fenêtres pour afficher le contrat.", true); return; }
    w.document.write(html); w.document.close(); history.back();
  }
  G.contratHtml = (c, ctx) => imprimer(c, ctx, true);

  /* ---------- Modèles de contrat (texte par défaut de chaque type) ---------- */
  views["g-modeles"] = async () => {
    if (!argent()) { location.replace("#g-chantiers"); return; }
    modelesCache = null; const enr = await modeles();
    main.innerHTML = U.head("Modèles de contrat", "Le texte de départ de chaque nouveau contrat. Modifiez-le ici : les contrats déjà créés ne changent pas.",
      `<a class="btn btn--tertiary" href="#g-contrats">${I("chevleft")}Retour aux contrats</a>`, [["Contrats", "#g-contrats"], ["Modèles", ""]]) +
      Object.entries(TYPES).map(([k, t]) => { const m = enr[k] || DEFAUTS[k]; return `<section class="panel" data-type="${k}">
        <div class="sec__head"><span class="sec__n">${I(t.ic)}</span><div><h2>${esc(t.nom)}</h2><p>${enr[k] ? "Modèle personnalisé par GEI." : "Modèle par défaut."}</p></div></div>
        <label class="field"><span>Titre</span><input data-k="titre" value="${esc(m.titre || DEFAUTS[k].titre)}"></label>
        <label class="field" style="margin-top:14px"><span>Articles</span><textarea data-k="texte" rows="14" class="ct-texte">${esc(m.texte)}</textarea></label>
        <div class="pay-actions"><button type="button" class="btn btn--primary btn--sm" data-save>${I("check")}Enregistrer ce modèle</button>${enr[k] ? '<button type="button" class="btn btn--tertiary btn--sm" data-defaut>Revenir au modèle d\'origine</button>' : ""}</div></section>`; }).join("") +
      `<section class="panel"><details class="howto" open><summary>${I("chevright")}Mots remplacés automatiquement dans les contrats</summary><p class="ct-vars">${VARIABLES.map(([k, l]) => `<code>{{${k}}}</code> ${esc(l)}`).join(" · ")}</p></details></section>`;
    if (main._clicModeles) main.removeEventListener("click", main._clicModeles);
    main.addEventListener("click", main._clicModeles = async function clic(ev) {
      if (!location.hash.startsWith("#g-modeles")) { main.removeEventListener("click", clic); main._clicModeles = null; return; }
      const s = ev.target.closest("[data-save], [data-defaut]"); if (!s) return;
      const sec = s.closest("[data-type]"), type = sec.dataset.type, existant = enr[type];
      try {
        if (s.matches("[data-defaut]")) { if (!confirm("Revenir au modèle d'origine pour ce type ?")) return; await api(`/api/g/modeles/${existant.id}`, { method: "DELETE" }); toast("Modèle d'origine rétabli"); }
        else {
          const body = { type, titre: $("[data-k=titre]", sec).value, texte: $("[data-k=texte]", sec).value };
          await api(existant ? `/api/g/modeles/${existant.id}` : "/api/g/modeles", { method: existant ? "PUT" : "POST", body }); toast("Modèle enregistré");
        }
        G.setDirty(false); views["g-modeles"]();
      } catch (err) { fail(err); }
    });
    main.addEventListener("input", () => G.setDirty(true), { once: true });
  };

  /* ---------- Alertes (cloche) et trésorerie ---------- */
  const alertesBase = G.alertes;
  G.alertes = async () => {
    const base = alertesBase ? await alertesBase() : [];
    if (!argent()) return base;
    const liste = await api("/api/g/contrats").catch(() => []);
    const plus = [];
    liste.filter((c) => c.statut === "actif").forEach((c) => {
      const j = joursAvant(c.dateFin), r = etatLoyer(c).retard;
      if (r) plus.push({ niveau: "warn", icone: "house", titre: `Loyer impayé : ${c.partie}`, texte: `${fcfa(r)} dus${c.objet ? " · " + c.objet : ""}`, href: `#g-contrat/${c.id}` });
      if (j !== null && j <= 30) plus.push({ niveau: j < 0 ? "bad" : "late", icone: "file", titre: `Contrat ${j < 0 ? "échu" : "bientôt échu"} : ${c.partie}`, texte: `${TYPES[c.type].court} · fin le ${U.dateFr(c.dateFin)}${j >= 0 ? ` (dans ${j} j)` : ""}`, href: `#g-contrat/${c.id}` });
    });
    return base.concat(plus);
  };
  const MODE_COMPTE = { especes: "caisse", virement: "banque", cheque: "banque", mobile_money: "mobile_money", autre: "caisse" };
  const opsBase = G.operations;
  if (opsBase) G.operations = (d) => {
    const ops = opsBase(d);
    (d.contrats || []).forEach((c) => (c.paiements || []).forEach((p) => ops.push({
      date: p.date, sens: c.type === "location" ? "entree" : "sortie", compte: MODE_COMPTE[p.mode] || "caisse",
      origine: c.type === "location" ? "Loyer" : c.type === "travail" ? "Salaire (contrat)" : c.type === "ouvrier" ? "Ouvrier (contrat)" : "Contrat",
      libelle: `${p.libelle || TYPES[c.type].court} · ${c.partie}`, montant: p.montant, href: `#g-contrat/${c.id}`,
    })));
    return ops.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  };
})();
