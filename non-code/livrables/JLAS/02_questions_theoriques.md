# CM-TD-TP SAE5012 — Partie 1 : étude théorique de Docker

Sources : geekflare.com/fr (understanding-docker-for-beginner, docker-architecture, docker-vs-virtual-machine), learn.microsoft.com/fr-fr/windows/wsl/about, documentation officielle docs.docker.com.

### 1. Quel est l'avantage pour un développeur / chef de projet d'utiliser Docker ?
- **Développeur** : l'application est livrée avec tout son environnement (version de PHP, extensions, serveur web, base de données). Fini le « ça marche sur ma machine » : le conteneur se comporte pareil sur le PC de chacun, sur le serveur de test et en production. On peut aussi lancer en une commande des services qu'on n'a pas besoin d'installer sur son PC (MySQL, phpMyAdmin…), et changer de version facilement (`php:8.2` → `php:8.4`).
- **Chef de projet** : un nouveau membre de l'équipe est opérationnel en quelques minutes (`docker compose up`), l'environnement est décrit dans des fichiers versionnés avec le code (Dockerfile, `compose.yaml`), les déploiements sont reproductibles et automatisables (intégration et déploiement continus), et on maîtrise mieux les coûts d'hébergement (plusieurs conteneurs sur un même serveur).

### 2. Qu'est-ce que Bureau Docker (Docker Desktop) ?
C'est l'application de bureau officielle de Docker pour Windows, macOS et Linux. Elle installe en un seul paquet le moteur Docker, la CLI `docker`, Docker Compose, Docker Buildx et une **interface graphique** pour gérer images, conteneurs, volumes et réseaux. Sous Windows, elle fait tourner le moteur Docker (qui est Linux) dans WSL 2 ou dans Hyper-V. Elle est gratuite pour l'enseignement, l'usage personnel et les petites entreprises.

### 3. Quelques avantages de Docker
- **Portabilité** : « build once, run anywhere », une image tourne sur tout hôte avec Docker.
- **Légèreté** : pas de système d'exploitation complet par conteneur ; démarrage en quelques secondes, faible consommation de RAM et de disque.
- **Isolation** : chaque service a ses dépendances, ses processus et son réseau, sans conflit avec les autres.
- **Reproductibilité** : l'environnement est décrit en code (Dockerfile, Compose) et versionné avec Git.
- **Modularité / microservices** : un service par conteneur (web, PHP, base de données), qu'on peut mettre à jour ou remplacer séparément.
- **Écosystème** : des milliers d'images officielles prêtes à l'emploi sur Docker Hub (nginx, mysql, php…).
- **Passage à l'échelle** : facile de lancer plusieurs copies d'un même conteneur (Swarm, Kubernetes).

### 4. Principe des machines virtuelles classiques (VirtualBox, VMware, Hyper-V…)
Un **hyperviseur** simule un ordinateur complet (processeur, mémoire, disque, carte réseau virtuels). Dans chaque machine virtuelle on installe un **système d'exploitation invité complet** (avec son propre noyau), puis les applications. 
- Hyperviseur de **type 1** (« bare metal ») : directement sur le matériel (Hyper-V, VMware ESXi, Proxmox/KVM). 
- Hyperviseur de **type 2** : installé comme une application sur un système hôte (VirtualBox, VMware Workstation). 
Chaque VM pèse donc plusieurs Go et met du temps à démarrer, mais elle est très isolée et peut faire tourner un autre système (Windows dans Linux, etc.).

### 5. Le moteur Docker (Docker Engine)
C'est la partie qui fait réellement tourner les conteneurs, selon une architecture **client-serveur** :
- le **démon `dockerd`** (serveur), qui tourne en arrière-plan et gère images, conteneurs, réseaux et volumes ;
- une **API REST** par laquelle on lui donne des ordres ;
- le **client** `docker` (CLI) qui envoie les commandes à l'API.
Sous le capot, `dockerd` s'appuie sur **containerd** et **runc**, et sur des fonctions du noyau Linux : les **namespaces** (isolation des processus, du réseau, des fichiers) et les **cgroups** (limitation du CPU et de la mémoire).

### 6. À quoi sert l'interface CLI ?
La CLI (*Command Line Interface*, la commande `docker`) permet de piloter le moteur Docker depuis un terminal : `docker pull`, `docker run`, `docker ps`, `docker build`, `docker compose up`… Elle fait tout ce que fait l'interface graphique, et plus encore ; surtout, elle est **scriptable et automatisable** (scripts, intégration continue, serveurs sans interface graphique comme ceux de production).

### 7. Qu'est-ce que le registre Docker ?
C'est un **serveur de stockage et de distribution d'images**. On y dépose des images (`docker push`) et on les récupère (`docker pull`). Le registre public par défaut est **Docker Hub** (hub.docker.com) ; il existe d'autres registres (GitHub Container Registry, GitLab Container Registry — comme celui du GitLab de l'université —, registres privés auto-hébergés). C'est le « hub » demandé par le sujet de la SAÉ pour déposer nos conteneurs.

### 8. Qu'est-ce qu'une image Docker ?
C'est un **modèle en lecture seule** qui contient tout ce qu'il faut pour lancer une application : un système de fichiers minimal, les bibliothèques, le code, la configuration et la commande de démarrage. Une image est construite en **couches** empilées (une par instruction du Dockerfile : `FROM`, `RUN`, `COPY`…) ; les couches communes sont partagées entre images, ce qui économise de la place. Elle est identifiée par un nom et un tag : `nginx:1.29-alpine`.

