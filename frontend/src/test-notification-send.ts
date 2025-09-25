// Script to test actual FCM notification sending
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function testNotificationSend() {
  try {
    console.log('🚀 Testing notification send...');
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return false;
    }
    
    console.log('✅ User authenticated:', user.email);
    
    // Get user's FCM tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', user.id);
    
    if (tokenError || !tokens || tokens.length === 0) {
      console.error('❌ No tokens found:', tokenError);
      return false;
    }
    
    console.log(`📱 Found ${tokens.length} token(s), testing with first one...`);
    
    // Test notification payload
    const testPayload = {
      title: 'FCM Test Notification',
      body: 'This is a test notification to verify FCM is working!',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        url: window.location.origin
      }
    };
    
    console.log('📤 Sending test notification...');
    console.log('Payload:', testPayload);
    
    // Call the fcm-proxy Edge Function
    const { data, error } = await supabase.functions.invoke('fcm-proxy', {
      body: {
        token: tokens[0].endpoint, // Using the stored token
        notification: testPayload
      }
    });
    
    if (error) {
      console.error('❌ Notification send failed:', error);
      return false;
    }
    
    console.log('✅ Notification sent successfully!');
    console.log('Response:', data);
    
    // Also test with NotificationService if available
    try {
      const { NotificationService } = await import('./services/notification/notification.service');
      console.log('🔔 Testing with NotificationService...');
      
      await NotificationService.notifyNewMessage({
        senderId: user.id,
        senderName: user.email || 'Test User',
        content: 'Test message from NotificationService',
        chatId: 'test-chat-id'
      });
      
      console.log('✅ NotificationService test completed!');
    } catch (serviceError) {
      console.log('⚠️ NotificationService test skipped:', serviceError);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run test
testNotificationSend().then(success => {
  console.log(success ? '✅ Notification test complete' : '❌ Notification test failed');
});