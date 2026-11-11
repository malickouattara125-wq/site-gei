#!/usr/bin/env bash
# Outil de mise en ligne chez LWS (cPanel), appelé par .github/workflows/deployer-lws.yml
# Les identifiants viennent des secrets GitHub ; ils ne sont jamais affichés.
#   lws.sh diagnostic   : vérifie l'accès et décrit l'hébergement
#   lws.sh application  : déclare l'application Node.js si elle n'existe pas
#   lws.sh verifier     : contrôle le site en ligne
set -uo pipefail
: "${LWS_HOST:?}" "${LWS_USER:?}" "${LWS_PASSWORD:?}" "${LWS_DOMAIN:?}"
APP_NAME="gei"
API="https://${LWS_HOST}:2083/execute"
OUT="${GITHUB_OUTPUT:-/dev/null}"

api() {  # api Module fonction [param=valeur ...]  -> JSON sur la sortie
  local mod=$1 fn=$2; shift 2
  local args=(); for p in "$@"; do args+=(--data-urlencode "$p"); done
  curl -sS --max-time 60 -u "${LWS_USER}:${LWS_PASSWORD}" "$API/$mod/$fn" "${args[@]}"
}
ok()   { jq -e '.status == 1' >/dev/null 2>&1 <<<"$1"; }
errs() { jq -r '(.errors // []) | join(" / ")' 2>/dev/null <<<"$1"; }
titre(){ echo; echo "=== $* ==="; }

diagnostic() {
  titre "Connexion au cPanel"
  local r; r=$(api Variables get_user_information)
  if ! ok "$r"; then
    echo "::error::Connexion au cPanel refusée. Vérifiez LWS_HOST, LWS_USER et LWS_PASSWORD. Réponse : $(head -c 300 <<<"$r")"
    exit 1
  fi
  HOME_DIR=$(jq -r '.data.home // empty' <<<"$r")
  [ -n "$HOME_DIR" ] || HOME_DIR="/home/${LWS_USER}"
  echo "OK. Dossier personnel : $HOME_DIR"
  echo "home=$HOME_DIR" >> "$OUT"

  titre "Domaines du compte"
  r=$(api DomainInfo list_domains)
  jq -r '.data | "principal : \(.main_domain)\nsupplémentaires : \((.addon_domains // []) | join(", "))\nsous-domaines : \((.sub_domains // []) | join(", "))"' <<<"$r" 2>/dev/null || echo "$(errs "$r")"
  r=$(api DomainInfo single_domain_data "domain=${LWS_DOMAIN}")
  if ok "$r"; then
    DOCROOT=$(jq -r '.data.documentroot' <<<"$r"); echo "Dossier public de ${LWS_DOMAIN} : $DOCROOT"
    echo "docroot=$DOCROOT" >> "$OUT"
    titre "Contenu du dossier public"
    local rel="${DOCROOT#"$HOME_DIR"/}"
    api Fileman list_files "dir=$rel" | jq -r '.data[]? | "\(.type)\t\(.file)"' || true
  else
    echo "::warning::Le domaine ${LWS_DOMAIN} n'est pas trouvé sur ce cPanel : $(errs "$r")"
  fi

  titre "Gestionnaire d'applications Node.js"
  r=$(api Features has_feature "name=passengerapps"); echo "Fonction passengerapps : $(jq -r '.status' <<<"$r" 2>/dev/null) $(errs "$r")"
  r=$(api PassengerApps list_applications)
  if ok "$r"; then jq -r '.data | to_entries[]? | "- \(.key) : \(.value.path) -> \(.value.domain)\(.value.base_uri) (\(.value.enabled))"' <<<"$r"; echo "(fin de liste)"
  else echo "Indisponible : $(errs "$r")"; fi

  titre "HTTPS"
  if curl -sS -o /dev/null --max-time 20 "https://${LWS_DOMAIN}/"; then echo "Certificat SSL valide sur ${LWS_DOMAIN}"; echo "https=1" >> "$OUT"
  else echo "::warning::Pas de certificat SSL valide sur ${LWS_DOMAIN} pour l'instant."; echo "https=0" >> "$OUT"
       api SSL start_autossl_check >/dev/null 2>&1 && echo "Demande de certificat automatique (AutoSSL) envoyée."; fi

  titre "Espace disque"
  api Quota get_quota_info | jq -r '.data | "utilisé : \(.megabytes_used) Mo / limite : \(.megabyte_limit) Mo"' 2>/dev/null || true
}

application() {
  local home=${HOME_DIR:-/home/${LWS_USER}} path
  path="$home/site-gei/serveur"
  titre "Application Node.js"
  local r; r=$(api PassengerApps list_applications)
  if ok "$r" && jq -e --arg n "$APP_NAME" '.data[$n]' >/dev/null <<<"$r"; then
    echo "L'application « $APP_NAME » existe déjà : elle redémarre grâce à tmp/restart.txt."
    return 0
  fi
  local env; env=$(jq -cn --arg p "${ADMIN_PASSWORD:-}" --arg h "${FORCE_HTTPS:-0}" \
    '{NODE_ENV:"production"} + (if $p != "" then {ADMIN_PASSWORD:$p} else {} end) + (if $h == "1" then {FORCE_HTTPS:"1"} else {} end)')
  r=$(api PassengerApps register_application "name=$APP_NAME" "path=$path" "domain=${LWS_DOMAIN}" \
      "base_uri=/" "deployment_mode=production" "enabled=1" "envvars=$env")
  if ok "$r"; then echo "Application déclarée : $path -> https://${LWS_DOMAIN}/"
  else echo "::error::Impossible de déclarer l'application : $(errs "$r")"; exit 1; fi
}

verifier() {
  titre "Vérification du site en ligne"
  local base="https://${LWS_DOMAIN}" fail=0
  curl -sS -o /dev/null --max-time 20 "$base/" 2>/dev/null || base="http://${LWS_DOMAIN}"
  sleep 5
  check() {  # check chemin code_attendu description
    local code; code=$(curl -s -o /tmp/page -w '%{http_code}' --max-time 30 "$base$1")
    if [ "$code" = "$2" ]; then echo "OK   $code  $1  ($3)"; else echo "::error::$1 renvoie $code au lieu de $2 ($3)"; fail=1; fi
  }
  check "/" 200 "accueil"
  grep -q "Global Empire" /tmp/page || { echo "::error::L'accueil ne contient pas « Global Empire » (page par défaut de LWS ?)"; fail=1; }
  curl -sI --max-time 20 "$base/" | grep -qi "x-frame-options" && echo "OK   page servie par le serveur Node.js GEI" || { echo "::error::L'accueil n'est pas servi par le serveur Node.js (fichiers statiques ?)"; fail=1; }
  check "/programmes.html" 200 "programmes"
  check "/programme-adiake.html" 200 "fiche programme"
  check "/admin/" 200 "tableau de bord"
  check "/serveur/data/admin.json" 404 "mot de passe protégé"
  check "/serveur/server.js" 404 "code protégé"
  check "/api/demandes" 401 "demandes protégées"
  echo; echo "Adresse : $base   ·   Tableau de bord : $base/admin"
  exit $fail
}

case "${1:-}" in
  diagnostic) diagnostic ;;
  application) HOME_DIR=${HOME_DIR:-}; application ;;
  verifier) verifier ;;
  *) echo "usage: $0 diagnostic|application|verifier"; exit 2 ;;
esac
