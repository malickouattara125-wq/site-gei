/* GEI Gestion — contrats : location de maison, travail (par métier), ouvrier / tâcheron (par métier), autre.
   Modèles par défaut modifiables, loyers mois par mois (payé, partiel, impayé, payé d'avance), encaissement,
   quittance / reçu / appel de loyer, impression avec les coordonnées de GEI. */
(() => {
  "use strict";
  const G = window.GEI;
  if (!G) return;
  const { api, esc, toast, fail, views, main, $, $$ } = G;
  const U = G.ui, I = (...a) => U.I(...a);
  const today = () => new Date().toISOString().slice(0, 10);
  const moisCourant = () => today().slice(0, 7);
  const fcfa = (n) => (Math.round(+n || 0)).toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const fcfaL = (n) => fcfa(n).replace(/ F$/, " FCFA");
  const dfr = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "…");
  const moisFr = (m) => (m ? new Date(m + "-15T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "");
  const moisPlus = (m, n) => { const d = new Date(m + "-15T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 7); };
  const sum = (a, f = (x) => x) => a.reduce((t, x) => t + (+f(x) || 0), 0);
  const num = (v) => { const x = parseFloat(String(v || "").replace(/[\s  ]/g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  const argent = () => G.me().role !== "chef";
  const opts = (map, v) => Object.entries(map).map(([k, l]) => `<option value="${esc(k)}"${k === v ? " selected" : ""}>${esc(l)}</option>`).join("");
  const lettres = (n) => (G.enLettres ? G.enLettres(n) : String(n));
  const waTel = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length === 10 ? "225" + d : d; };

  const TYPES = {
    location: { nom: "Location de maison", court: "Location", ic: "house", prefixe: "LOC", desc: "Bail d'une maison : loyer, caution, loyers mois par mois, quittances." },
    travail: { nom: "Contrat de travail", court: "Travail", ic: "users", prefixe: "TRA", desc: "Personnel de GEI, selon le métier : missions, salaire, essai, commissions." },
    ouvrier: { nom: "Contrat d'ouvrier / tâcheron", court: "Ouvrier", ic: "hardhat", prefixe: "OUV", desc: "Travaux à la tâche ou au forfait, selon le métier, avec avances." },
    autre: { nom: "Autre contrat", court: "Autre", ic: "file", prefixe: "CTR", desc: "Fournisseur, sous-traitant, prestataire, assurance…" },
  };
  const STATUTS = { brouillon: "Brouillon", actif: "Actif", termine: "Terminé", resilie: "Résilié" };
  const STATUT_CLASSE = { brouillon: "preparation", actif: "en_cours", termine: "termine", resilie: "pause" };
  const MODES = { especes: "Espèces", virement: "Virement", cheque: "Chèque", mobile_money: "Mobile Money", autre: "Autre" };
  const PERIODES = { mensuel: "par mois", unique: "en une fois (forfait)", journalier: "par jour", hebdomadaire: "par semaine", trimestriel: "par trimestre" };
  const CHAMPS = {
    location: { partie: "Nom et prénoms du locataire", objet: "Désignation du bien loué", lieu: "Situation du bien", montant: "Loyer mensuel" },
    travail: { partie: "Nom et prénoms du salarié", objet: "Intitulé du poste", lieu: "Lieu de travail", montant: "Salaire / rémunération" },
    ouvrier: { partie: "Nom de l'ouvrier ou du chef d'équipe", objet: "Travaux confiés", lieu: "Lieu des travaux", montant: "Montant convenu" },
    autre: { partie: "Nom de l'autre partie", objet: "Objet du contrat", lieu: "Lieu", montant: "Montant" },
  };

  /* ---------- Métiers : chaque métier a ses missions dans le contrat ---------- */
  const METIERS = {
    travail: {
      commercial: { nom: "Commercial / apporteur d'affaires", commission: true, essai: "trois (3) mois", missions: ["assurer la prospection de nouveaux marchés en vue d'apporter une nouvelle clientèle à l'entreprise", "présenter les programmes immobiliers de l'entreprise et organiser les visites des biens", "suivre les prospects jusqu'à la réservation et la signature", "rendre compte chaque semaine de son activité commerciale à la direction"] },
      community: { nom: "Community manager", commission: true, essai: "trois (3) mois", missions: ["faire la couverture vidéo des produits de l'entreprise, à travers les filmages et montages vidéos", "assurer la gestion des pages de réseaux sociaux de l'entreprise (Facebook, TikTok, Instagram et LinkedIn)", "participer à la refonte et à la mise à jour du site internet", "réaliser les voix off ainsi que les campagnes publicitaires"] },
      comptable: { nom: "Comptable", essai: "trois (3) mois", missions: ["tenir la comptabilité générale de l'entreprise et classer les pièces justificatives", "suivre les encaissements des clients, les loyers et les paiements aux fournisseurs", "établir les déclarations fiscales et sociales dans les délais", "préparer chaque mois un état de trésorerie pour la direction"] },
      secretaire: { nom: "Secrétaire / assistante de direction", essai: "un (1) mois", missions: ["accueillir les visiteurs et les clients, et répondre au téléphone", "gérer le courrier, l'agenda de la direction et le classement des documents", "saisir et suivre les dossiers clients, les contrats et les tableaux de suivi", "assurer la liaison entre la direction, les chantiers et les partenaires"] },
      conducteur: { nom: "Conducteur de travaux", essai: "trois (3) mois", missions: ["organiser, planifier et suivre l'exécution des chantiers de l'entreprise", "encadrer les chefs de chantier, les ouvriers et les sous-traitants", "contrôler la qualité des travaux, les délais et la consommation des matériaux", "établir les besoins en matériaux et les rapports d'avancement pour la direction"] },
      chef: { nom: "Chef de chantier", essai: "deux (2) mois", missions: ["diriger au quotidien les équipes d'ouvriers sur le chantier", "faire respecter les plans, les règles de l'art et les consignes de sécurité", "tenir le pointage des ouvriers et le suivi des matériaux sur le chantier", "mettre à jour l'avancement des travaux et les photos dans l'application de l'entreprise"] },
      chauffeur: { nom: "Chauffeur", essai: "un (1) mois", missions: ["conduire les véhicules de l'entreprise en respectant le code de la route", "transporter le personnel, les matériaux et les documents selon les instructions", "assurer l'entretien courant et la propreté du véhicule, et signaler toute panne", "tenir à jour le carnet de bord (trajets, carburant, kilométrage)"] },
      gardien: { nom: "Gardien / vigile", essai: "un (1) mois", missions: ["assurer la surveillance du site (chantier, dépôt ou bureau) de jour comme de nuit selon le planning", "contrôler les entrées et les sorties des personnes, des véhicules et des matériaux", "signaler immédiatement tout incident, vol ou dégradation à la direction", "veiller à la fermeture des accès et à la sécurité du matériel"] },
      autre: { nom: "Autre (préciser dans « Intitulé du poste »)", essai: "un (1) mois", missions: ["exercer les fonctions de {{objet}} selon les instructions de l'Employeur"] },
    },
    ouvrier: {
      macon: { nom: "Maçon", missions: ["réaliser les fondations, l'élévation des murs, les chaînages et les enduits selon les plans", "respecter les dosages de béton et de mortier indiqués", "assurer l'aplomb, le niveau et l'alignement des ouvrages"] },
      ferrailleur: { nom: "Ferrailleur", missions: ["façonner et poser les armatures (fers) selon les plans de ferraillage", "respecter les diamètres, les espacements et les enrobages prévus", "réaliser les ligatures et vérifier la stabilité des armatures avant le coulage"] },
      coffreur: { nom: "Coffreur", missions: ["réaliser et poser les coffrages des poteaux, poutres, dalles et escaliers", "assurer l'étaiement et la stabilité des coffrages avant le coulage", "décoffrer avec soin et récupérer le bois réutilisable"] },
      carreleur: { nom: "Carreleur", missions: ["poser les carreaux au sol et aux murs selon le calepinage validé", "assurer la planéité, les joints réguliers et les pentes d'écoulement", "nettoyer les surfaces après la pose et protéger les ouvrages finis"] },
      electricien: { nom: "Électricien", missions: ["réaliser les saignées, la pose des gaines, des boîtiers et du câblage", "installer les appareillages, le tableau électrique et la mise à la terre", "respecter les normes de sécurité électrique et tester l'installation avant la réception"] },
      plombier: { nom: "Plombier", missions: ["poser les canalisations d'alimentation en eau et d'évacuation", "installer les appareils sanitaires, la robinetterie et les regards", "réaliser les essais d'étanchéité et de pression avant la fermeture des murs"] },
      peintre: { nom: "Peintre", missions: ["préparer les supports (grattage, ponçage, enduit, impression)", "appliquer les peintures intérieures et extérieures selon les teintes validées", "protéger les sols et les menuiseries et nettoyer après les travaux"] },
      menuisier: { nom: "Menuisier", missions: ["fabriquer et poser les portes, fenêtres, placards et autres ouvrages en bois ou en aluminium", "assurer l'ajustement, l'étanchéité et le bon fonctionnement des ouvrants", "poser la quincaillerie (serrures, poignées, paumelles)"] },
      soudeur: { nom: "Soudeur / ferronnier", missions: ["fabriquer et poser les grilles, portails, garde-corps et ouvrages métalliques", "réaliser des soudures solides et propres", "appliquer la protection antirouille sur les ouvrages"] },
      manoeuvre: { nom: "Manœuvre", missions: ["assister les ouvriers qualifiés dans leurs tâches", "transporter les matériaux, préparer le mortier et nettoyer le chantier", "respecter les consignes du chef de chantier"] },
      autre: { nom: "Autre (préciser dans « Travaux confiés »)", missions: ["exécuter les travaux décrits ci-dessus selon les instructions du Maître d'ouvrage"] },
    },
  };
  const nomMetier = (type, k) => (METIERS[type] && METIERS[type][k] ? METIERS[type][k].nom.replace(/ \(préciser.*\)$/, "") : "");
  const badge = (s) => `<span class="st st--${STATUT_CLASSE[s] || "preparation"}">${esc(STATUTS[s] || s)}</span>`;
  const moisEntre = (a, b) => { if (!a || !b || b < a) return 0; const A = new Date(a + "T12:00:00"), B = new Date(b + "T12:00:00"); return (B.getFullYear() - A.getFullYear()) * 12 + B.getMonth() - A.getMonth() + (B.getDate() >= A.getDate() ? 1 : 0); };
  const dureeTexte = (c) => { const m = c.dateDebut && c.dateFin ? moisEntre(c.dateDebut, c.dateFin) : 0; return m ? (m % 12 === 0 ? `${m / 12} an${m > 12 ? "s" : ""}` : `${m} mois`) : "durée indéterminée"; };
  const joursAvant = (d) => (d ? Math.round((new Date(d + "T12:00:00") - new Date(today() + "T12:00:00")) / 864e5) : null);
  const verse = (c, filtre = () => true) => sum((c.paiements || []).filter(filtre), (p) => p.montant);
  const estCaution = (p) => p.nature === "caution" || (!p.nature && /caution/i.test(p.libelle || ""));

  /* ---------- Loyers mois par mois ---------- */
  // Chaque paiement de loyer remplit d'abord son mois (s'il est indiqué), puis les mois suivants ;
  // sans mois indiqué, il remplit le plus ancien mois non soldé. Le surplus couvre les mois à venir (payé d'avance).
  function loyers(c) {
    const vide = { mois: [], retard: 0, nbImpayes: 0, du: 0, paye: 0, couvre: new Map() };
    if (c.type !== "location" || !c.montant || !c.dateDebut) return vide;
    const debut = c.dateDebut.slice(0, 7), finBail = c.dateFin ? c.dateFin.slice(0, 7) : null, cur = moisCourant();
    const M = new Map(); const mois = (m) => { if (!M.has(m)) M.set(m, { m, du: c.montant, paye: 0, parts: [] }); return M.get(m); };
    const premierOuvert = (depuis) => { let m = depuis < debut ? debut : depuis; for (let i = 0; i < 240; i++) { if (finBail && m > finBail) return null; if (mois(m).paye < c.montant) return m; m = moisPlus(m, 1); } return null; };
    const couvre = new Map(); let surplus = 0;
    const pays = (c.paiements || []).map((p, i) => ({ p, i })).filter(({ p }) => !estCaution(p) && (!p.nature || p.nature === "loyer" || p.nature === "avance"))
      .sort((a, b) => String(a.p.date || "").localeCompare(String(b.p.date || "")) || a.i - b.i);
    for (const { p, i } of pays) {
      let reste = +p.montant || 0; const pieces = [];
      let m = premierOuvert(p.mois || debut);
      while (reste > 0 && m) { const o = mois(m), x = Math.min(reste, c.montant - o.paye); o.paye += x; o.parts.push({ i, montant: x }); pieces.push({ m, montant: x }); reste -= x; m = premierOuvert(m); }
      if (reste > 0) { surplus += reste; pieces.push({ m: null, montant: reste }); }
      couvre.set(i, pieces);
    }
    // Mois affichés : du début du bail jusqu'au mois courant (ou la fin du bail), plus les mois déjà payés d'avance
    let dernier = finBail && finBail < cur ? finBail : cur; for (const m of M.keys()) if (M.get(m).paye > 0 && m > dernier) dernier = m;
    const liste = []; for (let m = debut; m <= dernier && liste.length < 240; m = moisPlus(m, 1)) {
      const o = mois(m), reste = c.montant - o.paye;
      o.reste = reste; o.statut = !reste ? (m > cur ? "avance" : "paye") : o.paye ? "partiel" : m <= cur ? "impaye" : "avenir"; liste.push(o);
    }
    if (c.statut === "actif" && (!finBail || cur < finBail) && !liste.some((o) => o.m > cur)) { const n = moisPlus(cur, 1); if (!finBail || n <= finBail) { const o = mois(n); o.reste = c.montant - o.paye; o.statut = o.reste ? (o.paye ? "partiel" : "avenir") : "avance"; liste.push(o); } }
    const passes = liste.filter((o) => o.m <= cur);
    return { mois: liste, du: sum(passes, (o) => o.du), paye: sum(passes, (o) => o.paye), retard: c.statut === "actif" || c.statut === "termine" ? sum(passes, (o) => o.reste) : 0,
      nbImpayes: passes.filter((o) => o.reste > 0).length, couvre, surplus };
  }
  const STATUT_LOYER = { paye: ["Payé", "disponible"], partiel: ["Partiel", "reservee"], impaye: ["Impayé", "pause"], avance: ["Payé d'avance", "vendue"], avenir: ["À venir", "preparation"] };
  const badgeLoyer = (s) => `<span class="st st--${STATUT_LOYER[s][1]}">${STATUT_LOYER[s][0]}</span>`;
  const resteForfait = (c) => (c.periodicite === "unique" && c.montant ? Math.max(0, c.montant - verse(c)) : 0);

  /* ---------- Modèles par défaut ---------- */
  const PREAMBULE = (role1, role2, perso) => `ENTRE LES SOUSSIGNÉS :

La société {{entreprise}}, société à responsabilité limitée immatriculée au RCCM sous le numéro {{rccm}}, dont le siège social est situé à {{siege}}, représentée par son Gérant, ci-après dénommée « ${role1} »,

D'UNE PART,

ET

${perso ? "M./Mme {{partie}}, né(e) le {{naissance}}, titulaire de la pièce d'identité n° {{piece}}," : "M. {{partie}}, titulaire de la pièce d'identité n° {{piece}},"} demeurant à {{adresse}}, joignable au {{telephone}}, ci-après dénommé(e) « ${role2} »,

D'AUTRE PART,

IL A ÉTÉ ARRÊTÉ ET CONVENU CE QUI SUIT :`;
  const articles = (liste) => liste.filter(Boolean).map(([t, x], i) => `Article ${i + 1} : ${t}\n${x}`).join("\n\n");
  const puces = (l) => l.map((x) => `- ${x} ;`).join("\n").replace(/ ;$/, ".");
  const FAIT = "Fait à Abidjan, le {{date_signature}}, en deux (2) exemplaires originaux.";
  const COMMISSIONS = `En sa qualité d'apporteur d'affaires, le Salarié bénéficiera d'une commission sur toute vente de bien immobilier réalisée et effectivement conclue grâce à son intervention. Les commissions sont fixées comme suit :
- Vente d'une maison située à Abengourou : un montant forfaitaire de 200 000 FCFA sur les villas basses de trois et quatre pièces dont le prix de vente est évalué à 10 500 000 FCFA ;
- Vente d'une maison située à Adiaké : 4 % sur une villa de 40 000 000 FCFA à 45 000 000 FCFA ;
- Vente d'une maison située à Djorobité 1 : 4 % sur une villa dont le prix de vente est compris entre 70 000 000 FCFA et 95 000 000 FCFA ;
- Vente d'une maison située à Bingerville : 3 % sur une villa estimée entre 75 000 000 FCFA et 95 000 000 FCFA ;
- Vente d'une maison au stade de gros œuvre : 500 000 FCFA sur une maison évaluée entre 65 000 000 FCFA et 75 000 000 FCFA ;
- 2,5 % sur la vente des biens allant de 150 000 000 à 350 000 000 FCFA (terrain ou maison) ;
- une commission comprise entre 2 et 3 % sur le devis des marchés de construction de maison.
La commission est payable après validation de la vente par l'entreprise et encaissement effectif des frais liés à ladite vente. L'entreprise se réserve le droit de modifier le barème des commissions selon les besoins et les réalités commerciales, après information préalable du Salarié.`;
  const CHANTIER_METIERS = ["conducteur", "chef", "gardien", "chauffeur"];

  function texteTravail(k) {
    const m = METIERS.travail[k] || METIERS.travail.autre;
    return `${PREAMBULE("l'Employeur", "le Salarié", true)}

${articles([
      ["Objet", "Le présent contrat tient lieu d'engagement réciproque entre les parties. L'Employeur s'oblige à verser un salaire au Salarié en contrepartie de l'exécution de sa tâche au sein de l'entreprise."],
      ["Fonction et obligations du Salarié", `Le Salarié est engagé en qualité de {{metier}}{{poste}}. À ce titre, il sera notamment chargé de :\n${puces(m.missions)}\nIl s'engage à exécuter avec soin les tâches qui lui sont confiées, à respecter les instructions de l'Employeur et le règlement intérieur de l'entreprise.`],
      ["Nature et durée du contrat", "Le présent contrat est un {{type_contrat}}. Il prend effet le {{date_debut}}{{fin_contrat}}."],
      ["Période d'essai", "Le présent contrat est soumis à une période d'essai de {{essai}}, pendant laquelle chacune des parties peut y mettre fin sans préavis ni indemnité."],
      ["Lieu de travail", `Le Salarié exercera ses fonctions à {{lieu}}.${CHANTIER_METIERS.includes(k) ? " Il pourra être affecté sur les différents chantiers et sites de l'entreprise selon les besoins." : ""}`],
      ["Rémunération", `En contrepartie de son travail, le Salarié percevra une rémunération de {{montant}} ({{montant_lettres}} francs CFA) {{periodicite}}, payable à la fin de chaque mois.${m.commission ? " À cette rémunération s'ajoutent, le cas échéant, les commissions prévues au présent contrat." : ""}`],
      ["Horaires et congés", "Les horaires de travail et les congés sont ceux en vigueur dans l'entreprise, conformément au Code du travail ivoirien."],
      CHANTIER_METIERS.includes(k) ? ["Sécurité", "Le Salarié s'engage à respecter et à faire respecter les consignes de sécurité, à porter les équipements de protection fournis et à signaler sans délai tout danger ou accident."] : null,
      ["Confidentialité", "Le Salarié s'engage à ne divulguer aucune information concernant l'entreprise, ses clients, ses prix et ses projets, pendant et après l'exécution du présent contrat."],
      m.commission ? ["Commission sur vente immobilière", COMMISSIONS] : null,
      m.commission ? ["Décharge de responsabilité", "Les biens objets des ventes appartiennent à l'entreprise GLOBAL EMPIRE IMMOBILIER Sarl (GEI). Le Salarié, agissant comme apporteur d'affaires, a uniquement pour mission de rechercher de potentiels acquéreurs moyennant rétribution."] : null,
      ["Rupture du contrat", "Chacune des parties peut mettre fin au présent contrat dans les conditions prévues par le Code du travail ivoirien, en respectant le préavis légal, sauf faute grave."],
      ["Litiges", "Tout différend relatif à l'exécution du présent contrat sera réglé à l'amiable ou, à défaut, porté devant l'Inspection du travail puis le Tribunal du travail d'Abidjan."],
    ])}

${FAIT}`;
  }
  function texteOuvrier(k) {
    const m = METIERS.ouvrier[k] || METIERS.ouvrier.autre;
    return `${PREAMBULE("le Maître d'ouvrage", "le Prestataire", false)}

${articles([
      ["Objet", "Le Maître d'ouvrage confie au Prestataire, qui accepte, en sa qualité de {{metier}}, l'exécution des travaux suivants : {{objet}}, sur le chantier {{chantier}}, situé à {{lieu}}."],
      ["Consistance des travaux", `Dans le cadre du présent contrat, le Prestataire devra notamment :\n${puces(m.missions)}`],
      ["Délai d'exécution", "Les travaux débuteront le {{date_debut}} et devront être achevés au plus tard le {{date_fin}} (délai : {{delai}})."],
      ["Prix", "Le prix des travaux est fixé à {{montant}} ({{montant_lettres}} francs CFA) {{periodicite}}. Ce prix comprend la main-d'œuvre du Prestataire et de son équipe."],
      ["Modalités de paiement", "Le paiement se fera par avances successives selon l'avancement des travaux constaté par le Maître d'ouvrage. Le solde sera versé après la réception des travaux. Chaque paiement donne lieu à un reçu signé par le Prestataire."],
      ["Obligations du Prestataire", "Le Prestataire s'engage à :\n- exécuter les travaux selon les règles de l'art, les plans et les instructions du Maître d'ouvrage ;\n- respecter les délais convenus ;\n- utiliser avec soin les matériaux mis à sa disposition et éviter tout gaspillage ;\n- veiller à la sécurité de son équipe et porter les équipements de protection ;\n- reprendre à ses frais les travaux mal exécutés."],
      ["Pénalités de retard", "Tout retard non justifié dans l'exécution des travaux pourra entraîner une retenue sur le montant restant dû, fixée d'un commun accord entre les parties."],
      ["Réception des travaux", "À la fin des travaux, une réception est faite contradictoirement. Les éventuelles réserves doivent être levées par le Prestataire avant le paiement du solde."],
      ["Résiliation", "En cas de manquement grave du Prestataire (abandon de chantier, malfaçons répétées, vol de matériel), le Maître d'ouvrage peut résilier le présent contrat sans indemnité, après simple constat. Les travaux réellement exécutés seront payés au prorata."],
      ["Litiges", "Les parties s'engagent à régler à l'amiable tout différend. À défaut, les juridictions compétentes d'Abidjan seront seules saisies."],
    ])}

${FAIT}`;
  }
  const TEXTE_LOCATION = `${PREAMBULE("le Bailleur", "le Preneur", true)}

${articles([
    ["Objet", "Le Bailleur donne en location au Preneur, qui accepte, le bien désigné ci-après : {{bien}}, situé à {{lieu}}. Le bien est loué à usage exclusif d'habitation."],
    ["Durée", "Le présent bail est consenti pour une durée de {{duree}}, à compter du {{date_debut}} jusqu'au {{date_fin}}. Il se renouvellera par tacite reconduction, sauf dénonciation par l'une des parties par écrit, avec un préavis de trois (3) mois."],
    ["Loyer", "Le loyer mensuel est fixé à {{montant}} ({{montant_lettres}} francs CFA). Il est payable d'avance, au plus tard le cinq (5) de chaque mois, auprès du Bailleur, contre reçu. Une quittance est remise pour chaque mois entièrement payé."],
    ["Caution et avance", "À la signature du présent contrat, le Preneur verse une caution de {{caution}} ({{caution_lettres}} francs CFA) et une avance sur loyer de {{avance}}. La caution sera restituée en fin de bail, déduction faite des loyers impayés et des frais de remise en état éventuels."],
    ["Obligations du Preneur", "Le Preneur s'engage à :\n- payer le loyer aux échéances convenues ;\n- user paisiblement des lieux, en bon père de famille, et les entretenir ;\n- ne pas sous-louer ni céder le bail sans l'accord écrit du Bailleur ;\n- ne faire aucune transformation des lieux sans l'accord écrit du Bailleur ;\n- payer les consommations d'eau, d'électricité et les autres charges liées à son occupation ;\n- permettre la visite des lieux par le Bailleur, après avoir été prévenu."],
    ["Obligations du Bailleur", "Le Bailleur s'engage à délivrer le bien en bon état d'usage, à en assurer la jouissance paisible au Preneur et à effectuer les grosses réparations qui lui incombent."],
    ["État des lieux", "Un état des lieux contradictoire est établi à l'entrée et à la sortie du Preneur."],
    ["Résiliation", "À défaut de paiement d'un seul terme de loyer à son échéance, ou d'inexécution de l'une des clauses du présent contrat, et un mois après une mise en demeure restée sans effet, le bail sera résilié de plein droit si bon semble au Bailleur."],
    ["Litiges", "Les parties s'engagent à régler à l'amiable tout différend né de l'exécution du présent contrat. À défaut, le litige sera porté devant les juridictions compétentes d'Abidjan."],
  ])}

${FAIT}`;
  const TEXTE_AUTRE = `${PREAMBULE("GEI", "le Cocontractant", false).replace("M. {{partie}}, titulaire de la pièce d'identité n° {{piece}},", "{{partie}},")}

${articles([
    ["Objet", "Le présent contrat a pour objet : {{objet}}."],
    ["Durée", "Le présent contrat prend effet le {{date_debut}} pour une durée de {{duree}}."],
    ["Prix et paiement", "Le montant convenu est de {{montant}} ({{montant_lettres}} francs CFA) {{periodicite}}."],
    ["Obligations des parties", "Chacune des parties s'engage à exécuter de bonne foi les obligations prévues au présent contrat."],
    ["Résiliation", "En cas de manquement de l'une des parties, l'autre partie pourra résilier le présent contrat après une mise en demeure restée sans effet pendant quinze (15) jours."],
    ["Litiges", "Tout différend sera réglé à l'amiable ou, à défaut, devant les juridictions compétentes d'Abidjan."],
  ])}

${FAIT}`;
  const TITRES = { location: "CONTRAT DE BAIL À USAGE D'HABITATION", travail: "CONTRAT DE TRAVAIL", ouvrier: "CONTRAT DE PRESTATION DE TRAVAUX", autre: "CONTRAT" };
  const defaut = (type, metier) => ({
    titre: type === "ouvrier" && metier && metier !== "autre" ? `CONTRAT DE PRESTATION DE TRAVAUX — ${nomMetier("ouvrier", metier).toUpperCase()}` : TITRES[type],
    texte: type === "location" ? TEXTE_LOCATION : type === "travail" ? texteTravail(metier) : type === "ouvrier" ? texteOuvrier(metier) : TEXTE_AUTRE,
  });
  const VARIABLES = [["partie", "nom de l'autre partie"], ["piece", "n° de pièce d'identité"], ["naissance", "date et lieu de naissance"], ["adresse", "adresse"], ["telephone", "téléphone"],
    ["metier", "métier"], ["poste", "intitulé du poste"], ["objet", "objet / travaux"], ["bien", "bien loué"], ["lieu", "lieu"], ["chantier", "chantier"], ["montant", "montant"], ["montant_lettres", "montant en lettres"],
    ["caution", "caution"], ["avance", "avance"], ["periodicite", "périodicité"], ["date_debut", "date de début"], ["date_fin", "date de fin"], ["duree", "durée"], ["essai", "période d'essai"],
    ["delai", "délai"], ["type_contrat", "CDI, CDD…"], ["date_signature", "date de signature"], ["reference", "référence"], ["entreprise", "nom de GEI"], ["rccm", "RCCM"], ["siege", "siège social"]];

  let modelesCache = null;
  async function modeles() { if (!modelesCache) modelesCache = await api("/api/g/modeles").catch(() => []); return modelesCache; }
  const metierCle = (type, metier) => (type === "travail" || type === "ouvrier" ? metier || "autre" : "");
  async function modeleDe(type, metier) {
    const k = metierCle(type, metier), m = (await modeles()).find((x) => x.type === type && (x.metier || "") === k);
    return m ? { titre: m.titre || defaut(type, k).titre, texte: m.texte, perso: true, id: m.id } : { ...defaut(type, k), perso: false };
  }

  function remplir(texte, c, ctx) {
    const e = ctx.entreprise || {}, p = e.pied || {};
    const ch = (ctx.chantiers || []).find((x) => x.id === c.chantierId), ma = (ctx.maisons || []).find((x) => x.id === c.maisonId);
    const met = nomMetier(c.type, c.metier), poste = c.objet && met && c.objet.toLowerCase() !== met.toLowerCase() ? ` (${c.objet})` : "";
    const v = {
      entreprise: e.nom || "Global Empire Immobilier SARL", rccm: p.rccm || "", siege: p.siege || e.adresse || "",
      partie: c.partie, piece: c.partiePiece, naissance: c.partieNaissance, adresse: c.partieAdresse, telephone: c.partieTel,
      metier: (c.metier === "autre" ? c.objet : met) || c.objet, poste: c.metier === "autre" ? "" : poste,
      objet: c.objet, lieu: c.lieu || (ch && ch.lieu) || "", chantier: ch ? ch.nom : "", bien: c.objet || (ma ? `${ma.type || "maison"}, ${ma.programme} lot ${ma.lot}` : ""),
      montant: c.montant ? fcfaL(c.montant) : "", montant_lettres: c.montant ? lettres(c.montant) : "", caution: fcfaL(c.caution || 0), caution_lettres: lettres(c.caution || 0),
      avance: fcfaL(c.avance || 0), periodicite: PERIODES[c.periodicite] || "", date_debut: dfr(c.dateDebut), date_fin: dfr(c.dateFin), duree: dureeTexte(c),
      essai: c.essai || "…", delai: c.delai || dureeTexte(c), type_contrat: c.contratType || "contrat à durée indéterminée (CDI)",
      fin_contrat: c.dateFin ? ` et prend fin le ${dfr(c.dateFin)}` : "", date_signature: dfr(c.dateSignature || today()), reference: c.reference || "",
    };
    return String(texte || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k) => (k in v ? (v[k] || (k === "poste" ? "" : "…………………")) : m));
  }

  /* ---------- Documents imprimables (contrat, quittance, reçu, appel de loyer) ---------- */
  function documentHtml(ctx, { titre, ref, corps, signatures, wa }) {
    const e = ctx.entreprise || {}, p = e.pied || {};
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)}${ref ? " — " + esc(ref) : ""}</title><style>
      @page { size: A4; margin: 16mm 16mm 30mm; }
      body { font: 11.5pt/1.5 Calibri, "Segoe UI", Arial, sans-serif; color: #111; margin: 0 auto; max-width: 180mm; padding: 10mm 0 34mm; }
      .ent { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #7B7FC4; padding-bottom: 8px; }
      .ent img { width: 92px; height: auto; } .ent .act { font: 900 30pt/1 "Arial Black", Arial, sans-serif; color: #8E92D6; letter-spacing: 1px; -webkit-text-stroke: 1px #5A5FA8; }
      h1 { text-align: center; font-size: 15pt; margin: 22px 0 4px; letter-spacing: .5px; } .ref { text-align: center; color: #555; font-size: 10pt; margin: 0 0 18px; }
      h3 { font-size: 11.5pt; margin: 16px 0 4px; } p { margin: 0 0 6px; text-align: justify; } p.c { font-weight: 700; margin: 10px 0; } p.li { margin: 0 0 3px 14px; }
      table.t { width: 100%; border-collapse: collapse; margin: 14px 0; } table.t td, table.t th { border: 1px solid #bbb; padding: 7px 10px; text-align: left; } table.t th { background: #f1f1f8; width: 42%; }
      .big { font-size: 15pt; font-weight: 700; } .ok { color: #1e6b34; font-weight: 700; } .bad { color: #a9402d; font-weight: 700; }
      .sign { display: flex; justify-content: space-between; margin-top: 36px; page-break-inside: avoid; } .sign div { width: 45%; text-align: center; font-weight: 700; } .sign small { display: block; font-weight: 400; color: #555; margin-top: 4px; } .sign .z { height: 70px; }
      .pied { position: fixed; bottom: 0; left: 0; right: 0; border-top: 2px solid #7B7FC4; padding: 5px 0 0; text-align: center; font: 9.5pt/1.35 "Times New Roman", serif; color: #333; background: #fff; }
      .pied a { color: #333; }
      .bar { text-align: center; margin: 18px 0; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; } .bar button, .bar a { padding: 10px 22px; font: 600 14px "Segoe UI", sans-serif; border-radius: 999px; border: 0; background: #0D2299; color: #fff; cursor: pointer; text-decoration: none; } .bar a { background: #1f8f4e; }
      @media print { .bar { display: none; } body { padding: 0 0 6mm; } }
    </style></head><body>
      <div class="bar"><button onclick="print()">Imprimer / enregistrer en PDF</button>${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">Envoyer par WhatsApp</a>` : ""}</div>
      <div class="ent"><img src="${location.origin}/logo-gei.png" alt="GEI"><span class="act">${esc((p.activite || "Génie civil & BTP").toUpperCase())}</span></div>
      <h1>${esc(titre)}</h1>${ref ? `<p class="ref">${esc(ref)}</p>` : ""}
      ${corps}
      <div class="sign">${(signatures || ["Pour GEI"]).map((s, i) => `<div>${esc(s)}<small>${i ? "(lu et approuvé, signature)" : "(signature et cachet)"}</small><div class="z"></div></div>`).join("")}</div>
      <div class="pied">Siège Social : ${esc(p.siege || e.adresse || "")}, ${esc(p.banque || "")}<br>RCCM : ${esc(p.rccm || "")} – Cel : ${esc(p.tel || (e.telephones || []).join(" / "))}<br>Email : <a href="mailto:${esc(p.email || e.email || "")}">${esc(p.email || e.email || "")}</a></div>
    </body></html>`;
  }
  function ouvrir(html, w) {
    w = w || open("", "_blank"); if (!w) { toast("Autorisez les fenêtres pour afficher le document.", true); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  const texteEnHtml = (t) => t.split(/\n{2,}/).map((bloc) => bloc.split("\n").map((l) => {
    if (/^\s*-\s+/.test(l)) return `<p class="li">• ${esc(l.replace(/^\s*-\s+/, ""))}</p>`;
    const m = /^(Article\s+\d+\s*:)(.*)$/i.exec(l);
    if (m) return `<h3><u>${esc(m[1].replace(/\s*:$/, ""))}</u> :${esc(m[2])}</h3>`;
    if (/^(ENTRE LES SOUSSIGNÉS|D'UNE PART|D'AUTRE PART|ET$|IL A ÉTÉ ARRÊTÉ)/.test(l.trim())) return `<p class="c">${esc(l)}</p>`;
    return `<p>${esc(l)}</p>`;
  }).join("")).join("");
  const SIGNATAIRES = { location: ["Le Bailleur", "Le Preneur"], travail: ["L'Employeur", "Le Salarié"], ouvrier: ["Le Maître d'ouvrage", "Le Prestataire"], autre: ["Pour GEI", "Le Cocontractant"] };
  const docContrat = (c, ctx, w) => ouvrir(documentHtml(ctx, { titre: c.titre || TITRES[c.type], ref: `Référence : ${c.reference || "—"}`, corps: texteEnHtml(remplir(c.texte, c, ctx)), signatures: SIGNATAIRES[c.type] }), w);
  const lienWa = (c, msg) => (c.partieTel ? `https://wa.me/${waTel(c.partieTel)}?text=${encodeURIComponent(msg)}` : "");
  const enteteLoc = (c, ctx) => { const ch = (ctx.maisons || []).find((x) => x.id === c.maisonId); return `<table class="t"><tr><th>Locataire</th><td><b>${esc(c.partie)}</b>${c.partieTel ? ` — ${esc(c.partieTel)}` : ""}</td></tr><tr><th>Bien loué</th><td>${esc(c.objet || (ch ? `${ch.programme} lot ${ch.lot}` : "—"))}${c.lieu ? `, ${esc(c.lieu)}` : ""}</td></tr><tr><th>Contrat</th><td>${esc(c.reference || "—")} — loyer mensuel ${fcfaL(c.montant)}</td></tr></table>`; };
  function docQuittance(c, ctx, m, w) {
    const L = loyers(c), o = L.mois.find((x) => x.m === m) || { paye: 0, du: c.montant };
    const dates = [...new Set(o.parts.map((x) => (c.paiements[x.i] || {}).date).filter(Boolean))].map(dfr).join(", ");
    const corps = `<p>Je soussigné, représentant la société <b>${esc((ctx.entreprise || {}).nom || "Global Empire Immobilier SARL")}</b>, bailleur, reconnais avoir reçu de <b>${esc(c.partie)}</b> la somme de <b>${fcfaL(o.paye)}</b> (${esc(lettres(o.paye))} francs CFA), au titre du loyer du mois de <b>${esc(moisFr(m))}</b>, pour le bien désigné ci-dessous, et lui en donne quittance, sous réserve de tous mes droits.</p>
      ${enteteLoc(c, ctx)}<table class="t"><tr><th>Période</th><td>${esc(moisFr(m))}</td></tr><tr><th>Loyer du mois</th><td>${fcfaL(o.du)}</td></tr><tr><th>Montant reçu</th><td class="big">${fcfaL(o.paye)}</td></tr><tr><th>Payé le</th><td>${esc(dates || "—")}</td></tr><tr><th>Reste dû pour ce mois</th><td class="${o.du - o.paye ? "bad" : "ok"}">${o.du - o.paye ? fcfaL(o.du - o.paye) : "Néant — mois soldé"}</td></tr></table>
      <p>Fait à Abidjan, le ${dfr(today())}.</p>`;
    ouvrir(documentHtml(ctx, { titre: "QUITTANCE DE LOYER", ref: `${c.reference || ""} · ${moisFr(m)}`, corps, signatures: ["Le Bailleur"],
      wa: lienWa(c, `Bonjour ${c.partie}, GEI confirme la réception de votre loyer de ${moisFr(m)} : ${fcfaL(o.paye)}. Votre quittance est disponible. Merci et bonne journée.`) }), w);
  }
  function docRecu(c, ctx, i, w) {
    const p = (c.paiements || [])[i]; if (!p) return;
    const L = loyers(c), pieces = c.type === "location" ? L.couvre.get(i) || [] : [];
    const n = (c.paiements || []).slice(0, i + 1).length;
    const detail = pieces.length ? `<table class="t"><tr><th>Mois</th><td><b>Montant affecté</b></td></tr>${pieces.map((x) => { const o = L.mois.find((y) => y.m === x.m); return `<tr><th>${x.m ? esc(moisFr(x.m)) : "Trop-perçu"}</th><td>${fcfaL(x.montant)}${o ? (o.reste ? ` <span class="bad">(reste ${fcfaL(o.reste)} pour ce mois)</span>` : ' <span class="ok">(mois soldé)</span>') : ""}</td></tr>`; }).join("")}</table>` : "";
    const objet = c.type === "location" ? (estCaution(p) ? "caution" : "loyer") : c.type === "travail" ? "salaire / rémunération" : c.type === "ouvrier" ? "avance sur travaux" : "paiement";
    const sensGei = c.type === "location";
    const corps = `<p>${sensGei ? `La société <b>${esc((ctx.entreprise || {}).nom || "Global Empire Immobilier SARL")}</b> reconnaît avoir reçu de <b>${esc(c.partie)}</b>` : `Je soussigné(e) <b>${esc(c.partie)}</b> reconnais avoir reçu de la société <b>${esc((ctx.entreprise || {}).nom || "Global Empire Immobilier SARL")}</b>`} la somme de <b>${fcfaL(p.montant)}</b> (${esc(lettres(p.montant))} francs CFA) au titre de : ${esc(p.libelle || objet)}.</p>
      ${c.type === "location" ? enteteLoc(c, ctx) : `<table class="t"><tr><th>Contrat</th><td>${esc(c.reference || "—")} — ${esc(TYPES[c.type].nom)}</td></tr><tr><th>Objet</th><td>${esc(c.objet || "—")}</td></tr></table>`}
      <table class="t"><tr><th>Reçu n°</th><td>${esc(`${c.reference || "R"}-${String(n).padStart(2, "0")}`)}</td></tr><tr><th>Date du paiement</th><td>${dfr(p.date)}</td></tr><tr><th>Mode de paiement</th><td>${esc(MODES[p.mode] || p.mode)}</td></tr><tr><th>Montant</th><td class="big">${fcfaL(p.montant)}</td></tr>
      ${c.type === "location" && !estCaution(p) ? `<tr><th>Total des loyers impayés après ce paiement</th><td class="${L.retard ? "bad" : "ok"}">${L.retard ? fcfaL(L.retard) : "Aucun"}</td></tr>` : ""}${c.periodicite === "unique" ? `<tr><th>Reste à payer sur le contrat</th><td>${fcfaL(resteForfait(c))}</td></tr>` : ""}</table>
      ${detail}<p>Fait à Abidjan, le ${dfr(today())}.</p>`;
    ouvrir(documentHtml(ctx, { titre: "REÇU DE PAIEMENT", ref: c.reference || "", corps, signatures: sensGei ? ["Pour GEI"] : ["Pour GEI", "Le bénéficiaire"],
      wa: lienWa(c, `Bonjour ${c.partie}, GEI vous confirme ${sensGei ? "la réception de votre paiement" : "le paiement"} de ${fcfaL(p.montant)} du ${dfr(p.date)} (${p.libelle || objet}). Merci.`) }), w);
  }
  function docAppel(c, ctx, m, w) {
    const L = loyers(c), o = L.mois.find((x) => x.m === m) || { du: c.montant, paye: 0, reste: c.montant };
    const anterieur = sum(L.mois.filter((x) => x.m < m), (x) => x.reste || 0), total = anterieur + (o.reste != null ? o.reste : o.du - o.paye);
    const corps = `<p>Madame, Monsieur <b>${esc(c.partie)}</b>,</p><p>Nous vous prions de bien vouloir régler le loyer du mois de <b>${esc(moisFr(m))}</b>, payable au plus tard le <b>5 ${esc(moisFr(m))}</b>, conformément à votre contrat de bail.</p>
      ${enteteLoc(c, ctx)}<table class="t"><tr><th>Loyer de ${esc(moisFr(m))}</th><td>${fcfaL(o.du)}</td></tr><tr><th>Déjà versé pour ce mois</th><td>${fcfaL(o.paye)}</td></tr>${anterieur ? `<tr><th>Impayés des mois précédents</th><td class="bad">${fcfaL(anterieur)}</td></tr>` : ""}<tr><th>Total à payer</th><td class="big">${fcfaL(total)}</td></tr></table>
      <p>Le paiement peut se faire en espèces au siège, par Mobile Money ou par virement. Un reçu vous sera remis, ainsi qu'une quittance pour chaque mois entièrement payé.</p><p>Nous vous remercions de votre confiance.</p><p>Fait à Abidjan, le ${dfr(today())}.</p>`;
    ouvrir(documentHtml(ctx, { titre: "APPEL DE LOYER", ref: `${c.reference || ""} · ${moisFr(m)}`, corps, signatures: ["La Direction"],
      wa: lienWa(c, `Bonjour ${c.partie}, GEI vous rappelle le loyer de ${moisFr(m)} : ${fcfaL(total)} à régler au plus tard le 5 ${moisFr(m)}${anterieur ? ` (dont ${fcfaL(anterieur)} d'impayés précédents)` : ""}. Merci.`) }), w);
  }

  /* ---------- Encaisser un loyer (fenêtre) ---------- */
  async function encaisser(c, ctx, apres) {
    const L = loyers(c), ouverts = L.mois.filter((o) => o.reste > 0);
    const proposition = ouverts.length ? ouverts[0].reste : c.montant;
    const choix = [...ouverts.map((o) => [o.m, `${moisFr(o.m)} — reste ${fcfa(o.reste)}`])];
    const prochain = moisPlus((L.mois[L.mois.length - 1] || { m: moisCourant() }).m, 1); choix.push([prochain, `${moisFr(prochain)} (payer d'avance)`]);
    const d = document.createElement("dialog"); d.className = "enc";
    d.innerHTML = `<form method="dialog" class="enc__f"><h2>Encaisser un loyer</h2><p class="muted">${esc(c.partie)} · ${esc(c.objet || c.reference || "")} · loyer ${fcfa(c.montant)} / mois${L.retard ? ` · <b class="t-bad">${fcfa(L.retard)} impayés</b>` : ""}</p>
      <label class="field"><span>Montant reçu</span><input name="montant" class="money" inputmode="numeric" value="${proposition}"></label>
      <label class="field"><span>À partir du mois de</span><select name="mois">${choix.map(([k, l], i) => `<option value="${k}"${!i ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <p class="t-help">Si le montant dépasse ce mois, le reste paie automatiquement les mois suivants. S'il est plus petit, il compte comme une avance sur le mois.</p>
      <div class="grid"><label class="field"><span>Date</span><input type="date" name="date" value="${today()}"></label><label class="field"><span>Mode</span><select name="mode">${opts(MODES, "especes")}</select></label></div>
      <label class="enc__chk"><input type="checkbox" name="recu" checked> Afficher le reçu après l'enregistrement</label>
      <div class="enc__acts"><button type="button" class="btn btn--secondary" value="annuler" data-x>Annuler</button><button type="submit" class="btn btn--primary" value="ok">${I("check")}Encaisser</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    d.querySelector("[data-x]").onclick = () => d.close();
    d.addEventListener("close", () => setTimeout(() => d.remove(), 50));
    d.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target)), montant = num(v.montant);
      if (!montant) return toast("Indiquez le montant reçu.", true);
      const w = v.recu ? open("", "_blank") : null;
      const nouveau = { date: v.date || today(), montant, mode: v.mode, nature: "loyer", mois: v.mois, libelle: `Loyer ${moisFr(v.mois)}` };
      const body = { ...c, paiements: [...(c.paiements || []), nouveau] }; ["id", "creePar", "creeLe", "modifiePar", "modifieLe"].forEach((k) => delete body[k]);
      try {
        const r = await api(`/api/g/contrats/${c.id}`, { method: "PUT", body });
        d.close(); G.setDirty(false); toast(`Loyer encaissé : ${fcfa(montant)}`);
        if (w) docRecu(r, ctx, r.paiements.length - 1, w);
        if (apres) apres(r);
      } catch (err) { if (w) w.close(); fail(err); }
    });
  }

  /* ---------- Liste des contrats ---------- */
  views["g-contrats"] = async (filtre) => {
    if (!argent()) { location.replace("#g-chantiers"); return; }
    const [liste, entreprise, maisons] = await Promise.all([api("/api/g/contrats"), api("/api/g/entreprise").catch(() => ({})), api("/api/g/maisons").catch(() => [])]);
    const ctx = { entreprise, maisons };
    const ft = TYPES[filtre] ? filtre : "";
    const actifs = liste.filter((c) => c.statut === "actif");
    const bientot = actifs.filter((c) => { const j = joursAvant(c.dateFin); return j !== null && j >= 0 && j <= 30; });
    const locs = actifs.filter((c) => c.type === "location").map((c) => ({ c, L: loyers(c) }));
    const cur = moisCourant();
    const duMois = sum(locs, ({ c }) => c.montant), recuMois = sum(locs, ({ L }) => (L.mois.find((o) => o.m === cur) || { paye: 0 }).paye), impayes = sum(locs, ({ L }) => L.retard);
    const aEncaisser = locs.filter(({ L }) => L.retard > 0 || L.mois.some((o) => o.m === cur && o.reste > 0)).sort((a, b) => b.L.retard - a.L.retard);
    const vus = liste.filter((c) => !ft || c.type === ft).sort((a, b) => String(b.dateDebut || b.creeLe || "").localeCompare(String(a.dateDebut || a.creeLe || "")));
    const n = (t) => liste.filter((c) => c.type === t).length;
    main.innerHTML = U.head("Contrats", "Locations, contrats de travail par métier, ouvriers et autres : le contrat, les paiements et les échéances.",
      `${G.exp.bouton()}<a class="btn btn--secondary" href="#g-modeles">${I("file")}Modèles de contrat</a><a class="btn btn--primary" href="#g-contrat/nouveau">${I("plus")}Nouveau contrat</a>`, [["Opérations", "#g-contrats"], ["Contrats", ""]]) + `
      <div class="kpis kpis--4">
        <div class="kpi"><small>Contrats actifs</small><b>${actifs.length}</b><span>${liste.length} au total</span></div>
        <div class="kpi"><small>Loyers de ${esc(moisFr(cur))}</small><b>${fcfa(recuMois)}</b><span>encaissés sur ${fcfa(duMois)}</span></div>
        <div class="kpi${impayes ? " kpi--alert" : ""}"><small>Loyers impayés</small><b>${fcfa(impayes)}</b><span>${locs.filter(({ L }) => L.retard).length} locataire(s) en retard</span></div>
        <div class="kpi${bientot.length ? " kpi--alert" : ""}"><small>Fin dans 30 jours</small><b>${bientot.length}</b><span>à renouveler ou clôturer</span></div>
      </div>
      ${aEncaisser.length ? `<section class="panel"><div class="sec__head"><span class="sec__n">${I("wallet")}</span><div><h2>Loyers à encaisser</h2><p>Locataires qui doivent un loyer. Cliquez sur « Encaisser » quand vous recevez l'argent.</p></div></div>
        <div class="loy-list">${aEncaisser.map(({ c, L }) => `<div class="loy"><div class="loy__who"><b>${esc(c.partie)}</b><small>${esc(c.objet || c.reference || "")}</small></div>
          <div class="loy__mt"><b class="${L.retard ? "t-bad" : ""}">${fcfa(L.retard || (L.mois.find((o) => o.m === cur) || {}).reste || 0)}</b><small>${L.nbImpayes ? `${L.nbImpayes} mois impayé(s)` : `loyer de ${esc(moisFr(cur))}`}</small></div>
          <div class="loy__acts"><button type="button" class="btn btn--primary btn--sm" data-enc="${c.id}">${I("check")}Encaisser</button><button type="button" class="btn btn--secondary btn--sm" data-appel="${c.id}" title="Appel de loyer">${I("file")}Appel</button><a class="btn btn--tertiary btn--sm" href="#g-contrat/${c.id}">Détail</a></div></div>`).join("")}</div></section>` : ""}
      <section class="panel">
        <div class="chips" role="group" aria-label="Type de contrat"><a class="chip${!ft ? " is-on" : ""}" href="#g-contrats">Tous <b>${liste.length}</b></a>${Object.entries(TYPES).map(([k, t]) => `<a class="chip${k === ft ? " is-on" : ""}" href="#g-contrats/${k}">${t.court} <b>${n(k)}</b></a>`).join("")}</div>
        ${vus.length ? U.tableau([
          ["Référence", (c) => `<b>${esc(c.reference || "—")}</b>`],
          ["Type", (c) => `${esc(TYPES[c.type].court)}${c.metier && nomMetier(c.type, c.metier) ? `<br><small class="muted">${esc(nomMetier(c.type, c.metier))}</small>` : ""}`],
          ["Partie", (c) => `<b>${esc(c.partie)}</b>${c.partieTel ? `<br><small class="muted">${esc(c.partieTel)}</small>` : ""}`],
          ["Objet", (c) => { const m = maisons.find((x) => x.id === c.maisonId); return esc(c.objet || (m ? `${m.bien === "magasin" ? "Magasin · " : ""}${m.programme} · ${m.lot}` : "") || "—"); }],
          ["Montant", (c) => (c.montant ? `${fcfa(c.montant)}<br><small class="muted">${esc(PERIODES[c.periodicite] || "")}</small>` : "—"), 1],
          ["Fin", (c) => { const j = joursAvant(c.dateFin); return c.dateFin ? `${U.dateFr(c.dateFin)}${c.statut === "actif" && j !== null && j <= 30 ? `<br><small class="${j < 0 ? "t-bad" : "t-warn"}">${j < 0 ? "dépassée" : `dans ${j} j`}</small>` : ""}` : "—"; }],
          ["À suivre", (c) => { const L = loyers(c), r = L.retard || resteForfait(c); return r ? `<b class="t-bad">${fcfa(r)}</b><br><small class="muted">${c.type === "location" ? `${L.nbImpayes} mois impayé(s)` : "reste à payer"}</small>` : "—"; }, 1],
          ["Statut", (c) => badge(c.statut)],
        ], vus, (c) => `#g-contrat/${c.id}`) : U.vide(ft ? `Aucun contrat de type « ${TYPES[ft].court} » pour le moment.` : "Aucun contrat pour le moment. Cliquez sur « Nouveau contrat ».", "file")}
      </section>`;
    G.exp.brancher("xp", () => {
      const baux = liste.filter((c) => c.type === "location" && (c.statut === "actif" || c.statut === "termine")).map((c) => ({ c, L: loyers(c) })).sort((a, b) => b.L.retard - a.L.retard || String(a.c.partie).localeCompare(String(b.c.partie)));
      const bien = (c) => { const m = maisons.find((x) => x.id === c.maisonId); return m ? `${m.bien === "magasin" ? "Magasin · " : ""}${m.programme} · lot ${m.lot}` : c.objet || c.lieu || ""; };
      const ST = { actif: "Actif", termine: "Terminé" };
      return { fichier: `GEI_Etat-des-loyers_${cur}`, titre: "État des loyers", orientation: "paysage", filtres: `Situation au ${G.exp.dateFr(G.exp.auj())} · mois en cours : ${moisFr(cur)}`,
        chiffres: [{ l: `Loyers attendus (${moisFr(cur)})`, v: duMois }, { l: "Encaissés ce mois", v: recuMois }, { l: "Loyers impayés", v: impayes, bad: impayes > 0 }, { l: "Locataires en retard", v: locs.filter(({ L }) => L.retard).length, type: "nombre" }],
        feuilles: [
          { nom: "Locataires", titre: "Par locataire", colonnes: [{ t: "Locataire" }, { t: "Téléphone" }, { t: "Bien loué" }, { t: "Loyer mensuel", type: "montant", total: false }, { t: "Début du bail", type: "date" }, { t: "Mois payés", type: "nombre", total: true }, { t: "Mois impayés", type: "nombre", total: true }, { t: "Payé à ce jour", type: "montant" }, { t: "Reste dû", type: "montant" }, { t: "Statut" }],
            lignes: baux.map(({ c, L }) => [c.partie, c.partieTel, bien(c), c.montant, c.dateDebut, L.mois.filter((o) => o.m <= cur && !o.reste).length, L.nbImpayes, L.paye, L.retard, ST[c.statut] || c.statut]) },
          { nom: "Mois par mois", titre: "Mois par mois", colonnes: [{ t: "Locataire" }, { t: "Mois" }, { t: "Dû", type: "montant" }, { t: "Payé", type: "montant" }, { t: "Reste", type: "montant" }, { t: "Statut" }],
            lignes: baux.flatMap(({ c, L }) => L.mois.map((o) => [c.partie, moisFr(o.m), o.du, o.paye, o.reste, STATUT_LOYER[o.statut] ? STATUT_LOYER[o.statut][0] : ""])) },
        ] };
    });
    $$("[data-enc]").forEach((b) => (b.onclick = () => encaisser(liste.find((c) => c.id === b.dataset.enc), ctx, () => views["g-contrats"](filtre))));
    $$("[data-appel]").forEach((b) => (b.onclick = () => { const c = liste.find((x) => x.id === b.dataset.appel), L = loyers(c), o = L.mois.find((x) => x.reste > 0); docAppel(c, ctx, o ? o.m : moisCourant()); }));
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
    const ctx = { entreprise, chantiers, maisons };
    let c;
    if (isNew) {
      const metier = quoi === "travail" ? "commercial" : quoi === "ouvrier" ? "macon" : "";
      const m = await modeleDe(quoi, metier), an = new Date().getFullYear();
      const rang = liste.filter((x) => x.type === quoi && String(x.reference || "").includes(`-${an}-`)).length + 1;
      c = { type: quoi, statut: "brouillon", metier, reference: `GEI-${TYPES[quoi].prefixe}-${an}-${String(rang).padStart(3, "0")}`, titre: m.titre, texte: m.texte,
        periodicite: quoi === "ouvrier" || quoi === "autre" ? "unique" : "mensuel", dateSignature: today(), dateDebut: today(), contratType: quoi === "travail" ? "contrat à durée indéterminée (CDI)" : "",
        essai: quoi === "travail" ? METIERS.travail[metier].essai : "", paiements: [], documents: [] };
    } else c = liste.find((x) => x.id === cid);
    if (!c) { main.innerHTML = U.vide("Contrat introuvable.", "file"); return; }
    if (quoi === "imprimer") { docContrat(c, ctx); history.back(); return; }
    const pay = (c.paiements || []).map((p) => ({ ...p })), documents = (c.documents || []).map((d) => ({ ...d }));
    const sec = (n, t, s) => `<div class="sec__head"><span class="sec__n">${n}</span><div><h2>${t}</h2><p>${s}</p></div></div>`;
    const champ = (types, html) => `<div class="ct-f" data-types="${types}">${html}</div>`;
    const optsMetier = (type, v) => (METIERS[type] ? opts(Object.fromEntries(Object.entries(METIERS[type]).map(([k, m]) => [k, m.nom])), v) : "");
    main.innerHTML = U.head(isNew ? `Nouveau : ${TYPES[c.type].nom.toLowerCase()}` : esc(c.reference || c.partie), isNew ? "Remplissez les informations : le texte du contrat se met à jour tout seul." : `${badge(c.statut)} · ${esc(TYPES[c.type].nom)}${c.metier && nomMetier(c.type, c.metier) ? " · " + esc(nomMetier(c.type, c.metier)) : ""} · ${esc(c.partie)}`,
      `<a class="btn btn--tertiary" href="#g-contrats">${I("chevleft")}Retour</a>`, [["Contrats", "#g-contrats"], [isNew ? "Nouveau contrat" : esc(c.reference || c.partie), ""]]) + `
      <form class="form form--split" id="f" novalidate>
        <div class="form__main">
          <section class="panel">${sec(1, "Type et parties", "Le type de contrat, le métier et la personne avec qui GEI signe.")}
            <div class="grid">
              <label><span>Type de contrat</span><select name="type">${opts(Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, t.nom])), c.type)}</select></label>
              ${champ("travail ouvrier", `<label><span>Métier</span><select name="metier" id="metier">${optsMetier(c.type, c.metier)}</select></label>`)}
              <label><span>Statut</span><select name="statut">${opts(STATUTS, c.statut)}</select></label>
              <label><span>Référence</span><input name="reference" value="${esc(c.reference || "")}"></label>
              <label><span>Date de signature</span><input type="date" name="dateSignature" value="${esc(c.dateSignature || "")}"></label>
              <label class="full"><span id="lPartie">${esc(CHAMPS[c.type].partie)} <i class="req">*</i></span><input name="partie" value="${esc(c.partie || "")}" autocomplete="off"></label>
              <label><span>Téléphone (WhatsApp)</span><input name="partieTel" value="${esc(c.partieTel || "")}" inputmode="tel" placeholder="Ex. 07 00 00 00 00"></label>
              <label><span>N° de pièce d'identité</span><input name="partiePiece" value="${esc(c.partiePiece || "")}" placeholder="CNI, passeport, attestation…"></label>
              <label><span>Date et lieu de naissance</span><input name="partieNaissance" value="${esc(c.partieNaissance || "")}" placeholder="Ex. 12 mars 1990 à Bouaké"></label>
              <label><span>Adresse</span><input name="partieAdresse" value="${esc(c.partieAdresse || "")}" placeholder="Commune, quartier"></label>
            </div></section>
          <section class="panel">${sec(2, "Conditions", "Ce qui est loué, le poste ou les travaux, les dates et le montant.")}
            <div class="grid">
              ${champ("location", `<label class="full"><span>Maison ou magasin concerné (facultatif)</span><select name="maisonId"><option value="">— Aucun / autre bien —</option>${maisons.map((m) => `<option value="${m.id}"${m.id === c.maisonId ? " selected" : ""}>${esc(`${m.bien === "magasin" ? "Magasin · " : ""}${m.programme} · lot ${m.lot}${m.type ? " · " + m.type : ""}`)}</option>`).join("")}</select></label>`)}
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
          ${champ("location", `<section class="panel" id="secLoyers">${sec(3, "Loyers mois par mois", "Payé, partiel (avance), impayé ou payé d'avance. Les paiements remplissent les mois du plus ancien au plus récent.")}
            <div id="loyers"></div>
            <div class="pay-actions">${isNew ? '<span class="t-help">Enregistrez d\'abord le contrat pour encaisser des loyers.</span>' : `<button type="button" class="btn btn--primary btn--sm" id="enc">${I("check")}Encaisser un loyer</button>`}</div></section>`)}
          <section class="panel">${sec(I("wallet"), "Paiements", "Tous les paiements du contrat. Ils comptent dans la trésorerie. Icône imprimante : le reçu.")}
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
              <div class="is-ok"><span id="kVerseT">Total versé</span><b id="kVerse"></b></div>
              <div id="kResteL"><span id="kResteT">Reste à payer</span><b id="kReste"></b></div>
              <div id="kFinL"><span>Échéance</span><b id="kFin"></b></div>
            </div>
            <div class="recap__acts">
              ${isNew ? "" : `<button type="button" class="btn btn--primary btn--sm" id="print">${I("printer")}Imprimer le contrat</button>`}
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
    const valeurs = () => { const v = Object.fromEntries(new FormData(f)); return { ...c, ...v, montant: num(v.montant), caution: num(v.caution), avance: num(v.avance), paiements: pay.filter((p) => num(p.montant)).map((p) => ({ ...p, montant: num(p.montant) })), documents }; };
    const selonType = () => {
      const t = f.type.value, l = CHAMPS[t];
      $$(".ct-f", f).forEach((d) => { d.hidden = !d.dataset.types.split(" ").includes(t); });
      $("#lPartie").innerHTML = `${esc(l.partie)} <i class="req">*</i>`; $("#lObjet").textContent = l.objet; $("#lLieu").textContent = l.lieu; $("#lMontant").textContent = l.montant;
    };
    const mettreModele = async (demander) => {
      const t = f.type.value, met = f.metier ? f.metier.value : "";
      if (demander && !confirm("Mettre le modèle de contrat correspondant à la place du texte actuel ?")) return;
      const m = await modeleDe(t, met); f.titre.value = m.titre; f.texte.value = m.texte;
      const essais = Object.values(METIERS.travail).map((x) => x.essai);
      if (t === "travail" && METIERS.travail[met] && f.essai && (!f.essai.value || essais.includes(f.essai.value))) f.essai.value = METIERS.travail[met].essai;
      G.setDirty(true);
    };
    f.type.addEventListener("change", async () => {
      const t = f.type.value; selonType();
      if (METIERS[t]) { const sel = $("#metier"); sel.innerHTML = optsMetier(t, Object.keys(METIERS[t])[0]); sel.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: "silencieux" })); }
      await mettreModele(true); calc(); drawPay();
    });
    if ($("#metier")) $("#metier").addEventListener("change", (e) => { if (e.detail !== "silencieux") mettreModele(true); });
    selonType();
    // Paiements
    const COLS = "130px 1fr 130px 130px 1.1fr 72px";
    const drawPay = () => {
      const loc = f.type.value === "location";
      $("#pay").innerHTML = pay.length ? `<div class="r r--head" style="--cols:${COLS}"><span>Date</span><span>Montant</span><span>Mode</span><span>${loc ? "Mois (début)" : "Nature"}</span><span>Libellé</span><span></span></div>` + pay.map((p, i) => `<div class="r" style="--cols:${COLS}" data-i="${i}">
          <input type="date" data-k="date" value="${esc(p.date || "")}" aria-label="Date"><div class="ig"><input data-k="montant" class="money" inputmode="numeric" value="${p.montant ? U.sep(p.montant) : ""}" aria-label="Montant"><span class="ig__suffix">FCFA</span></div>
          <select data-k="mode" aria-label="Mode">${opts(MODES, p.mode)}</select>
          ${loc ? `<input type="month" data-k="mois" value="${esc(p.nature === "caution" ? "" : p.mois || "")}" aria-label="Mois"${p.nature === "caution" ? " disabled title=\"Caution\"" : ""}>` : `<select data-k="nature" aria-label="Nature">${opts({ "": "—", salaire: "Salaire", avance: "Avance", autre: "Autre" }, p.nature || "")}</select>`}
          <input data-k="libelle" value="${esc(p.libelle || "")}" placeholder="Ex. loyer de mars, avance 1" aria-label="Libellé">
          <span class="ct-pay__acts">${isNew || !c.id ? "" : `<button type="button" class="btn btn--tertiary btn--sm btn--icon" data-recu="${i}" title="Reçu" aria-label="Reçu">${I("printer")}</button>`}<button type="button" class="btn btn--tertiary btn--sm btn--icon" data-rm aria-label="Retirer">${I("x")}</button></span></div>`).join("") : '<p class="muted">Aucun paiement enregistré.</p>';
    };
    const maj = (e) => { const r = e.target.closest(".r"); if (!r || !e.target.dataset.k) return; const k = e.target.dataset.k; pay[r.dataset.i][k] = k === "montant" ? num(e.target.value) : e.target.value; G.setDirty(true); calc(); };
    $("#pay").addEventListener("input", maj); $("#pay").addEventListener("change", maj);
    $("#pay").addEventListener("click", (e) => {
      if (e.target.closest("[data-rm]")) { pay.splice(+e.target.closest(".r").dataset.i, 1); drawPay(); G.setDirty(true); calc(); }
      const rb = e.target.closest("[data-recu]"); if (rb) { if (G.isDirty && G.isDirty()) toast("Pensez à enregistrer : le reçu montre le paiement tel qu'il est saisi."); docRecu(valeurs(), ctx, +rb.dataset.recu); }
    });
    $("#addPay").onclick = () => {
      const t = f.type.value, n = pay.length + 1, mm = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      if (t === "location") { const L = loyers(valeurs()), o = L.mois.find((x) => x.reste > 0); pay.push({ date: today(), montant: o ? o.reste : num(f.montant.value), mode: "especes", nature: "loyer", mois: o ? o.m : moisCourant(), libelle: `Loyer ${moisFr(o ? o.m : moisCourant())}` }); }
      else pay.push({ date: today(), montant: t === "travail" ? num(f.montant.value) : "", mode: "especes", nature: t === "travail" ? "salaire" : "avance", libelle: t === "travail" ? `Salaire ${mm}` : `Avance ${n}` });
      drawPay(); G.setDirty(true); calc();
    };
    drawPay();
    if ($("#docs") && G.docsEditor) G.docsEditor($("#docs"), documents);
    // Tableau des loyers
    const drawLoyers = (v) => {
      const box = $("#loyers"); if (!box || f.type.value !== "location") return;
      const L = loyers(v);
      if (!v.montant || !v.dateDebut) { box.innerHTML = '<p class="muted">Indiquez le loyer mensuel et la date de début pour voir les mois.</p>'; return; }
      box.innerHTML = `<div class="loy-sum"><span>Dû à ce jour <b>${fcfa(L.du)}</b></span><span>Payé <b class="t-ok">${fcfa(L.paye)}</b></span><span>Impayé <b class="${L.retard ? "t-bad" : ""}">${fcfa(L.retard)}</b></span>${L.surplus ? `<span>Trop-perçu <b>${fcfa(L.surplus)}</b></span>` : ""}</div>
        <div class="tbl-wrap"><table class="tbl loy-tbl" data-nopage><thead><tr><th>Mois</th><th class="num">Dû</th><th class="num">Payé</th><th class="num">Reste</th><th>Statut</th><th></th></tr></thead><tbody>
        ${L.mois.slice().reverse().map((o) => `<tr class="loy--${o.statut}"><td><b>${esc(moisFr(o.m))}</b></td><td class="num">${fcfa(o.du)}</td><td class="num">${fcfa(o.paye)}</td><td class="num">${o.reste ? `<b class="${o.statut === "impaye" || o.statut === "partiel" ? "t-bad" : ""}">${fcfa(o.reste)}</b>` : "—"}</td><td>${badgeLoyer(o.statut)}</td>
          <td class="loy__acts">${o.paye && !o.reste ? `<button type="button" class="btn btn--tertiary btn--sm" data-quit="${o.m}">${I("printer")}Quittance</button>` : ""}${o.reste ? `<button type="button" class="btn btn--tertiary btn--sm" data-app="${o.m}">${I("file")}Appel</button>` : ""}</td></tr>`).join("")}
        </tbody></table></div>`;
    };
    $("#loyers") && $("#loyers").addEventListener("click", (e) => {
      const q = e.target.closest("[data-quit]"), a = e.target.closest("[data-app]");
      if (q) docQuittance(valeurs(), ctx, q.dataset.quit); if (a) docAppel(valeurs(), ctx, a.dataset.app);
    });
    function calc() {
      const v = valeurs(), tv = verse(v), L = loyers(v), rf = resteForfait(v), j = joursAvant(v.dateFin), loc = v.type === "location";
      $("#kSt").innerHTML = badge(v.statut);
      $("#kMont").innerHTML = v.montant ? U.money(v.montant) : '<span class="t-help" style="font:400 15px var(--font-ui)">Montant à indiquer</span>';
      $("#kPer").textContent = v.montant ? PERIODES[v.periodicite] : "";
      $("#kDates").textContent = `${v.dateDebut ? U.dateFr(v.dateDebut) : "?"} → ${v.dateFin ? U.dateFr(v.dateFin) : "indéterminée"}`;
      $("#kVerseT").textContent = loc ? "Loyers payés" : "Total versé"; $("#kVerse").innerHTML = U.money(loc ? L.paye + sum(L.mois.filter((o) => o.m > moisCourant()), (o) => o.paye) : tv);
      const reste = loc ? L.retard : rf;
      $("#kResteT").textContent = loc ? `Loyers impayés${L.nbImpayes ? ` (${L.nbImpayes} mois)` : ""}` : "Reste à payer";
      $("#kReste").innerHTML = loc || v.periodicite === "unique" ? U.money(reste) : "—";
      $("#kResteL").className = reste ? "is-bad" : "";
      $("#kFin").textContent = j === null ? "—" : j < 0 ? `dépassée de ${-j} j` : `dans ${j} jour(s)`;
      $("#kFinL").className = v.statut === "actif" && j !== null && j <= 30 ? "is-bad" : "";
      drawLoyers(v);
    }
    f.addEventListener("input", calc); f.addEventListener("change", calc); calc();
    if ($("#enc")) $("#enc").onclick = () => { if (G.isDirty && G.isDirty()) return toast("Enregistrez d'abord vos modifications, puis encaissez.", true); encaisser(c, ctx, (r) => views["g-contrat"](r.id)); };
    $("#reset").onclick = () => mettreModele(true);
    $("#apercu").onclick = () => docContrat(valeurs(), ctx);
    if ($("#print")) $("#print").onclick = () => docContrat(valeurs(), ctx);
    const ok = () => U.valider(f, [["partie", (x) => (x.trim() ? "" : "Indiquez le nom de l'autre partie.")]]);
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); if (!ok()) return;
      const v = valeurs(); if (!METIERS[v.type]) v.metier = ""; ["id", "creePar", "creeLe", "modifiePar", "modifieLe"].forEach((k) => delete v[k]);
      try { const r = await api(isNew ? "/api/g/contrats" : `/api/g/contrats/${c.id}`, { method: isNew ? "POST" : "PUT", body: v }); G.setDirty(false); toast("Contrat enregistré"); if (isNew) location.hash = `#g-contrat/${r.id}`; else views["g-contrat"](r.id); }
      catch (err) { fail(err); }
    });
    if ($("#del")) $("#del").onclick = async () => { if (!confirm("Supprimer définitivement ce contrat ?")) return; try { await api(`/api/g/contrats/${c.id}`, { method: "DELETE" }); G.setDirty(false); toast("Contrat supprimé"); location.hash = "#g-contrats"; } catch (err) { fail(err); } };
  };

  /* ---------- Modèles de contrat (par type et par métier) ---------- */
  views["g-modeles"] = async (sel) => {
    if (!argent()) { location.replace("#g-chantiers"); return; }
    modelesCache = null; const enr = await modeles();
    const [st, sm] = String(sel || "").split("|");
    const choixMetier = { travail: METIERS.travail[sm] && st === "travail" ? sm : "commercial", ouvrier: METIERS.ouvrier[sm] && st === "ouvrier" ? sm : "macon" };
    const blocs = await Promise.all(Object.keys(TYPES).map(async (k) => ({ k, met: choixMetier[k] || "", m: await modeleDe(k, choixMetier[k] || "") })));
    main.innerHTML = U.head("Modèles de contrat", "Le texte de départ de chaque nouveau contrat, par type et par métier. Les contrats déjà créés ne changent pas.",
      `<a class="btn btn--tertiary" href="#g-contrats">${I("chevleft")}Retour aux contrats</a>`, [["Contrats", "#g-contrats"], ["Modèles", ""]]) +
      blocs.map(({ k, met, m }) => `<section class="panel" data-type="${k}" data-metier="${met}">
        <div class="sec__head"><span class="sec__n">${I(TYPES[k].ic)}</span><div><h2>${esc(TYPES[k].nom)}</h2><p>${m.perso ? "Modèle personnalisé par GEI." : "Modèle par défaut."}</p></div></div>
        ${METIERS[k] ? `<label class="field"><span>Métier</span><select data-metier-sel>${opts(Object.fromEntries(Object.entries(METIERS[k]).map(([a, b]) => [a, b.nom + ((enr.find((x) => x.type === k && x.metier === a)) ? " ✓ personnalisé" : "")])), met)}</select></label>` : ""}
        <label class="field" style="margin-top:14px"><span>Titre</span><input data-k="titre" value="${esc(m.titre)}"></label>
        <label class="field" style="margin-top:14px"><span>Articles</span><textarea data-k="texte" rows="14" class="ct-texte">${esc(m.texte)}</textarea></label>
        <div class="pay-actions"><button type="button" class="btn btn--primary btn--sm" data-save>${I("check")}Enregistrer ce modèle</button>${m.perso ? `<button type="button" class="btn btn--tertiary btn--sm" data-defaut="${m.id}">Revenir au modèle d'origine</button>` : ""}</div></section>`).join("") +
      `<section class="panel"><details class="howto" open><summary>${I("chevright")}Mots remplacés automatiquement dans les contrats</summary><p class="ct-vars">${VARIABLES.map(([k, l]) => `<code>{{${k}}}</code> ${esc(l)}`).join(" · ")}</p></details></section>`;
    $$("[data-metier-sel]").forEach((s) => s.addEventListener("change", () => { const k = s.closest("[data-type]").dataset.type; location.hash = `#g-modeles/${encodeURIComponent(k + "|" + s.value)}`; }));
    if (main._clicModeles) main.removeEventListener("click", main._clicModeles);
    main.addEventListener("click", main._clicModeles = async function clic(ev) {
      if (!location.hash.startsWith("#g-modeles")) { main.removeEventListener("click", clic); main._clicModeles = null; return; }
      const s = ev.target.closest("[data-save], [data-defaut]"); if (!s) return;
      const secEl = s.closest("[data-type]"), type = secEl.dataset.type, metier = secEl.dataset.metier || "";
      const existant = enr.find((x) => x.type === type && (x.metier || "") === metier);
      try {
        if (s.matches("[data-defaut]")) { if (!confirm("Revenir au modèle d'origine ?")) return; await api(`/api/g/modeles/${s.dataset.defaut}`, { method: "DELETE" }); toast("Modèle d'origine rétabli"); }
        else {
          const body = { type, metier, titre: $("[data-k=titre]", secEl).value, texte: $("[data-k=texte]", secEl).value };
          await api(existant ? `/api/g/modeles/${existant.id}` : "/api/g/modeles", { method: existant ? "PUT" : "POST", body }); toast("Modèle enregistré");
        }
        G.setDirty(false); views["g-modeles"](sel);
      } catch (err) { fail(err); }
    });
  };

  /* ---------- Alertes (cloche) et trésorerie ---------- */
  const alertesBase = G.alertes;
  G.alertes = async () => {
    const base = alertesBase ? await alertesBase() : [];
    if (!argent()) return base;
    const liste = await api("/api/g/contrats").catch(() => []);
    const plus = [];
    liste.filter((c) => c.statut === "actif").forEach((c) => {
      const j = joursAvant(c.dateFin), L = loyers(c);
      if (L.retard) plus.push({ niveau: "warn", icone: "house", titre: `Loyer impayé : ${c.partie}`, texte: `${fcfa(L.retard)} · ${L.nbImpayes} mois${c.objet ? " · " + c.objet : ""}`, href: `#g-contrat/${c.id}` });
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
      origine: c.type === "location" ? (estCaution(p) ? "Caution" : "Loyer") : c.type === "travail" ? "Salaire (contrat)" : c.type === "ouvrier" ? "Ouvrier (contrat)" : "Contrat",
      libelle: `${p.libelle || TYPES[c.type].court} · ${c.partie}`, montant: p.montant, href: `#g-contrat/${c.id}`,
    })));
    return ops.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  };
  G.loyers = loyers; // utilisé par les tests
})();
