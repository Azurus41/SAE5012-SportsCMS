#!/usr/bin/env bash
# Vérifie l'API Touchline de bout en bout : connexion de chaque compte de test, droits par rôle,
# création / modification d'un article, note, commentaire, inscription, déconnexion.
# Usage : scripts/smoke-test-api.sh https://deepdraft.fr/touchline   (ou http://127.0.0.1:8099)
# Les mots de passe sont lus dans docs/comptes-de-test.md. Le test crée un brouillon puis le supprime,
# et crée un compte abonné jetable (smoke-…@touchline.test).
set -uo pipefail

BASE="${1:?URL de base, ex. https://deepdraft.fr/touchline}"
API="${BASE%/}/api"
DOCS="$(dirname "$0")/../docs/comptes-de-test.md"
JAR="$(mktemp -d)"
trap 'rm -rf "$JAR"' EXIT
pass=0
fail=0

password() { grep -F "\`$1\`" "$DOCS" | sed -E 's/.*\| `[^`]+` \| `([^`]+)`.*/\1/'; }

# req <compte> <méthode> <chemin> [corps JSON] -> affiche "CODE CORPS"
req() {
  local who="$1" method="$2" path="$3" body="${4:-}"
  local args=(-s -o "$JAR/body" -w '%{http_code}' -X "$method" -b "$JAR/$who" -c "$JAR/$who" -H 'Accept: application/json')
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' --data "$body")
  local code
  code=$(curl "${args[@]}" "$API$path")
  echo "$code $(cat "$JAR/body")"
}

check() {
  local label="$1" expected="$2" got="$3"
  if [ "${got%% *}" = "$expected" ]; then
    pass=$((pass + 1))
    printf '  ok   %-58s %s\n' "$label" "$expected"
  else
    fail=$((fail + 1))
    printf '  ÉCHEC %-57s attendu %s, obtenu %s\n' "$label" "$expected" "$(echo "$got" | cut -c1-160)"
  fi
}

login() { req "$1" POST /login "{\"email\":\"$2\",\"password\":\"$(password "$2")\"}"; }

echo "API : $API"
check "visiteur : /me renvoie null" 200 "$(req anon GET /me)"
check "visiteur : liste des articles" 200 "$(req anon GET /articles)"
check "visiteur : brouillon d'un autre invisible" 404 "$(req anon GET /articles/a-brouillon)"
check "visiteur : création d'article refusée" 401 "$(req anon POST /articles '{"title":"x"}')"
check "mauvais mot de passe" 401 "$(req anon POST /login '{"email":"admin@touchline.test","password":"faux-mot-de-passe"}')"

for email in admin@touchline.test editeur@touchline.test auteur@touchline.test auteur2@touchline.test \
  auteur3@touchline.test designer@touchline.test fournisseur@touchline.test abonne@touchline.test; do
  check "connexion $email" 200 "$(login "${email%%@*}" "$email")"
done
check "session : /me renvoie l'abonné" 200 "$(req abonne GET /me | grep -F '"role":"subscriber"' || echo 'KO')"

check "auteur : voit son brouillon" 200 "$(req auteur GET /articles/a-brouillon)"
check "auteur2 : brouillon d'un autre auteur invisible" 404 "$(req auteur2 GET /articles/a-brouillon)"
check "abonné : création d'article refusée" 403 "$(req abonne POST /articles '{"title":"x","sport":"football","topic":"tactique"}')"
check "designer : création d'article refusée" 403 "$(req designer POST /articles '{"title":"x","sport":"football","topic":"tactique"}')"

created="$(req auteur POST /articles '{"title":"Test automatique","summary":"Créé par smoke-test-api.sh","sport":"football","topic":"tactique","type":"classic","status":"draft","blocks":[{"id":"b-t1","type":"heading","level":2,"text":"Titre"},{"id":"b-t2","type":"text","text":"Paragraphe"}]}')"
check "auteur : crée un brouillon" 201 "$created"
id="$(echo "$created" | sed -E 's/.*"id":"(a-[^"]+)".*/\1/')"
check "auteur2 : ne peut pas modifier l'article d'un autre" 403 "$(req auteur2 PUT "/articles/$id" '{"title":"Piraté","sport":"football","topic":"tactique"}')"
check "éditeur : modifie l'article de l'auteur" 200 "$(req editeur PUT "/articles/$id" '{"title":"Test automatique (édité)","sport":"football","topic":"tactique","type":"classic","status":"draft","blocks":[{"id":"b-t1","type":"heading","level":2,"text":"Titre"}]}')"
check "narration publiée sans graphique refusée" 422 "$(req auteur PUT "/articles/$id" '{"title":"T","sport":"football","topic":"tactique","type":"dashboard","status":"published","blocks":[]}')"
check "auteur : supprime son article" 200 "$(req auteur DELETE "/articles/$id")"
check "visiteur : article supprimé invisible" 404 "$(req anon GET "/articles/$id")"
check "admin : voit l'article supprimé" 200 "$(req admin GET "/articles/$id")"

check "abonné : note un bloc" 200 "$(req abonne PUT /articles/a-pressing/blocks/b-6/rating '{"value":4}')"
check "abonné : note hors limites refusée" 422 "$(req abonne PUT /articles/a-pressing/blocks/b-6/rating '{"value":9}')"
comment="$(req abonne POST /articles/a-pressing/comments '{"text":"Commentaire de test automatique"}')"
check "abonné : commente" 201 "$comment"
cid="$(echo "$comment" | sed -E 's/.*"id":"(c-[^"]+)".*/\1/')"
check "auteur2 : ne peut pas supprimer le commentaire d'un autre" 403 "$(req auteur2 DELETE "/comments/$cid")"
check "abonné : supprime son commentaire" 200 "$(req abonne DELETE "/comments/$cid")"

check "fournisseur : liste des jeux de données" 200 "$(req fournisseur GET /datasets)"
check "auteur : création de jeu de données refusée" 403 "$(req auteur POST /datasets '{"url":"/x.csv","variables":[{"name":"a","kind":"numeric"}]}')"
check "designer : enregistre le thème du site" 200 "$(req designer PUT /themes '{"scope":"site","values":{}}')"
check "abonné : thème refusé" 403 "$(req abonne PUT /themes '{"scope":"site","values":{}}')"
check "/users ne contient pas d'e-mail" 200 "$(req anon GET /users | grep -v -F '@' || echo 'KO')"
check "abonné : bannissement refusé" 403 "$(req abonne PATCH /users/u-sam '{"banned":true}')"

stamp="$(date +%s)"
check "inscription d'un abonné" 201 "$(req nouveau POST /register "{\"name\":\"Compte de test\",\"email\":\"smoke-$stamp@touchline.test\",\"password\":\"mot-de-passe-de-test-$stamp\"}")"
check "inscription : e-mail déjà utilisé" 409 "$(req nouveau POST /register '{"name":"Doublon","email":"admin@touchline.test","password":"mot-de-passe-long"}')"
check "inscription : mot de passe trop court" 422 "$(req nouveau POST /register "{\"name\":\"Court\",\"email\":\"court-$stamp@touchline.test\",\"password\":\"court\"}")"
check "connexion du nouveau compte" 200 "$(req nouveau POST /login "{\"email\":\"SMOKE-$stamp@touchline.test\",\"password\":\"mot-de-passe-de-test-$stamp\"}")"

check "déconnexion" 204 "$(req abonne POST /logout)"
check "après déconnexion : /me renvoie null" 200 "$(req abonne GET /me | grep -F '200 null' || echo 'KO')"

echo
echo "$pass réussis, $fail échoués"
[ "$fail" -eq 0 ]
