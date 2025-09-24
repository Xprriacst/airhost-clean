import { supabase } from './lib/supabase';

/**
 * Script de débogage pour tester l'enregistrement des tokens FCM
 * Utilise ce script pour identifier exactement où le problème se situe
 */

async function debugFCMRegistration() {
  console.log('🔍 DÉBUT DU DÉBOGAGE FCM REGISTRATION');
  console.log('=====================================');

  // Étape 1: Vérifier l'authentification
  console.log('\n1️⃣ Vérification de l\'authentification...');
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Erreur d\'authentification:', authError);
      return;
    }
    
    if (!user) {
      console.error('❌ Utilisateur non authentifié');
      console.log('💡 Connectez-vous d\'abord avant de tester');
      return;
    }
    
    console.log('✅ Utilisateur authentifié:', {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    });
  } catch (error) {
    console.error('❌ Erreur lors de la vérification d\'authentification:', error);
    return;
  }

  // Étape 2: Vérifier si la table push_subscriptions existe
  console.log('\n2️⃣ Vérification de la table push_subscriptions...');
  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('count(*)')
      .limit(1);
    
    if (error) {
      console.error('❌ Erreur lors de l\'accès à la table push_subscriptions:', error);
      console.log('💡 La table n\'existe peut-être pas ou vous n\'avez pas les permissions');
      return;
    }
    
    console.log('✅ Table push_subscriptions accessible');
    console.log('📊 Données de test:', data);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la table:', error);
    return;
  }

  // Étape 3: Vérifier si la fonction upsert_push_token existe
  console.log('\n3️⃣ Test de la fonction upsert_push_token...');
  try {
    const testToken = 'debug-test-token-' + Date.now();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase.rpc('upsert_push_token', {
      p_user_id: user!.id,
      p_token: testToken,
      p_platform: 'fcm'
    });
    
    if (error) {
      console.error('❌ Erreur lors de l\'appel à upsert_push_token:', error);
      console.log('💡 La fonction n\'existe peut-être pas ou il y a un problème de permissions');
      return;
    }
    
    console.log('✅ Fonction upsert_push_token fonctionne');
    console.log('📊 Résultat:', data);
  } catch (error) {
    console.error('❌ Erreur lors du test de la fonction:', error);
    return;
  }

  // Étape 4: Vérifier si le token a été inséré
  console.log('\n4️⃣ Vérification de l\'insertion du token...');
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erreur lors de la lecture des tokens:', error);
      return;
    }
    
    console.log('✅ Tokens trouvés pour cet utilisateur:', data);
    
    if (data && data.length > 0) {
      console.log('📊 Dernier token enregistré:', {
        id: data[0].id,
        token: data[0].token.substring(0, 20) + '...',
        platform: data[0].platform,
        created_at: data[0].created_at,
        updated_at: data[0].updated_at
      });
    } else {
      console.log('⚠️ Aucun token trouvé pour cet utilisateur');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des tokens:', error);
    return;
  }

  // Étape 5: Test avec un vrai token FCM (si disponible)
  console.log('\n5️⃣ Test avec un token FCM réel...');
  try {
    const realToken = localStorage.getItem('fcm_token');
    
    if (!realToken) {
      console.log('⚠️ Aucun token FCM trouvé dans localStorage');
      console.log('💡 Demandez d\'abord la permission de notification pour obtenir un token');
    } else {
      console.log('✅ Token FCM trouvé dans localStorage:', realToken.substring(0, 20) + '...');
      
      // Tester l'enregistrement du vrai token
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.rpc('upsert_push_token', {
        p_user_id: user!.id,
        p_token: realToken,
        p_platform: 'fcm'
      });
      
      if (error) {
        console.error('❌ Erreur lors de l\'enregistrement du vrai token:', error);
      } else {
        console.log('✅ Token FCM réel enregistré avec succès');
      }
    }
  } catch (error) {
    console.error('❌ Erreur lors du test avec le vrai token:', error);
  }

  console.log('\n🏁 FIN DU DÉBOGAGE');
  console.log('==================');
}

// Exporter la fonction pour l'utiliser dans la console
(window as any).debugFCMRegistration = debugFCMRegistration;

export { debugFCMRegistration };