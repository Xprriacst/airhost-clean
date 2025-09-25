import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const lodgifyBaseUrl = 'https://api.lodgify.com';
const supabase = createClient(supabaseUrl, supabaseServiceKey);
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    const { conversation_id, message } = await req.json();
    if (!conversation_id || !message) {
      return new Response('Missing required fields', {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    // Get conversation details with host_id
    const { data: conversation, error: conversationError } = await supabase.from('conversations').select(`
        id,
        host_id,
        lodgify_booking_id,
        lodgify_thread_uid,
        guest_name,
        guest_phone
      `).eq('id', conversation_id).single();
    if (conversationError || !conversation) {
      console.error('Conversation query error:', conversationError);
      return new Response(JSON.stringify({
        error: 'Conversation not found',
        details: conversationError?.message
      }), {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    if (!conversation.lodgify_booking_id) {
      return new Response(JSON.stringify({
        error: 'Conversation not linked to Lodgify booking'
      }), {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    // Get Lodgify API key for the specific host
    const { data: configData, error: configError } = await supabase.from('lodgify_config').select('api_key').eq('host_id', conversation.host_id).single();
    if (configError || !configData?.api_key) {
      console.error('Lodgify config error:', configError);
      return new Response(JSON.stringify({
        error: 'Lodgify API key not configured for this host',
        details: configError?.message
      }), {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    const lodgifyApiKey = configData.api_key;
    // Prepare Lodgify API payload for booking message
    const lodgifyPayload = [
      {
        subject: `Message from ${conversation.guest_name || 'Host'}`,
        message: message,
        type: 'Owner' // Required field for booking messages
      }
    ];
    // Send message to Lodgify using the correct booking endpoint
    const bookingId = conversation.lodgify_booking_id;
    const sanitizedBookingId = bookingId?.startsWith("B") ? bookingId.slice(1) : bookingId;
    const lodgifyResponse = await fetch(`${lodgifyBaseUrl}/v1/reservation/booking/${sanitizedBookingId}/messages`, {
      method: 'POST',
      headers: {
        'X-ApiKey': lodgifyApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(lodgifyPayload)
    });
    if (!lodgifyResponse.ok) {
      const errorText = await lodgifyResponse.text();
      console.error('Lodgify API error:', errorText);
      return new Response(JSON.stringify({
        error: 'Lodgify API error',
        details: errorText,
        status: lodgifyResponse.status
      }), {
        status: lodgifyResponse.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if response has content before parsing JSON
    let lodgifyResult = {
      message: 'Success - empty response'
    };
    const responseText = await lodgifyResponse.text();
    if (responseText && responseText.trim()) {
      try {
        lodgifyResult = JSON.parse(responseText);
        console.log('Message sent to Lodgify:', lodgifyResult);
      } catch (e) {
        console.log('Lodgify response is not JSON:', responseText);
        lodgifyResult = {
          message: 'Success',
          response: responseText
        };
      }
    } else {
      console.log('Lodgify returned empty response - message likely sent successfully');
    }
    // IF THE MESSAGE IS SENT, RETRIEVE THE BOOKING LAST MESSAGE BECUASE LODGIFY IS NOT REUTURN ANYTHING 
    const booking = await fetch(`${lodgifyBaseUrl}/v2/reservations/bookings/${sanitizedBookingId}`, {
      method: 'GET',
      headers: {
        'X-ApiKey': lodgifyApiKey,
        'Content-Type': 'application/json'
      }
    });
    if (!booking.ok) {
      const errorText = await booking.text();
      console.error('Booking API error:', errorText);
      return new Response(JSON.stringify({
        error: 'Failed to retrieve booking',
        details: errorText,
        status: booking.status
      }), {
        status: booking.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    const bookingData = await booking.json();
    if (!bookingData) {
      return new Response(JSON.stringify({
        error: 'Booking not found',
        details: 'No booking data returned'
      }), {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    // LIST BOOKING MESSAGES 
    const messages = await fetch(`${lodgifyBaseUrl}/v2/messaging/${bookingData?.thread_uid}`, {
      method: 'GET',
      headers: {
        'X-ApiKey': lodgifyApiKey,
        'Content-Type': 'application/json'
      }
    });
    const booking_messages = await messages.text();
    // now parse the valid JSON part
    const messagesData = JSON.parse(booking_messages);
    console.log("messagesData", messagesData);
    console.log("message_id", messagesData?.messages?.[0]?.id);
    if (!messagesData) {
      return new Response(JSON.stringify({
        error: 'Messages not found',
        details: 'Messages not found'
      }), {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
    // Check if message already exists to prevent duplicates
    const { data: existingMessage } = await supabase.from('messages').select('id').eq('conversation_id', conversation_id).eq('content', message).eq('direction', 'outbound').order('created_at', {
      ascending: false
    }).limit(1).single();
    let savedMessage = existingMessage;
    let messageError = null;
    if (!existingMessage) {
      // Save message to our database only if it doesn't exist
      const { data: newMessage, error: insertError } = await supabase.from('messages').insert({
        conversation_id: conversation_id,
        content: message,
        direction: 'outbound',
        status: 'delivered',
        lodgify_message_id: messagesData?.messages?.[0]?.id
      }).select().single();
      savedMessage = newMessage;
      messageError = insertError;
    } else {
      console.log('Message already exists, skipping duplicate save:', existingMessage.id);
    }
    if (messageError) {
      console.error('Error saving message to database:', messageError);
    // Don't fail the request since message was sent to Lodgify successfully
    }
    // Update conversation last message
    await supabase.from('conversations').update({
      last_message: message,
      last_message_at: new Date().toISOString()
    }).eq('id', conversation_id);
    return new Response(JSON.stringify({
      success: true,
      message_id: savedMessage?.id,
      lodgify_message_id: messagesData?.messages?.[0]?.id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Error sending message to Lodgify:', error);
    return new Response('Internal server error', {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });
  }
});
