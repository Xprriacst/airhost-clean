import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Notification scheduler triggered')

    // Call the notification processor
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notification-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error calling notification processor:', response.status, errorText)
      throw new Error(`Notification processor failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log('Notification processor result:', result)

    return new Response(
      JSON.stringify({
        message: 'Notification scheduler completed',
        processor_result: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notification scheduler:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})