#!/usr/bin/env bash
# Met en ligne Touchline sur l'hébergement alwaysdata, à lancer SUR LE SERVEUR (SSH web ou ssh) :
#   bash ~/touchline/scripts/deploy-server.sh
#
# 1. met à jour le dépôt ~/touchline sur la branche $BRANCH ;
# 2. back Symfony (~/touchline/backend, hors du dossier web) : dépendances, migrations, comptes de test ;
# 3. front React construit pour /touchline/ et copié dans ~/www/deepdraft/touchline/ ;
# 4. api.php relaie /touchline/api/… vers Symfony ; uploads/ garde les fichiers déposés entre deux mises en ligne ;
# 5. l'ancienne adresse /touchdown/ redirige vers /touchline/.
#
# Première installation : voir README.md (« Mise en ligne sur alwaysdata »).
set -euo pipefail

BRANCH="${BRANCH:-main}"
REPO_DIR="${REPO_DIR:-$HOME/touchline}"
WEB_DIR="${WEB_DIR:-$HOME/www/deepdraft/touchline}"
OLD_WEB_DIR="${OLD_WEB_DIR:-$HOME/www/deepdraft/touchdown}"
BASE="${VITE_BASE:-/touchline/}"
SKIP_PULL="${SKIP_PULL:-0}"

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

if [ "$SKIP_PULL" != 1 ]; then
  step "Dépôt : branche $BRANCH"
  git -C "$REPO_DIR" fetch --quiet origin "$BRANCH"
  git -C "$REPO_DIR" checkout --quiet -B "$BRANCH" "origin/$BRANCH"
  git -C "$REPO_DIR" log -1 --format='%h %s'
fi

step "Back Symfony"
cd "$REPO_DIR/backend"
if [ ! -f .env.local ]; then
  secret="$(php -r 'echo bin2hex(random_bytes(16));')"
  cat > .env.local <<ENV
APP_ENV=prod
APP_DEBUG=0
APP_SECRET=$secret
# Base MySQL/MariaDB créée dans l'administration alwaysdata (Bases de données > MySQL).
DATABASE_URL="mysql://azurus_touchline:MOT_DE_PASSE@mysql-azurus.alwaysdata.net:3306/azurus_touchline?serverVersion=mariadb-11.4.0&charset=utf8mb4"
UPLOAD_DIR=$WEB_DIR/uploads
UPLOAD_URL=${BASE}uploads
ENV
  chmod 600 .env.local
  echo "backend/.env.local créé : remplacez MOT_DE_PASSE dans DATABASE_URL, puis relancez ce script."
  exit 1
fi
if grep -q ':MOT_DE_PASSE@' .env.local; then
  echo "Renseignez DATABASE_URL dans $REPO_DIR/backend/.env.local, puis relancez ce script."
  exit 1
fi
export APP_ENV=prod
composer install --no-dev --optimize-autoloader --no-interaction --no-progress
php bin/console cache:clear --no-warmup
php bin/console cache:warmup
php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
php bin/console doctrine:schema:validate --skip-sync || true
php bin/console app:seed

step "Front React ($BASE)"
cd "$REPO_DIR/frontend"
npm ci --no-audit --no-fund
npm test
VITE_BASE="$BASE" VITE_API_URL="${BASE%/}" npm run build

step "Publication dans $WEB_DIR"
mkdir -p "$WEB_DIR/uploads"
# On ne remplace que les fichiers de Touchline : uploads/ (fichiers déposés) est conservé.
rm -rf "$WEB_DIR/assets" "$WEB_DIR/datasets" "$WEB_DIR/index.html" "$WEB_DIR/.htaccess" "$WEB_DIR/favicon.svg" "$WEB_DIR/api.php"
cp -R dist/. "$WEB_DIR/"
cat > "$WEB_DIR/api.php" <<PHP
<?php
// Relais vers le contrôleur frontal Symfony, installé hors du dossier web (généré par scripts/deploy-server.sh).
return require '$REPO_DIR/backend/public/index.php';
PHP
# Fichiers déposés : jamais exécutés, servis tels quels.
cat > "$WEB_DIR/uploads/.htaccess" <<'HT'
<FilesMatch "\.(php|phtml|phar|pl|py|cgi|sh|html?|svg)$">
  Require all denied
</FilesMatch>
<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
</IfModule>
HT
find "$WEB_DIR" -path "$WEB_DIR/uploads" -prune -o -type d -exec chmod 755 {} +
find "$WEB_DIR" -path "$WEB_DIR/uploads" -prune -o -type f -exec chmod 644 {} +

if [ -d "$OLD_WEB_DIR" ] && [ ! -f "$OLD_WEB_DIR/.touchline-redirect" ]; then
  step "Ancienne adresse ${OLD_WEB_DIR##*/www/deepdraft} -> $BASE"
  rm -rf "$OLD_WEB_DIR/assets" "$OLD_WEB_DIR/datasets" "$OLD_WEB_DIR/index.html" "$OLD_WEB_DIR/favicon.svg"
  cat > "$OLD_WEB_DIR/.htaccess" <<HT
# Touchline a été renommé : /touchdown/… redirige vers $BASE…
RewriteEngine On
RewriteRule ^(.*)\$ ${BASE}\$1 [R=301,L]
HT
  touch "$OLD_WEB_DIR/.touchline-redirect"
fi

step "Vérification"
for path in "" "api/me" "api/articles"; do
  curl -s -o /dev/null -w "https://deepdraft.fr${BASE}${path} -> HTTP %{http_code}\n" "https://deepdraft.fr${BASE}${path}"
done
