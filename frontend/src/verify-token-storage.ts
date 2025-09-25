// Script to verify FCM token storage in database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function verifyTokenStorage() {
  try {
    console.log('🔍 Checking token storage...');
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return false;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Check push_subscriptions table
    const { data: tokens, error: tokenError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);
    
    if (tokenError) {
      console.error('❌ Error fetching tokens:', tokenError);
      return false;
    }
    
    console.log('📱 Stored tokens:', tokens);
    
    if (tokens && tokens.length > 0) {
      console.log('✅ Token storage verified!');
      console.log(`Found ${tokens.length} token(s) for user`);
      tokens.forEach((token, index) => {
        console.log(`Token ${index + 1}:`, {
          id: token.id,
          endpoint: token.endpoint?.substring(0, 50) + '...',
          created_at: token.created_at,
          updated_at: token.updated_at
        });
      });
      return true;
    } else {
      console.log('⚠️ No tokens found for user');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

// Run verification
verifyTokenStorage().then(success => {
  console.log(success ? '✅ Verification complete' : '❌ Verification failed');
});