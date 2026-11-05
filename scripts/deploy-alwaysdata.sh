#!/usr/bin/env bash
# Construit le front et le publie sur https://deepdraft.fr/touchdown/ (hébergement alwaysdata).
# Prérequis : la clé SSH de déploiement (~/.ssh/alwaysdata_touchline) est autorisée dans
# l'administration alwaysdata (Accès distant > SSH/SFTP > Clés SSH).
# Usage (Git Bash) : ./scripts/deploy-alwaysdata.sh
set -euo pipefail

ACCOUNT="${ALWAYSDATA_ACCOUNT:-azurus}"
REMOTE_DIR="${REMOTE_DIR:-www/deepdraft/touchdown}"
BASE="${VITE_BASE:-/touchdown/}"
KEY="${SSH_KEY:-$HOME/.ssh/alwaysdata_touchline}"
HOST="$ACCOUNT@ssh-$ACCOUNT.alwaysdata.net"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes)

cd "$(dirname "$0")/../frontend"
npm test
# MSYS_NO_PATHCONV : empêche Git Bash de transformer « /touchdown/ » en chemin Windows.
MSYS_NO_PATHCONV=1 VITE_BASE="$BASE" npm run build

# On remplace uniquement les fichiers de Touchline, jamais le reste du site.
tar -C dist -cf - . | "${SSH[@]}" "$HOST" "
  set -e
  D=\$HOME/$REMOTE_DIR
  mkdir -p \"\$D\"
  rm -rf \"\$D/assets\" \"\$D/datasets\" \"\$D/index.html\" \"\$D/.htaccess\" \"\$D/favicon.svg\"
  tar -C \"\$D\" -xf -
  find \"\$D\" -type d -exec chmod 755 {} +
  find \"\$D\" -type f -exec chmod 644 {} +
"

curl -s -o /dev/null -w "https://deepdraft.fr${BASE} -> HTTP %{http_code}\n" "https://deepdraft.fr${BASE}"
