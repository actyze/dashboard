# Démarrage rapide

```bash
git clone https://github.com/actyze/dashboard.git
cd dashboard/docker
cp env.example .env
# Modifiez le fichier .env et ajoutez votre clé API LLM (Anthropic, OpenAI, etc.)
./start.sh
```

* Interface web : http://localhost:3000
* API : http://localhost:8000

Identifiants par défaut : `nexus_admin` / `admin` (à modifier avant d'exposer l'instance à Internet).

Consultez [docker/README.md](docker/README.md) pour les différents profils de déploiement (local, Trino externe, PostgreSQL uniquement) et [docker/LLM_PROVIDERS.md](docker/LLM_PROVIDERS.md) pour la configuration des fournisseurs de modèles d'IA.
