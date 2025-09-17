import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface WebhookSubscription {
  event: 'booking_change' | 'guest_message_received'
  target_url: string
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let response;
    
    if (req.method === 'POST') {
      response = await handleWebhookSetup(req)
    } else if (req.method === 'GET') {
      response = await handleWebhookStatus(req)
    } else if (req.method === 'DELETE') {
      response = await handleWebhookUnsubscribe(req)
    } else {
      response = new Response('Method not allowed', { status: 405 })
    }

    console.log("lodgify_response",response)

    // Add CORS headers to all responses
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response
  } catch (error) {
    console.error('Webhook manager error:', error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    })
  }
})

async function handleWebhookSetup(req: Request) {
  const { host_id, api_key } = await req.json()

  if (!host_id || !api_key) {
    return new Response('Missing host_id or api_key', { status: 400 })
  }

  try {
    // Store or update Lodgify configuration
    const { error: configError } = await supabase
      .from('lodgify_config')
      .upsert({
        host_id,
        api_key,
        webhook_configured: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'host_id'
      })

    if (configError) {
      console.error('Error saving config:', configError)
      return new Response('Error saving configuration', { status: 500 })
    }

    // Setup webhooks for both events with host_id query parameter
    const webhookResults = await Promise.all([
      setupWebhook(api_key, 'booking_change', `${supabaseUrl}/functions/v1/lodgify-webhook-booking?host_id=${host_id}`),
      setupWebhook(api_key, 'guest_message_received', `${supabaseUrl}/functions/v1/lodgify-webhook-message?host_id=${host_id}`)
    ])

    // console.log("webhookResults",webhookResults)

    const allSuccessful = webhookResults.every(result => result.success)

    // Update configuration status
    const { error: updateError } = await supabase
      .from('lodgify_config')
      .update({
        webhook_configured: allSuccessful,
        booking_webhook_id: webhookResults[0].webhook_id,
        message_webhook_id: webhookResults[1].webhook_id,
        booking_webhook_secret: webhookResults[0].webhook_secret,
        message_webhook_secret: webhookResults[1].webhook_secret,
        updated_at: new Date().toISOString()
      })
      .eq('host_id', host_id)

    if (updateError) {
      console.error('Error updating webhook configuration:', updateError)
      return new Response('Error updating webhook configuration', { status: 500 })
    }

    return new Response(JSON.stringify({
      success: allSuccessful,
      webhooks: webhookResults
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Webhook setup error:', error)
    return new Response('Webhook setup failed', { status: 500 })
  }
}

async function setupWebhook(apiKey: string, event: string, targetUrl: string) {

  // console.log("targetURL",targetUrl)
  try {
    const response = await fetch('https://api.lodgify.com/webhooks/v1/subscribe', {
      method: 'POST',
      headers: {
        'X-ApiKey': apiKey,
        'accept': 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        event,
        target_url: targetUrl
      })
    })

    const result = await response.json()

    // console.log("lodgify_webhook_result",result)

    if (response.ok) {
      console.log(`Webhook setup successful for ${event}:`, result)
      return {
        success: true,
        event,
        webhook_id: result.id,
        webhook_secret: result.secret,
        target_url: targetUrl
      }
    } else {
      console.error(`Webhook setup failed for ${event}:`, result)
      return {
        success: false,
        event,
        error: result.message || 'Unknown error'
      }
    }
  } catch (error) {
    console.error(`Webhook setup error for ${event}:`, error)
    return {
      success: false,
      event,
      error: error.message
    }
  }
}

async function handleWebhookStatus(req: Request) {
  const url = new URL(req.url)
  const hostId = url.searchParams.get('host_id')

  if (!hostId) {
    return new Response('Missing host_id parameter', { status: 400 })
  }

  const { data: config } = await supabase
    .from('lodgify_config')
    .select('*')
    .eq('host_id', hostId)
    .single()

  return new Response(JSON.stringify(config), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function handleWebhookUnsubscribe(req: Request) {
  const { host_id } = await req.json()

  if (!host_id) {
    return new Response('Missing host_id', { status: 400 })
  }

  const { data: config } = await supabase
    .from('lodgify_config')
    .select('*')
    .eq('host_id', host_id)
    .single()

  if (!config) {
    return new Response('Configuration not found', { status: 404 })
  }

  // Unsubscribe webhooks
  const unsubscribeResults = await Promise.all([
    config.booking_webhook_id ? unsubscribeWebhook(config.api_key, config.booking_webhook_id) : null,
    config.message_webhook_id ? unsubscribeWebhook(config.api_key, config.message_webhook_id) : null
  ].filter(Boolean))

  // Update configuration
  await supabase
    .from('lodgify_config')
    .update({
      webhook_configured: false,
      booking_webhook_id: null,
      message_webhook_id: null
    })
    .eq('host_id', host_id)

  return new Response(JSON.stringify({
    success: true,
    unsubscribed: unsubscribeResults
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function unsubscribeWebhook(apiKey: string, webhookId: string) {
  try {
    const response = await fetch(`https://api.lodgify.com/webhooks/v1/unsubscribe/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'X-ApiKey': apiKey,
        'accept': 'application/json'
      }
    })

    return {
      success: response.ok,
      webhook_id: webhookId
    }
  } catch (error) {
    return {
      success: false,
      webhook_id: webhookId,
      error: error.message
    }
  }
}
