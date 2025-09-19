import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface LodgifyBookingChangeEvent {
  action: 'booking_change'
  booking: {
    id: number
    date_arrival: string
    date_departure: string
    date_created: string
    property_id: number
    property_name: string
    status: string
    source: string
    nights: number
  }
  guest: {
    uid: string
    name: string
    email: string
    phone_number: string
    country?: string
    country_code?: string
  }
  current_order: {
    id: number
    property_id: number
    status: string
    amount_gross: {
      amount: string
    }
  }
  subowner: {
    user_id: number
    first_name: string
    last_name: string
    email: string
    phone: string
  }
}

interface LodgifyMessageEvent {
  action: 'guest_message_received'
  thread_uid: string
  message_id: number
  inbox_uid: string
  guest_name: string
  subject?: string
  message: string
  creation_time: string
  has_attachments: boolean
  sub_owner_id: number
}

type LodgifyWebhookEvent = LodgifyBookingChangeEvent | LodgifyMessageEvent

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const lodgifyWebhookSecret = Deno.env.get('LODGIFY_WEBHOOK_SECRET')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to generate HMAC signature
async function generateHmacSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const hashArray = Array.from(new Uint8Array(signature))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `sha256=${hashHex}`
}

serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Verify webhook signature if secret is configured
    if (lodgifyWebhookSecret) {
      const signature = req.headers.get('x-lodgify-signature')
      if (!signature) {
        return new Response('Missing signature', { status: 401 })
      }
      
      // Verify HMAC signature
      const expectedSignature = await generateHmacSignature(body, lodgifyWebhookSecret)
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature')
        return new Response('Invalid signature', { status: 401 })
      }
    }

    const body = await req.text()
    const event: LodgifyWebhookEvent = JSON.parse(body)

    console.log('Lodgify webhook received:', event.action)

    let result: any = { success: false, error: 'Unknown action' }
    
    if (event.action === 'booking_change') {
      result = await handleBookingChange(event as LodgifyBookingChangeEvent)
    } else if (event.action === 'guest_message_received') {
      result = await handleGuestMessage(event as LodgifyMessageEvent)
    } else {
      console.log('Unknown webhook action:', event.action)
      return new Response(JSON.stringify({ 
        error: `Unknown webhook action: ${event.action}` 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (result.success) {
      return new Response(JSON.stringify({ 
        message: 'Webhook processed successfully',
        action: event.action,
        details: result
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ 
        error: result.error || 'Processing failed',
        action: event.action
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})

async function handleBookingChange(event: LodgifyBookingChangeEvent): Promise<{ success: boolean; conversation_id?: string; error?: string }> {
  const { booking, guest, subowner } = event

  console.log(`Processing booking ${booking.id} with status: ${booking.status}`)

  try {
    // Find the property in our database using Lodgify property_id
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, host_id')
      .eq('lodgify_property_id', booking.property_id)
      .single()

    if (propertyError || !property) {
      console.error('Property not found for Lodgify property_id:', booking.property_id)
      return { success: false, error: `Property not found for Lodgify property_id: ${booking.property_id}` }
    }

    // Check if conversation already exists for this booking
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('lodgify_booking_id', booking.id)
      .single()

    if (existingConversation) {
      console.log(`Conversation already exists for booking ${booking.id}`)
      return { success: true, conversation_id: existingConversation.id, error: 'Conversation already exists' }
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = guest.phone_number.replace(/[^+\d]/g, '')

    // Create new conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        property_id: property.id,
        property: [{
          id: property.id,
          name: property.name,
          host_id: property.host_id
        }],
        guest_name: guest.name,
        guest_phone: cleanPhone,
        check_in_date: booking.date_arrival.split('T')[0],
        check_out_date: booking.date_departure.split('T')[0],
        status: 'active',
        lodgify_booking_id: booking.id,
        lodgify_thread_uid: null, // Will be set when first message is received
        last_message_at: new Date().toISOString()
      })
      .select()
      .single()

    if (conversationError) {
      console.error('Error creating conversation:', conversationError)
      return { success: false, error: `Error creating conversation: ${conversationError.message}` }
    }

    console.log(`Created conversation ${conversation.id} for booking ${booking.id}`)

    // Create welcome message
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: `Nouvelle réservation confirmée pour ${booking.property_name} du ${booking.date_arrival.split('T')[0]} au ${booking.date_departure.split('T')[0]}. Invité: ${guest.name}`,
        type: 'text',
        direction: 'system',
        status: 'delivered'
      })

    if (messageError) {
      console.error('Error creating welcome message:', messageError)
      // Don't fail the whole process for message creation error
    }

    return { success: true, conversation_id: conversation.id }

  } catch (error) {
    console.error('Error handling booking change:', error)
    return { success: false, error: `Unexpected error: ${error.message}` }
  }
}

async function handleGuestMessage(event: LodgifyMessageEvent): Promise<{ success: boolean; message_id?: string; error?: string }> {
  try {
    // Find conversation by thread_uid
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, unread_count')
      .eq('lodgify_thread_uid', event.thread_uid)
      .single()

    if (conversationError || !conversation) {
      console.error('Conversation not found for thread_uid:', event.thread_uid)
      return { success: false, error: `Conversation not found for thread_uid: ${event.thread_uid}` }
    }

    // Check if message already exists
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('id')
      .eq('lodgify_message_id', event.message_id.toString())
      .single()

    if (existingMessage) {
      console.log(`Message ${event.message_id} already exists`)
      return { success: true, message_id: existingMessage.id, error: 'Message already exists' }
    }

    // Insert the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        content: event.message,
        type: 'text',
        direction: 'inbound',
        status: 'delivered',
        lodgify_message_id: event.message_id.toString()
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error inserting message:', messageError)
      return { success: false, error: `Error inserting message: ${messageError.message}` }
    }

    // Update conversation with new message info
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        last_message: event.message,
        last_message_at: new Date().toISOString(),
        unread_count: (conversation.unread_count || 0) + 1,
        lodgify_thread_uid: event.thread_uid // Set thread_uid if not already set
      })
      .eq('id', conversation.id)

    if (updateError) {
      console.error('Error updating conversation:', updateError)
      // Don't fail the whole process for conversation update error
    }

    console.log(`Added message ${event.message_id} to conversation ${conversation.id}`)
    return { success: true, message_id: message.id }

  } catch (error) {
    console.error('Error handling guest message:', error)
    return { success: false, error: `Unexpected error: ${error.message}` }
  }
}