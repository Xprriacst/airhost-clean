# Airhost - Gestionnaire de conversations WhatsApp pour hôtes Airbnb

Application complète de gestion et d'automatisation des conversations WhatsApp pour les hôtes Airbnb avec intelligence artificielle intégrée.

## 🚀 Fonctionnalités principales

### ✅ Fonctionnalités implémentées
- **Interface de chat en temps réel** avec Material-UI
- **Authentification sécurisée** via Supabase Auth
- **Intégration WhatsApp Cloud API** complète
- **Réponses automatiques IA** avec OpenAI GPT-4o-mini
- **Détection intelligente des urgences** (client mécontent, IA incertaine, problèmes critiques)
- **Système de templates** personnalisables
- **Notifications push** (FCM) et temps réel
- **Gestion multi-propriétés** avec instructions IA personnalisées
- **Sandbox de test** pour simuler les conversations
- **Dashboard des cas d'urgence** avec alertes visuelles

### 🔧 Architecture technique

```
/frontend/              # Application React/TypeScript
├── src/
│   ├── components/     # Composants UI réutilisables
│   ├── pages/          # Pages principales (Chat, Properties, etc.)
│   ├── services/       # Services API et logique métier
│   ├── hooks/          # Hooks React personnalisés
│   ├── lib/            # Configuration Supabase, Firebase
│   └── types/          # Types TypeScript

/backend/               # Services backend
├── src/
│   ├── controllers/    # Contrôleurs API
│   ├── services/       # Services métier (WhatsApp, OpenAI)
│   └── scripts/        # Scripts utilitaires

/supabase/              # Backend Supabase
├── functions/          # Edge Functions (webhooks, IA)
├── migrations/         # Migrations SQL
└── config.toml         # Configuration Supabase

/infra/                 # Infrastructure et déploiement
├── migrations/         # Scripts SQL d'infrastructure
└── *.sql              # Scripts de setup et maintenance

/scripts/               # Scripts d'automatisation
├── deploy-*.sh         # Scripts de déploiement
└── test-*.sh          # Scripts de test
```

## 📋 Prérequis

- **Node.js** >= 18
- **Compte Supabase** (base de données, auth, edge functions)
- **Compte Meta Business** avec application WhatsApp
- **Clé API OpenAI** (GPT-4o-mini recommandé)
- **Projet Firebase** (pour les notifications push)
- **Compte Netlify** (pour le déploiement frontend)

## 🛠️ Installation et configuration

### 1. Cloner le repository
```bash
git clone <repository-url>
cd airhost
```

### 2. Configuration des variables d'environnement

Créer les fichiers de configuration suivants :

#### Frontend (.env dans /frontend/)
```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

#### Supabase Edge Functions
Variables à configurer dans l'interface Supabase pour chaque fonction :
```env
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_VERIFY_TOKEN=YOUR_WHATSAPP_VERIFY_TOKEN
FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
FCM_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
```

### 3. Installation des dépendances

```bash
# Frontend
cd frontend
npm install

# Backend (si nécessaire)
cd ../backend
npm install

# Scripts
cd ../scripts
npm install
```

### 4. Configuration de la base de données

1. Créer un projet Supabase
2. Exécuter les migrations dans l'ordre :
   ```sql
   -- Exécuter dans l'éditeur SQL Supabase
   -- 1. Structure de base
   \i supabase/migrations/20240225_add_property_details.sql
   
   -- 2. Configuration WhatsApp
   \i supabase/migrations/20250221170301_create_whatsapp_config.sql
   
   -- 3. Messages
   \i supabase/migrations/20250221181600_create_messages.sql
   
   -- 4. Analyses d'urgence
   \i supabase/migrations/[autres_migrations].sql
   ```

### 5. Déploiement des Edge Functions

Déployer manuellement via l'interface Supabase :

1. **analyze-emergency** : Analyse des messages d'urgence
2. **create-conversation** : Création de nouvelles conversations
3. **fcm-proxy** : Proxy pour les notifications Firebase
4. **generate-ai-response** : Génération de réponses IA
5. **send-whatsapp-template** : Envoi de templates WhatsApp
6. **whatsapp-config** : Configuration WhatsApp
7. **whatsapp-webhook** : Webhook pour recevoir les messages

### 6. Configuration WhatsApp

1. Créer une application Meta Business
2. Configurer l'API WhatsApp Cloud
3. Ajouter l'URL du webhook : `YOUR_SUPABASE_URL/functions/v1/whatsapp-webhook`
4. Configurer le verify token dans l'interface de l'application

### 7. Lancement en développement

```bash
cd frontend
npm run dev
```

## 🧪 Tests

### Tests automatisés
```bash
# Test de création de conversation
./test-create-conversation.sh

# Test de connexion Supabase
./test-supabase-connection.js

# Test de détection d'urgence
./test-emergency-detection.sh
```

### Tests manuels
- Utiliser la **ChatSandbox** pour simuler des conversations
- Tester les différents types d'urgence
- Vérifier les notifications push

## 🚀 Déploiement

### Frontend (Netlify)
```bash
# Build
cd frontend
npm run build

# Déploiement automatique via Git ou manuel
```

### Backend (Supabase)
- Les Edge Functions sont déployées manuellement
- Les migrations sont appliquées via l'interface SQL

## 🔧 Architecture des fonctionnalités

### Système de détection d'urgence
1. **Analyse automatique** des messages entrants via OpenAI
2. **Classification** en 4 catégories :
   - Urgences critiques (chauffage, fuites, etc.)
   - IA incertaine (information manquante)
   - Client mécontent (insatisfaction)
   - Problèmes de logement (non critiques)
3. **Alertes visuelles** dans l'interface
4. **Notifications** automatiques à l'hôte

### Réponses IA personnalisées
- **Instructions personnalisées** par propriété
- **Détection d'incertitude** avec marqueur invisible
- **Suggestions de réponses** en temps réel
- **Apprentissage contextuel** basé sur l'historique

### Intégration WhatsApp
- **Réception automatique** des messages via webhook
- **Envoi de réponses** via API Cloud
- **Gestion des templates** approuvés par Meta
- **Respect de la fenêtre de 24h**

## 📚 Documentation technique

- [Structure de la base de données](docs/database-structure.md)
- [Roadmap détaillée](ROADMAP.md)
- Scripts de migration dans `/infra/`
- Tests dans `/scripts/`

## 🐛 Problèmes connus

- Notifications FCM : Token JWT expire après 1h (nécessite renouvellement)
- Messages WhatsApp : Association au premier utilisateur trouvé avec le même numéro
- Compilation locale : Problèmes de types avec 'mime' (déployer directement sur Netlify)

## 🤝 Contribution

Ce projet est propriétaire. Pour toute modification :
1. Créer une branche feature
2. Tester en local et en recette
3. Créer un tag après validation
4. Déployer en production

## 📄 Licence

Propriétaire - Tous droits réservés
