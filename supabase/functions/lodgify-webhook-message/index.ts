import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// HMAC signature verification
async function verifyWebhookSignature(body, signature, secret) {
  if (!signature || !secret) {
    return false;
  }
  try {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace(/^sha256=/, '');
    // Create HMAC-SHA256 hash
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'sign'
    ]);
    const hashBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b)=>b.toString(16).padStart(2, '0')).join('');
    // console.log('Expected signature:', cleanSignature);
    // console.log('Computed signature:', hashHex);
    // Compare ignoring case
    return hashHex.toLowerCase() === cleanSignature.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
// Get webhook secret for specific host
async function getWebhookSecretForHost(hostId) {
  try {
    const { data: config } = await supabase.from('lodgify_config').select('message_webhook_secret').eq('host_id', hostId).single();
    return config?.message_webhook_secret || null;
  } catch (error) {
    console.error('Error fetching webhook secret for host:', hostId, error);
    return null;
  }
}
// Verify webhook signature for specific host
async function verifyWebhookForHost(body, signature, hostId) {
  const secret = await getWebhookSecretForHost(hostId);
  if (!secret) {
    console.error('No webhook secret found for host:', hostId);
    return false;
  }
  const isValid = await verifyWebhookSignature(body, signature, secret);
  if (isValid) {
    console.log('Webhook signature verified for host:', hostId);
    return true;
  }
  console.error('Invalid webhook signature for host:', hostId);
  return false;
}
serve(async (req)=>{
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405
      });
    }
    // Extract host_id from query parameters
    const url = new URL(req.url);
    const hostId = url.searchParams.get('host_id');
    if (!hostId) {
      console.error('Missing host_id parameter in webhook URL');
      return new Response('Bad Request - Missing host_id parameter', {
        status: 400
      });
    }
    const body = await req.text();
    // console.log('Raw webhook body for host:', hostId, body);
    const parsedBody = JSON.parse(body);
    // Handle both array and single object formats
    const events = Array.isArray(parsedBody) ? parsedBody : [
      parsedBody
    ];
    if (events.length === 0) {
      return new Response('No events to process', {
        status: 400
      });
    }
    // Process the first event (Lodgify typically sends one event per webhook)
    const event = events[0];
    console.log('Parsed webhook event for host:', hostId, JSON.stringify(event, null, 2));
    // Verify webhook signature using specific host's secret
    const signature = req.headers.get('ms-signature');
    if (signature) {
      const isValid = await verifyWebhookForHost(body, signature, hostId);
      if (!isValid) {
        console.error('Invalid webhook signature for host:', hostId);
        return new Response('Unauthorized - Invalid signature', {
          status: 401
        });
      }
      console.log('Webhook signature verified successfully for host:', hostId);
    } else {
      console.warn('No ms-signature header found in webhook request for host:', hostId);
      return new Response('Missing signature header', {
        status: 400
      });
    }
    // Extract client identification from host_id
    const clientApiKey = await extractClientFromHost(hostId);
    console.log('Client API key found for host:', hostId, clientApiKey ? 'Yes' : 'No');
    if (!clientApiKey) {
      console.error('Unable to identify client from host_id:', hostId);
      return new Response('Client identification required', {
        status: 400
      });
    }
    console.log('Starting message processing for host:', hostId);
    const result = await handleGuestMessage(event, clientApiKey, hostId);
    console.log('Message processing completed:', result);
    // Ensure result is a string to avoid undefined.startsWith() error
    const resultString = result || 'ERROR: Unknown processing error';
    if (resultString.startsWith('SUCCESS')) {
      return new Response(JSON.stringify({
        message: resultString,
        status: 'success'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else if (resultString.startsWith('ERROR')) {
      return new Response(JSON.stringify({
        error: resultString,
        status: 'error'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      return new Response(JSON.stringify({
        message: resultString,
        status: 'unknown'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Message webhook processing error:', error);
    return new Response(`Internal server error: ${error.message}`, {
      status: 500
    });
  }
});
async function extractClientFromHost(hostId) {
  try {
    const { data: config } = await supabase.from('lodgify_config').select('api_key').eq('host_id', hostId).single();
    return config?.api_key || null;
  } catch (error) {
    console.error('Error fetching API key for host:', hostId, error);
    return null;
  }
}
async function handleGuestMessage(event, clientApiKey, hostId) {
  try {
    console.log('=== Starting handleGuestMessage ===');
    console.log('Event inbox_uid:', event.inbox_uid);
    console.log('Event thread_uid:', event.thread_uid);
    console.log('Event guest_name:', event.guest_name);
    // Primary strategy: Find conversation by lodgify_booking_id matching inbox_uid
    console.log('Searching for conversation by lodgify_booking_id (inbox_uid)...');
    let { data: conversation, error: conversationError } = await supabase.from('conversations').select('id, unread_count, guest_name, lodgify_booking_id, lodgify_thread_uid, host_id').eq('lodgify_booking_id', event.inbox_uid.slice(1)).single();
    console.log('Conversation by lodgify_booking_id result:', {
      conversation,
      conversationError
    });
    if (conversation && !conversationError) {
      // Get lodgify config for the host
      const { data: lodgifyConfig, error: configError } = await supabase.from('lodgify_config').select('api_key, host_id').eq('host_id', conversation.host_id).single();
      if (lodgifyConfig && !configError) {
        // Attach config to conversation
        conversation.lodgify_config = lodgifyConfig;
        console.log('Successfully loaded lodgify config for conversation');
      } else {
        console.error('Failed to load lodgify config:', configError);
      }
    }
    // Fallback 1: Find by thread_uid if already set
    if (conversationError || !conversation) {
      console.log('No conversation found by lodgify_booking_id, trying thread_uid...');
      const { data: threadConversation, error: threadError } = await supabase.from('conversations').select('id, unread_count, guest_name, lodgify_booking_id, lodgify_thread_uid, host_id').eq('lodgify_thread_uid', event.thread_uid).single();
      console.log('Conversation by thread_uid result:', {
        threadConversation,
        threadError
      });
      if (!threadError && threadConversation) {
        conversation = threadConversation;
        // Load lodgify config for thread conversation
        const { data: lodgifyConfig, error: configError } = await supabase.from('lodgify_config').select('api_key, host_id').eq('host_id', conversation.host_id).single();
        if (lodgifyConfig && !configError) {
          conversation.lodgify_config = lodgifyConfig;
        }
      }
    }
    // Check if we have a valid conversation to proceed with message processing
    if (conversation && conversation.lodgify_config) {
      console.log('Proceeding with message processing for existing conversation');
    } else {
      // Fallback 2: Find by guest_name and update with thread_uid
      console.log('No conversation found by booking_id or thread_uid, searching by guest_name:', event.guest_name);
      const { data: simpleConversation, error: simpleError } = await supabase.from('conversations').select('id, unread_count, guest_name, host_id, lodgify_booking_id, lodgify_thread_uid').eq('guest_name', event.guest_name).is('lodgify_thread_uid', null).order('created_at', {
        ascending: false
      }).limit(1);
      console.log('Simple conversation search result:', {
        simpleConversation,
        simpleError
      });
      // If no conversation found, create one based on the message event
      if (simpleError || !simpleConversation || simpleConversation.length === 0) {
        console.log('Creating new conversation from guest message...');
        const { data: newConversation, error: createError } = await supabase.from('conversations').insert({
          host_id: hostId,
          guest_name: event.guest_name,
          lodgify_booking_id: event.inbox_uid ? event.inbox_uid.slice(1) : null,
          lodgify_thread_uid: event.thread_uid,
          status: 'active',
          last_message_at: new Date().toISOString()
        }).select().single();
        if (createError) {
          console.error('Failed to create conversation:', createError);
          return 'ERROR: Failed to create conversation';
        }
        conversation = newConversation;
        // Get lodgify config for the newly created conversation
        const { data: lodgifyConfig, error: configError } = await supabase.from('lodgify_config').select('api_key, host_id').eq('host_id', hostId).single();
        if (configError || !lodgifyConfig) {
          console.error('Lodgify config not found for host:', hostId);
          return 'ERROR: Lodgify configuration not found';
        }
        conversation.lodgify_config = lodgifyConfig;
      } else {
        // Get lodgify config data for existing conversation
        const { data: lodgifyConfig, error: configError } = await supabase.from('lodgify_config').select('api_key, host_id').eq('host_id', simpleConversation[0].host_id).single();
        console.log('Lodgify config result:', {
          lodgifyConfig,
          configError
        });
        if (configError || !lodgifyConfig) {
          console.error('Lodgify config not found for host:', simpleConversation[0].host_id);
          return 'ERROR: Lodgify configuration not found';
        }
        // Construct conversation object
        conversation = {
          ...simpleConversation[0],
          lodgify_config: lodgifyConfig
        };
        // Update conversation with thread_uid and booking_id if missing
        console.log('Updating conversation with thread_uid and booking_id...');
        const updateData = {
          lodgify_thread_uid: event.thread_uid,
          lodgify_booking_id: event.inbox_uid ? event.inbox_uid.slice(1) : null
        };
        // Only update booking_id if it's missing and inbox_uid is present
        if (!conversation.lodgify_booking_id) {
          updateData.lodgify_booking_id = event.inbox_uid.slice(1);
          console.log('Also updating lodgify_booking_id to:', event.inbox_uid.slice(1));
        }
        const { error: updateError } = await supabase.from('conversations').update(updateData).eq('id', conversation.id);
        if (updateError) {
          console.error('Error updating conversation:', updateError);
          return 'ERROR: Failed to update conversation';
        }
        console.log(`Updated conversation ${conversation.id} with thread_uid: ${event.thread_uid}`);
      }
    }
    // Ensure we have a valid conversation with lodgify_config before proceeding
    if (!conversation || !conversation.lodgify_config) {
      console.error('No valid conversation or lodgify config found');
      return 'ERROR: No valid conversation found';
    }
    // Verify client API key matches
    console.log('Verifying API key...');
    if (conversation.lodgify_config?.api_key !== clientApiKey) {
      console.error('API key mismatch for thread_uid:', event.thread_uid);
      return 'ERROR: API key mismatch';
    }
    // Check if message already exists
    const { data: existingMessage } = await supabase.from('messages').select('id').eq('lodgify_message_id', event.message_id.toString()).single();
    if (existingMessage) {
      console.log(`Message ${event.message_id} already exists`);
      return 'SUCCESS: Message already exists';
    }
    // Insert the message
    console.log('Inserting new message...');
    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      content: event.message,
      type: 'text',
      direction: 'inbound',
      status: 'delivered',
      lodgify_message_id: event.message_id.toString()
    });
    if (messageError) {
      console.error('Error inserting message:', messageError);
      return 'ERROR: Failed to insert message';
    }
    // Update conversation with new message info
    console.log('Updating conversation with new message info...');
    const { error: updateError } = await supabase.from('conversations').update({
      last_message: event.message,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      lodgify_thread_uid: event.thread_uid
    }).eq('id', conversation.id);
    if (updateError) {
      console.error('Error updating conversation:', updateError);
      return 'ERROR: Failed to update conversation';
    }
    console.log(`Added message ${event.message_id} to conversation ${conversation.id}`);
    // === 🔔 TRIGGER FCM NOTIFICATION ===
    const { data: subscriptions, error: subError } = await supabase.from('push_subscriptions').select('token').eq('user_id', hostId);
    if (subError) {
      console.error('Error fetching push subscriptions:', subError);
      return 'ERROR: Failed to fetch push subscriptions';
    }
    if (!subscriptions || subscriptions.length === 0) {
      console.warn('No push subscriptions found for host:', hostId);
      return 'SUCCESS: Message processed (no subscribers)';
    }
    // Build payload template
    const basePayload = {
      data: {
        title: `New message from ${event.guest_name}`,
        body: event.message,
        conversationId: conversation.id,
        messageId: event.message_id.toString(),
        url: "https://airhost-clean.netlify.app",
        timestamp: Date.now(),
        direction: "inbound"
      }
    };
    // Send notification for each subscription
    for (const sub of subscriptions){
      try {
        const payload = {
          data: basePayload.data,
          fcmToken: sub.token
        };
        const resp = await fetch("https://whxkhrtlccxubvjgexmi.supabase.co/functions/v1/fcm-proxy", {
          method: "POST",
          headers: {
            // Retrieve keys securely from environment variables
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            Apikey: `${Deno.env.get('SUPABASE_ANON_KEY')}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        console.log("FCM proxy response:", await resp.text());
      } catch (err) {
        console.error("Error sending FCM notification:", err);
      }
    }
    return 'SUCCESS: Message processed successfully';
  } catch (error) {
    console.error('Error handling guest message:', error);
    return `ERROR: ${error.message || 'Unknown error occurred'}`;
  }
}
