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
    const { data: config } = await supabase
      .from('lodgify_config')
      .select('booking_webhook_secret')
      .eq('host_id', hostId)
      .single();
    
    return config?.booking_webhook_secret || null;
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
    // console.log("body", body);
    const parsedBody = JSON.parse(body);
    
    // Handle both array and single object formats
    const events = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
    
    if (events.length === 0) {
      return new Response('No events to process', { status: 400 });
    }
    
    // Process the first event (Lodgify typically sends one event per webhook)
    const event = events[0];
    // console.log("event", event);
    // console.log('Lodgify booking webhook received for host:', hostId, 'booking:', event.booking.id);
    
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
    if (!clientApiKey) {
      console.error('Unable to identify client from host_id:', hostId);
      return new Response('Client identification required', {
        status: 400
      });
    }
    // console.log("clientApiKey", clientApiKey);
    const result = await handleBookingChange(event, clientApiKey, hostId);
    if (result.success) {
      return new Response(JSON.stringify({
        message: 'Booking processed successfully',
        conversation_id: result.conversation_id
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else {
      return new Response(JSON.stringify({
        error: result.error
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    console.error('Booking webhook processing error:', error);
    return new Response('Internal server error', {
      status: 500
    });
  }
});
async function extractClientFromHost(hostId) {
  try {
    const { data: config } = await supabase
      .from('lodgify_config')
      .select('api_key')
      .eq('host_id', hostId)
      .single();
    
    return config?.api_key || null;
  } catch (error) {
    console.error('Error fetching API key for host:', hostId, error);
    return null;
  }
}
async function handleBookingChange(event, clientApiKey, hostId) {
  const { booking, guest } = event;
  // console.log("booking", booking);
  // console.log("guest", guest);
  console.log(`Processing booking ${booking.id} with status: ${booking.status}`);
  try {
    // Check if conversation already exists
    const { data: existingConversation } = await supabase.from('conversations').select('id').eq('lodgify_booking_id', booking.id).single();
    if (existingConversation) {
      console.log(`Conversation already exists for booking ${booking.id}`);
      return {
        success: true,
        conversation_id: existingConversation.id,
        error: 'Conversation already exists'
      };
    }
    // Clean phone number
    const cleanPhone = guest?.phone_number?.replace(/[^+\d]/g, '');
    // Create new conversation with enhanced booking details
    // Use verified host_id instead of property_id since properties aren't stored
    const { data: conversation, error: conversationError } = await supabase.from('conversations').insert({
      host_id: hostId, // Use the verified host from webhook signature
      guest_name: guest?.name,
      guest_phone: cleanPhone,
      guest_email: guest?.email,
      check_in_date: booking?.date_arrival?.split('T')[0],
      check_out_date: booking?.date_departure?.split('T')[0],
      status: 'active',
      lodgify_booking_id: booking?.id,
      lodgify_thread_uid: null,
      lodgify_property_id: booking?.property_id, // Store Lodgify property ID for reference
      last_message_at: new Date().toISOString(),
      booking_source: booking?.source,
      booking_status: booking?.status,
      total_amount: parseFloat(event?.booking_total_amount || '0'),
      currency: event?.booking_currency_code || booking?.currency_code,
      nights: booking?.nights,
      guest_count: booking?.room_types?.reduce((total, room)=>total + room?.people, 0)
    }).select().single();
    if (conversationError) {
      console.error('Error creating conversation:', conversationError);
      return {
        success: false,
        error: `Error creating conversation: ${conversationError.message}`
      };
    }
    console.log(`Created conversation ${conversation.id} for booking ${booking.id}`);
    // Create welcome message
    const { error: messageError } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      content: `Nouvelle réservation confirmée pour ${booking?.property_name} du ${booking?.date_arrival?.split('T')?.[0]} au ${booking.date_departure.split('T')[0]}. Invité: ${guest?.name}`,
      type: 'text',
      direction: 'outbound', // Changed from 'system' to 'outbound' to match DB constraint
      status: 'delivered'
    });
    if (messageError) {
      console.error('Error creating welcome message:', messageError);
    // Don't fail the whole process for message creation error
    }
    return {
      success: true,
      conversation_id: conversation.id
    };
  } catch (error) {
    console.error('Error handling booking change:', error);
    return {
      success: false,
      error: `Unexpected error: ${error.message}`
    };
  }
}
