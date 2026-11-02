# Captures d'écran et trame de l'oral

## A. Captures d'écran (dossier `captures/`)
Les 13 captures ci-dessous ont été prises automatiquement (capture de fenêtre par script et pilotage de Docker Desktop par l'API d'accessibilité de Windows) et sont déjà insérées dans les comptes rendus `.docx`.

| # | Fichier | Contenu | Section | État |
|---|---|---|---|---|
| 2 | `02-docker-demarrage.png` | Écran « Starting the Docker Engine… » | Journal, étape 4 | Fait |
| 4 | `04-images.png` | Onglet Images : `nginx:alpine` et `alpine` | TP1 §3 | Fait |
| 5 | `05-recherche-pull.png` | Recherche « nginx » : tag, Pull, Run | TP1 §3 | Fait |
| 6 | `06-run-options.png` | Fenêtre Run : nom, port 8081, volume | TP1 §6 | Fait |
| 7 | `07-containers.png` | Onglet Containers : `nginx-web`, port 8080:80 | TP1 §7 | Fait |
| 8 | `08-navigateur-nginx.png` | Navigateur sur http://localhost:8080 | TP1 §6 | Fait |
| 9 | `09-exec-terminal.png` | Onglet Exec : `nginx -v`, `ls`, `grep` | TP1 §5 | Fait |
| 10 | `10-files.png` | Onglet Files : `html` et `index.html` marqués VOLUME | TP1 §13 | Fait |
| 11 | `11-volumes.png` | Onglet Volumes : `site-web` | TP1 §12 | Fait |
| 12 | `12-wsl-debian.png` | `wsl -l -v` et Debian 13 | Journal, étape 5 | Fait |
| 13 | `13-reseaux-ping.png` | Réseau `mon_reseau` et ping alpine1 ↔ alpine2 | TP2 ex. 1 | Fait |
| 14 | `14-curl-client.png` | Réseau `mon_reseau_web`, curl depuis le client | TP2 ex. 2 | Fait |

## B. Trame de l'oral (10 min max, binôme, temps de parole égal)
Critères notés : respect du temps, partage équitable, concision, vocabulaire correct, **démonstration sur machine**, document d'appui remis à l'enseignant.

| Temps | Qui | Contenu | Démo en direct |
|---|---|---|---|
| 0:00-1:00 | Azur | Contexte : pourquoi Docker dans la SAÉ (environnement identique pour toute l'équipe, déploiement) | — |
| 1:00-2:30 | Azur | Docker vs VM (tableau sécurité / portabilité / performances), architecture client-serveur, WSL 2 | `docker version` (client Windows / serveur Linux) |
| 2:30-4:00 | Ewen | Installation sur Windows Famille : WSL 2 au lieu d'Hyper-V, étapes, difficultés rencontrées (place disque, VHD espacés) | `wsl -l -v` |
| 4:00-6:00 | Ewen | Images et conteneurs : pull, run, ports, cycle de vie | `docker run -d -p 8080:80 nginx:alpine` → navigateur ; `stop` / `start` ; vue dans Docker Desktop |
| 6:00-7:30 | Azur | Volumes et persistance (avec le contre-exemple sans volume) | `docker cp index.html`, `rm -f`, nouveau conteneur → page toujours là |
| 7:30-9:00 | Ewen | Réseaux : bridge, DNS interne, isolation | ping alpine1 → alpine2 ; `curl http://serveur_web` depuis le client |
| 9:00-10:00 | Azur + Ewen | Suite : docker compose de la SAÉ (nginx + PHP/Symfony + MySQL + phpMyAdmin), dépôt des images sur un hub | — |

Conseils démo (PC lent) :
- lancer Docker Desktop **5 minutes avant** et faire `docker pull nginx:alpine` et `docker pull alpine` à l'avance (pas de téléchargement pendant l'oral) ;
- préparer les commandes dans un fichier texte pour les copier-coller ;
- fermer navigateur, VS Code et autres logiciels gourmands ;
- plan B : les sorties réelles sont dans `_sorties_tp1.txt` et `_sorties_tp2.txt`, ou utiliser un poste de la salle JJ306.

Document d'appui : un diaporama (pptx) reprenant ce plan, une diapo par ligne du tableau, avec les captures de la partie A.
