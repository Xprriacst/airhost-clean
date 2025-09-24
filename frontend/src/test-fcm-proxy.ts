// Test script to check FCM proxy function directly
import { supabase } from './lib/supabase';

async function testFCMProxy() {
  console.log('=== TEST FCM PROXY FUNCTION ===');
  
  try {
    // Test 1: Check if function exists with a simple GET request
    console.log('Test 1: Checking if FCM proxy function exists...');
    
    const { data: configData, error: configError } = await supabase.functions.invoke('fcm-proxy/config', {
      method: 'GET'
    });
    
    console.log('Config response data:', configData);
    console.log('Config response error:', configError);
    
    // Test 2: Try to call the function with a test payload
    console.log('\nTest 2: Testing FCM proxy with test payload...');
    
    const testPayload = {
      to: 'test-fcm-token',
      notification: {
        title: 'Test Notification',
        body: 'This is a test notification'
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        direction: 'inbound'
      }
    };
    
    const { data: testData, error: testError } = await supabase.functions.invoke('fcm-proxy', {
      body: testPayload
    });
    
    console.log('Test response data:', testData);
    console.log('Test response error:', testError);
    
    // Test 3: Check the raw response
    console.log('\nTest 3: Making raw HTTP request...');
    
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (token) {
      const response = await fetch('https://whxkhrtlccxubvjgexmi.supabase.co/functions/v1/fcm-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kZXlkdWJma3V0cmlkdm56aXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg1MzI0NjcsImV4cCI6MjAyNDEwODQ2N30.VvVzBJLNfBjJGGnJVHOKqXGMKfqhNQjWZhZcPqKqKqY'
        },
        body: JSON.stringify(testPayload)
      });
      
      console.log('Raw response status:', response.status);
      console.log('Raw response headers:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      try {
        const responseJson = JSON.parse(responseText);
        console.log('Raw response JSON:', responseJson);
      } catch (e) {
        console.log('Response is not valid JSON:', e.message);
      }
    } else {
      console.log('No session token available for raw request');
    }
    
  } catch (error) {
    console.error('Error testing FCM proxy:', error);
  }
  
  console.log('=== END FCM PROXY TEST ===');
}

// Export the test function
export { testFCMProxy };

// Auto-run if this file is executed directly
if (typeof window !== 'undefined') {
  (window as any).testFCMProxy = testFCMProxy;
  console.log('FCM Proxy test function available as window.testFCMProxy()');
}