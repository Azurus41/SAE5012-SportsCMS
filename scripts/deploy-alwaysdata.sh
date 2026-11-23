#!/usr/bin/env bash
# Met en ligne Touchline sur https://deepdraft.fr/touchline/ depuis votre poste (Git Bash) :
# se connecte en SSH à alwaysdata et lance scripts/deploy-server.sh sur le serveur
# (mise à jour du dépôt, back Symfony, migrations, build du front, publication).
# Prérequis : la clé SSH de déploiement (~/.ssh/alwaysdata_touchline) est autorisée dans
# l'administration alwaysdata (Accès distant > SSH/SFTP > Clés SSH), et l'installation initiale est faite (README).
# Usage : ./scripts/deploy-alwaysdata.sh [branche]   (main par défaut)
set -euo pipefail

BRANCH="${1:-${BRANCH:-main}}"
ACCOUNT="${ALWAYSDATA_ACCOUNT:-azurus}"
KEY="${SSH_KEY:-$HOME/.ssh/alwaysdata_touchline}"
HOST="$ACCOUNT@ssh-$ACCOUNT.alwaysdata.net"

ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "$HOST" \
  "cd ~/touchline && git fetch -q origin '$BRANCH' && git checkout -q -B '$BRANCH' 'origin/$BRANCH' && BRANCH='$BRANCH' SKIP_PULL=1 bash scripts/deploy-server.sh"
