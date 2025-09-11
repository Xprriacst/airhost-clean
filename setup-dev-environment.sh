#!/bin/bash

# Script de setup pour environnement de développement Airhost
# À exécuter par le développeur externe pour configurer son environnement DEV

set -e

echo "🚀 Configuration de l'environnement de développement Airhost"
echo "============================================================"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Vérifier les prérequis
echo ""
info "Vérification des prérequis..."

# Node.js
if ! command -v node &> /dev/null; then
    error "Node.js n'est pas installé. Veuillez installer Node.js >= 18"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js version $NODE_VERSION détectée. Version >= 18 requise"
    exit 1
fi
success "Node.js $(node -v) détecté"

# npm
if ! command -v npm &> /dev/null; then
    error "npm n'est pas installé"
    exit 1
fi
success "npm $(npm -v) détecté"

# Git
if ! command -v git &> /dev/null; then
    error "Git n'est pas installé"
    exit 1
fi
success "Git $(git --version | cut -d' ' -f3) détecté"

echo ""
info "Tous les prérequis sont satisfaits !"

# Configuration de l'environnement
echo ""
info "Configuration de l'environnement de développement..."

# Créer le fichier .env pour le frontend
if [ ! -f "frontend/.env" ]; then
    info "Création du fichier frontend/.env..."
    cat > frontend/.env << EOF
# Configuration DEV - À personnaliser avec vos propres clés
VITE_SUPABASE_URL=YOUR_DEV_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_DEV_SUPABASE_ANON_KEY
VITE_FIREBASE_API_KEY=YOUR_DEV_FIREBASE_API_KEY
VITE_FIREBASE_PROJECT_ID=YOUR_DEV_FIREBASE_PROJECT_ID
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_DEV_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_DEV_FIREBASE_APP_ID
EOF
    success "Fichier frontend/.env créé"
else
    warning "Le fichier frontend/.env existe déjà"
fi

# Installation des dépendances frontend
echo ""
info "Installation des dépendances frontend..."
cd frontend
npm install
success "Dépendances frontend installées"
cd ..

# Installation des dépendances backend (si nécessaire)
if [ -d "backend" ] && [ -f "backend/package.json" ]; then
    echo ""
    info "Installation des dépendances backend..."
    cd backend
    npm install
    success "Dépendances backend installées"
    cd ..
fi

# Installation des dépendances scripts (si nécessaire)
if [ -d "scripts" ] && [ -f "scripts/package.json" ]; then
    echo ""
    info "Installation des dépendances scripts..."
    cd scripts
    npm install
    success "Dépendances scripts installées"
    cd ..
fi

# Afficher les instructions de configuration
echo ""
echo "🔧 CONFIGURATION REQUISE"
echo "========================"
echo ""
warning "IMPORTANT: Vous devez maintenant configurer vos propres services !"
echo ""
echo "1. 📊 SUPABASE (Obligatoire)"
echo "   - Créez un nouveau projet sur https://supabase.com"
echo "   - Nom suggéré: 'airhost-dev-[votre-nom]'"
echo "   - Copiez l'URL et la clé ANON dans frontend/.env"
echo "   - Exécutez les migrations SQL dans l'éditeur Supabase"
echo ""
echo "2. 🤖 OPENAI (Obligatoire pour l'IA)"
echo "   - Créez un compte sur https://platform.openai.com"
echo "   - Générez une clé API avec quota limité (ex: 50$)"
echo "   - Configurez la clé dans vos Edge Functions Supabase"
echo ""
echo "3. 📱 WHATSAPP (Optionnel pour les tests)"
echo "   - Créez une app de test sur Meta Business"
echo "   - Utilisez des numéros de test uniquement"
echo "   - Configurez le webhook vers votre Supabase"
echo ""
echo "4. 🔔 FIREBASE (Optionnel pour les notifications)"
echo "   - Créez un projet sur https://console.firebase.google.com"
echo "   - Activez Cloud Messaging"
echo "   - Copiez les clés dans frontend/.env"
echo ""

# Afficher les commandes de développement
echo "🚀 COMMANDES DE DÉVELOPPEMENT"
echo "============================="
echo ""
echo "# Lancer le frontend en développement"
echo "cd frontend && npm run dev"
echo ""
echo "# Build du frontend"
echo "cd frontend && npm run build"
echo ""
echo "# Tests (si configurés)"
echo "npm test"
echo ""

# Afficher les liens utiles
echo "📚 RESSOURCES UTILES"
echo "===================="
echo ""
echo "• Documentation: README.md"
echo "• Guide de sécurité: SECURITY-GUIDE.md"
echo "• Variables d'environnement: env-config.example"
echo "• Structure de la DB: docs/database-structure.md"
echo "• Repository GitHub: https://github.com/Xprriacst/airhost-clean"
echo ""

# Vérifications finales
echo "🔍 VÉRIFICATIONS FINALES"
echo "========================"
echo ""

# Vérifier si le build fonctionne
info "Test du build frontend..."
cd frontend
if npm run build > /dev/null 2>&1; then
    success "Build frontend réussi"
else
    warning "Erreur de build - vérifiez la configuration"
fi
cd ..

echo ""
success "Configuration de l'environnement de développement terminée !"
echo ""
warning "N'oubliez pas de:"
warning "1. Configurer vos clés API dans frontend/.env"
warning "2. Créer votre projet Supabase DEV"
warning "3. Exécuter les migrations SQL"
warning "4. Lire le SECURITY-GUIDE.md"
echo ""
info "Une fois configuré, lancez: cd frontend && npm run dev"