### 9. Qu'est-ce qu'un conteneur Docker ?
C'est une **instance en cours d'exécution d'une image** : Docker ajoute une fine couche modifiable par-dessus les couches en lecture seule de l'image, et lance le processus dans un environnement isolé (namespaces, cgroups). Un conteneur peut être créé, démarré, arrêté, redémarré et supprimé. Il **partage le noyau** du système hôte.

### 10. Qu'est-ce qu'un volume Docker ?
C'est un espace de stockage **géré par Docker, extérieur au conteneur**, monté dans celui-ci (par exemple sur `/var/lib/mysql` ou `/usr/share/nginx/html`). Les données d'un volume **survivent à la suppression du conteneur** : on peut supprimer le conteneur, en recréer un autre, remonter le même volume et retrouver les données. Variante : le *bind mount*, qui monte un dossier précis de l'hôte (utile en développement pour voir ses modifications de code en direct).

### 11. Différence entre une image et un conteneur
L'**image** est le modèle figé (comme une classe en programmation, ou un fichier `.iso`) ; le **conteneur** est une exécution de ce modèle (comme un objet, une instance). À partir d'une seule image, on peut lancer autant de conteneurs qu'on veut. Supprimer un conteneur ne supprime pas l'image ; une image utilisée par un conteneur ne peut pas être supprimée.

### 12. Pourquoi utiliser les ports sous Docker (exemple `8080:80`) ?
Un conteneur a son propre réseau isolé : nginx écoute sur le port 80 **du conteneur**, inaccessible depuis l'hôte par défaut. L'option `-p 8080:80` **publie** le port : elle redirige le port **8080 de l'hôte** (à gauche) vers le port **80 du conteneur** (à droite). On visite alors `http://localhost:8080`. Cela permet aussi de lancer plusieurs serveurs web en même temps sur des ports différents de l'hôte (8080, 8081…) alors qu'ils écoutent tous sur le port 80 dans leur conteneur, et de ne pas exposer les services internes (la base de données reste accessible seulement aux autres conteneurs).

### 13. Comparaison VM / Docker : sécurité, portabilité, performances

| Critère | Machine virtuelle | Conteneur Docker |
|---|---|---|
| **Sécurité / isolation** | Très forte : chaque VM a son propre noyau, l'hyperviseur sépare matériellement les VM. Une faille dans une VM touche rarement les autres. | Plus faible : tous les conteneurs **partagent le noyau** de l'hôte ; une faille du noyau ou un conteneur mal configuré (lancé en `root`, `--privileged`) peut toucher l'hôte. On renforce avec des utilisateurs non-root, des images officielles et à jour, le mode rootless, les profils seccomp/AppArmor. |
| **Portabilité** | Moyenne : images de plusieurs Go, formats différents selon l'hyperviseur (VDI, VMDK, VHDX). | Excellente : images légères (quelques Mo à quelques centaines de Mo), standard OCI, partagées via un registre ; tourne pareil partout où Docker est installé (attention à l'architecture : amd64/arm64). |
| **Performances** | Plus lourdes : un OS complet par VM (Go de RAM et de disque), démarrage en minutes, surcoût de la virtualisation du matériel. | Quasi natives : pas d'OS invité, démarrage en secondes, très peu de RAM, beaucoup plus de conteneurs que de VM sur une même machine. |

En pratique, les deux se combinent : en production, les conteneurs tournent souvent dans des VM ; et sous Windows, Docker Desktop lui-même utilise une VM légère (WSL 2).

### 14. Qu'est-ce que WSL pour Windows ?
**WSL** (*Windows Subsystem for Linux*, Sous-système Windows pour Linux) permet de faire tourner des distributions Linux (Ubuntu, Debian…) directement dans Windows, sans VM traditionnelle ni double démarrage. 
- **WSL 1** traduisait les appels système Linux en appels Windows. 
- **WSL 2** (actuel) fait tourner un **vrai noyau Linux** dans une machine virtuelle très légère gérée par Windows (« Plateforme de machine virtuelle »), qui démarre en quelques secondes et n'utilise la mémoire qu'au besoin. 
Docker Desktop s'en sert comme moteur : le démon Docker tourne dans une distribution WSL 2 dédiée (`docker-desktop`). C'est indispensable sur Windows **Famille**, qui n'a pas Hyper-V.

### 15. Commandes pour tout arrêter et tout effacer
```powershell
docker stop $(docker ps -q)          # arrêter tous les conteneurs en cours
docker rm $(docker ps -aq)           # supprimer tous les conteneurs
docker rmi $(docker images -q)       # supprimer toutes les images
docker volume rm $(docker volume ls -q)   # supprimer tous les volumes
docker network prune                 # supprimer les réseaux personnalisés inutilisés

# Ou en deux commandes de nettoyage :
docker system prune -a      # conteneurs arrêtés, réseaux inutilisés, toutes les images non utilisées, cache de build
docker volume prune -a      # tous les volumes inutilisés (sans -a, seulement les volumes anonymes depuis Docker 23)
```
(Sous PowerShell, la syntaxe `$(...)` fonctionne aussi. Si la liste est vide, la commande affiche une erreur sans gravité.)
