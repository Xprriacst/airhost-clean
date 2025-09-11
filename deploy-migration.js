const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function deployMigration() {
  console.log('🚀 Déploiement de la migration...');
  
  try {
    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'supabase/migrations/20250526_create_conversation_analyses.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL lue avec succès');
    console.log('📊 Exécution de la migration...');
    
    // Exécuter la migration via RPC
    const { data, error } = await supabase.rpc('exec', {
      sql: migrationSQL
    });
    
    if (error) {
      // Si RPC ne fonctionne pas, essayons une approche différente
      console.log('⚠️ RPC exec non disponible, utilisation d\'une approche alternative...');
      
      // Diviser le SQL en commandes individuelles
      const sqlCommands = migrationSQL
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
      
      console.log(`📋 ${sqlCommands.length} commandes SQL à exécuter`);
      
      // Note: Supabase client ne permet pas d'exécuter du SQL arbitraire depuis le client
      // Il faut utiliser l'interface web ou le CLI
      console.log('❌ Impossible d\'exécuter la migration via le client JavaScript');
      console.log('');
      console.log('📝 INSTRUCTIONS MANUELLES :');
      console.log('1. Allez sur https://whxkhrtlccxubvjgexmi.supabase.co/project/whxkhrtlccxubvjgexmi/sql');
      console.log('2. Copiez-collez le contenu suivant dans l\'éditeur SQL :');
      console.log('');
      console.log('--- DÉBUT DU SQL ---');
      console.log(migrationSQL);
      console.log('--- FIN DU SQL ---');
      console.log('');
      console.log('3. Cliquez sur "Run" pour exécuter');
      
      return false;
    }
    
    console.log('✅ Migration appliquée avec succès !');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur lors du déploiement :', error.message);
    return false;
  }
}

async function checkTableExists() {
  console.log('🔍 Vérification de la table conversation_analyses...');
  
  try {
    const { data, error } = await supabase
      .from('conversation_analyses')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.log('❌ Table conversation_analyses n\'existe pas encore');
      return false;
    }
    
    if (error) {
      console.log('⚠️ Erreur lors de la vérification :', error.message);
      return false;
    }
    
    console.log('✅ Table conversation_analyses existe');
    return true;
    
  } catch (error) {
    console.log('❌ Erreur lors de la vérification :', error.message);
    return false;
  }
}

async function deployEdgeFunctions() {
  console.log('⚡ Déploiement des Edge Functions...');
  console.log('');
  console.log('📝 INSTRUCTIONS MANUELLES pour les Edge Functions :');
  console.log('');
  console.log('1. Fonction generate-ai-response :');
  console.log('   - Allez sur votre interface Supabase Functions');
  console.log('   - Créez une nouvelle fonction nommée "generate-ai-response"');
  console.log('   - Copiez le contenu de : supabase/functions/generate-ai-response/index.ts');
  console.log('');
  console.log('2. Fonction analyze-emergency :');
  console.log('   - Créez une nouvelle fonction nommée "analyze-emergency"');
  console.log('   - Copiez le contenu de : supabase/functions/analyze-emergency/index.ts');
  console.log('');
  console.log('3. Variables d\'environnement (pour chaque fonction) :');
  console.log('   - OPENAI_API_KEY = YOUR_OPENAI_API_KEY');
  console.log('   - SUPABASE_URL = YOUR_SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY = YOUR_SUPABASE_SERVICE_ROLE_KEY');
}

async function buildFrontend() {
  console.log('🏗️ Build du frontend...');
  
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    console.log('📦 Installation des dépendances...');
    await execAsync('cd frontend && npm install');
    
    console.log('🔨 Build du frontend...');
    await execAsync('cd frontend && npm run build');
    
    console.log('✅ Frontend buildé avec succès !');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur lors du build :', error.message);
    return false;
  }
}

async function main() {
  console.log('🚨 DÉPLOIEMENT DU SYSTÈME DE DÉTECTION D\'URGENCE');
  console.log('================================================');
  console.log('');
  
  // 1. Vérifier si la table existe
  const tableExists = await checkTableExists();
  
  // 2. Déployer la migration si nécessaire
  if (!tableExists) {
    await deployMigration();
  }
  
  // 3. Instructions pour les Edge Functions
  await deployEdgeFunctions();
  
  // 4. Build du frontend
  await buildFrontend();
  
  console.log('');
  console.log('🎯 ÉTAPES SUIVANTES :');
  console.log('1. Exécutez la migration SQL manuellement dans l\'interface Supabase');
  console.log('2. Créez les Edge Functions manuellement');
  console.log('3. Déployez le frontend sur Netlify');
  console.log('4. Testez le système en envoyant des messages avec urgences');
  console.log('');
  console.log('✅ Script de déploiement terminé !');
}

main().catch(console.error);