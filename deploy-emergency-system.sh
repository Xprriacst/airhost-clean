#!/bin/bash

echo "🚨 Déploiement du système de détection d'urgence"

# 1. Appliquer la migration de la base de données
echo "📊 Déploiement de la migration de base de données..."
supabase db push

# 2. Déployer les Edge Functions
echo "⚡ Déploiement des Edge Functions..."
supabase functions deploy generate-ai-response
supabase functions deploy analyze-emergency

# 3. Vérifier les variables d'environnement des fonctions
echo "🔧 Configuration des variables d'environnement..."
echo "Variables requises:"
echo "- OPENAI_API_KEY"
echo "- SUPABASE_URL" 
echo "- SUPABASE_SERVICE_ROLE_KEY"

# 4. Test de connectivité
echo "🧪 Test de connectivité..."
echo "Testez le système en:"
echo "1. Envoyant un message avec l'IA qui contient de l'incertitude"
echo "2. Envoyant un message client exprimant une urgence"
echo "3. Vérifiez les icônes d'urgence dans l'interface"
echo "4. Consultez la page /emergency pour voir les cas détectés"

echo "✅ Déploiement terminé !"
echo "🔍 Surveillez les logs des Edge Functions pour diagnostiquer les problèmes"