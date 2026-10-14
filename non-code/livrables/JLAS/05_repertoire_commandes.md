# Répertoire des commandes Docker (TP SAE5012 parties 1 et 2)

Toutes ces commandes ont été testées sous PowerShell avec Docker 29.8.2. `<c>` = nom ou identifiant d'un conteneur, `<i>` = image, `<v>` = volume, `<r>` = réseau.

## Installation / environnement (Windows)
| Commande | Rôle |
|---|---|
| `wsl --install` / `wsl --install -d Debian` | Activer WSL et installer une distribution (administrateur) |
| `dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart` | Activer WSL (méthode manuelle) |
| `dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart` | Activer la plateforme de machine virtuelle (WSL 2) |
| `wsl --list --online` | Distributions installables |
| `wsl -l -v` | Distributions installées et leur version de WSL |
| `wsl -d Debian` | Ouvrir un terminal Debian |
| `wsl --shutdown` | Arrêter toutes les distributions (appliquer `.wslconfig`) |
| `winget install --id Docker.DockerDesktop -e` | Installer Docker Desktop en ligne de commande |

## Informations
| Commande | Rôle |
|---|---|
| `docker --version` | Version du client |
| `docker version` | Versions client + serveur (moteur, containerd, runc) |
| `docker info` | Infos détaillées sur le moteur |
| `docker system df` | Espace disque utilisé par images, conteneurs, volumes, cache |
| `docker <commande> --help` | Aide d'une commande |

## Images
| Commande | Rôle |
|---|---|
| `docker images` (= `docker image ls`) | Lister les images locales |
| `docker search nginx` | Chercher une image sur Docker Hub |
| `docker pull <i>:<tag>` | Télécharger une image (tag `latest` par défaut) |
| `docker image inspect <i>` | Détails d'une image |
| `docker image history <i>` | Voir les couches d'une image |
| `docker rmi <i>` | Supprimer une image |
| `docker image prune -a` | Supprimer toutes les images inutilisées |
| `docker tag <i> monpseudo/<i>:1.0` | Renommer / étiqueter une image (avant un push) |
| `docker login` puis `docker push monpseudo/<i>:1.0` | Déposer une image sur un registre (Docker Hub) |
| `docker build -t <i> .` | Construire une image à partir d'un Dockerfile |

## Conteneurs
| Commande | Rôle |
|---|---|
| `docker create --name <c> <i>` | Créer un conteneur sans le démarrer |
| `docker run <i>` | Créer **et** démarrer un conteneur |
| `docker run -it --name <c> alpine sh` | … avec un terminal interactif (`-i` entrée ouverte, `-t` pseudo-terminal) |
| `docker run -d --name <c> -p 8080:80 nginx:alpine` | … en arrière-plan, port 8080 de l'hôte → 80 du conteneur |
| `docker run --rm <i>` | … supprimé automatiquement à l'arrêt |
| `docker ps` | Conteneurs en cours d'exécution |
| `docker ps -a` | Tous les conteneurs (y compris arrêtés) |
| `docker ps -a --filter status=exited` | Seulement les conteneurs arrêtés |
| `docker ps -aq` | Identifiants de tous les conteneurs |
| `docker start <c>` | Démarrer un conteneur existant |
| `docker stop <c>` | Arrêter proprement un conteneur |
| `docker restart <c>` | Redémarrer |
| `docker rm <c>` | Supprimer un conteneur arrêté |
| `docker rm -f <c>` | Forcer la suppression (même en marche) |
| `docker exec -it <c> sh` | Ouvrir un shell dans un conteneur qui tourne |
| `docker exec <c> ls /usr/share/nginx/html` | Exécuter une commande dans un conteneur |
| `docker cp fichier <c>:/chemin/` | Copier un fichier de l'hôte vers le conteneur (et inversement) |
| `docker logs <c>` / `docker logs -f <c>` | Journaux du conteneur (en continu avec `-f`) |
| `docker inspect <c>` | Détails (IP, montages, ports…) |
| `docker stats` | Consommation CPU / mémoire en direct |

## Volumes
| Commande | Rôle |
|---|---|
| `docker volume create <v>` | Créer un volume |
| `docker volume ls` | Lister les volumes |
| `docker volume inspect <v>` | Détails (point de montage) |
| `docker run -v <v>:/usr/share/nginx/html <i>` | Monter un volume dans un conteneur |
| `docker run -v ${PWD}\site:/usr/share/nginx/html <i>` | Monter un dossier du PC (*bind mount*) |
| `docker volume rm <v>` | Supprimer un volume (non utilisé) |
| `docker volume prune -a` | Supprimer tous les volumes inutilisés |

## Réseaux
| Commande | Rôle |
|---|---|
| `docker network ls` | Lister les réseaux |
| `docker network create <r>` | Créer un réseau (pilote `bridge` par défaut) |
| `docker network inspect <r>` | Détails : type, sous-réseau, conteneurs connectés |
| `docker run --network <r> <i>` | Lancer un conteneur sur un réseau |
| `docker network connect <r> <c>` / `disconnect` | Brancher / débrancher un conteneur existant |
| `docker network rm <r>` | Supprimer un réseau |
| `docker network prune` | Supprimer les réseaux inutilisés |

## Dans les conteneurs (tests)
| Commande | Rôle |
|---|---|
| `apk add --no-cache curl` | Installer un paquet sous Alpine |
| `apt update && apt install -y curl iputils-ping` | Installer des paquets sous Debian / Ubuntu |
| `ping -c 3 <c>` | Tester la connexion vers un autre conteneur |
| `curl http://<c>` / `curl -I http://<c>` | Interroger un serveur web (page / en-têtes) |
| `cat /etc/resolv.conf` | Voir le DNS utilisé (127.0.0.11 = DNS interne Docker) |

## Tout arrêter et tout effacer
| Commande | Rôle |
|---|---|
| `docker stop $(docker ps -q)` | Arrêter tous les conteneurs |
| `docker rm -f $(docker ps -aq)` | Supprimer tous les conteneurs |
| `docker rmi $(docker images -q)` | Supprimer toutes les images |
| `docker volume rm $(docker volume ls -q)` | Supprimer tous les volumes |
| `docker system prune -a` | Conteneurs arrêtés + réseaux + images inutilisées + cache |
| `docker volume prune -a` | Tous les volumes inutilisés |

## Docker Compose (pour la suite de la SAÉ)
| Commande | Rôle |
|---|---|
| `docker compose up -d` | Créer et lancer tous les services du `compose.yaml` |
| `docker compose ps` | État des services |
| `docker compose logs -f` | Journaux de tous les services |
| `docker compose down` | Arrêter et supprimer conteneurs + réseau |
| `docker compose down -v` | … et les volumes |
