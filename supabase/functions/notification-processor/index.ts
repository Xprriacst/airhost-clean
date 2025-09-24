import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationQueueItem {
  id: string
  conversation_id: string
  message_id: string
  recipient_id: string
  type: string
  title: string
  body: string
  data: any
  status: string
  attempts: number
  max_attempts: number
}

interface PushSubscription {
  id: string
  user_id: string
  token: string
  platform: string
  device_id: string
  device_name: string | null
  device_model: string | null
  os_version: string | null
  app_version: string | null
  is_active: boolean
  last_used_at: string
  created_at: string
  updated_at: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Processing notification queue...')

    // Get pending notifications from queue
    const { data: pendingNotifications, error: queueError } = await supabaseClient
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .lt('attempts', 3) // Only process notifications that haven't exceeded max attempts
      .order('created_at', { ascending: true })
      .limit(50) // Process in batches

    if (queueError) {
      console.error('Error fetching notification queue:', queueError)
      throw queueError
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('No pending notifications to process')
      return new Response(
        JSON.stringify({ message: 'No pending notifications', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${pendingNotifications.length} pending notifications`)

    let processedCount = 0
    let successCount = 0
    let failedCount = 0

    // Process each notification
    for (const notification of pendingNotifications as NotificationQueueItem[]) {
      try {
        console.log(`Processing notification ${notification.id} for recipient ${notification.recipient_id}`)

        // Get active FCM tokens for the recipient
        const { data: pushSubscriptions, error: tokenError } = await supabaseClient
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', notification.recipient_id)
          .eq('is_active', true)

        if (tokenError) {
          console.error(`Error fetching push subscriptions for recipient ${notification.recipient_id}:`, tokenError)
          await markNotificationFailed(supabaseClient, notification.id, `Token fetch error: ${tokenError.message}`)
          failedCount++
          continue
        }

        if (!pushSubscriptions || pushSubscriptions.length === 0) {
          console.log(`No active push subscriptions found for recipient ${notification.recipient_id}`)
          await markNotificationFailed(supabaseClient, notification.id, 'No active push subscriptions')
          failedCount++
          continue
        }

        console.log(`Found ${pushSubscriptions.length} push subscriptions for recipient ${notification.recipient_id}`)


        
        // Send notification to each device
        let sentToAnyDevice = false
        for (const subscription of pushSubscriptions as PushSubscription[]) {
          try {
            const result = await sendFCMNotification(
              subscription.token,
              notification.title,
              notification.body,
              notification.data
            )

            if (result.success) {
              sentToAnyDevice = true
              console.log(`Successfully sent notification to device ${subscription.device_name || subscription.device_id} (${subscription.platform})`)
              
              // Update last_used_at for successful delivery
              await updateDeviceLastUsed(supabaseClient, subscription.id)
            } else {
              console.log(`Failed to send notification to device ${subscription.device_name || subscription.device_id} (${subscription.platform})`)
              
              // Handle invalid token - mark device as inactive
              if (result.error && (result.error.includes('invalid-registration-token') || result.error.includes('registration-token-not-registered'))) {
                console.log(`Invalid token detected for device ${subscription.device_name || subscription.device_id}, marking as inactive`)
                await markDeviceInactive(supabaseClient, subscription.id)
              }
            }
          } catch (deviceError) {
            console.error(`Error sending to device ${subscription.device_name || subscription.device_id} (${subscription.platform}):`, deviceError)
          }
        }

        // Update notification status
        if (sentToAnyDevice) {
          await markNotificationSent(supabaseClient, notification.id)
          successCount++
          console.log(`Notification ${notification.id} marked as sent`)
        } else {
          await markNotificationFailed(supabaseClient, notification.id, 'Failed to send to any device')
          failedCount++
          console.log(`Notification ${notification.id} marked as failed`)
        }

        processedCount++

      } catch (notificationError) {
        console.error(`Error processing notification ${notification.id}:`, notificationError)
        await markNotificationFailed(supabaseClient, notification.id, `Processing error: ${notificationError.message}`)
        failedCount++
      }
    }

    console.log(`Notification processing complete. Processed: ${processedCount}, Success: ${successCount}, Failed: ${failedCount}`)

    return new Response(
      JSON.stringify({
        message: 'Notification processing complete',
        processed: processedCount,
        success: successCount,
        failed: failedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notification processor:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Helper function to send FCM notification
async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  data: any
): Promise<{ success: boolean; error?: string }> {
  try {
   const fcmPayload =  {
    "fcmToken": fcmToken,
    "notification": {
        "title": title,
        "body": body,
        "icon": "/logo192.png"
    },
    "data": {
        "timestamp": String(data.timestamp || ''),
        "testId": String(data.messageId || '')
    }
}

    // const fcmPayload = {

    //   message: {
    //     token: fcmToken,
    //     notification: {
    //       title: title,
    //       body: body
    //     },
    //     data: {
    //       ...data,
    //       // Convert all data values to strings as required by FCM
    //       conversationId: String(data.conversationId || ''),
    //       messageId: String(data.messageId || ''),
    //       url: String(data.url || ''),
    //       timestamp: String(data.timestamp || '')
    //     },
    //     webpush: {
    //       headers: {
    //         'TTL': '86400' // 24 hours
    //       },
    //       notification: {
    //         title: title,
    //         body: body,
    //         icon: '/icons/icon-192x192.png',
    //         badge: '/icons/icon-192x192.png',
    //         tag: `message-${data.conversationId}`,
    //         requireInteraction: true,
    //         actions: [
    //           {
    //             action: 'reply',
    //             title: 'Reply'
    //           },
    //           {
    //             action: 'close',
    //             title: 'Close'
    //           }
    //         ],
    //         data: data
    //       }
    //     }
    //   }
    // }

    console.log('Sending FCM notification with payload:', JSON.stringify(fcmPayload, null, 2))

    // Call the existing fcm-proxy Edge Function
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/fcm-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify(fcmPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('FCM proxy error:', response.status, errorText)
      return { success: false, error: errorText }
    }

    const result = await response.json()
    console.log('FCM proxy response:', result)
    
    if (result.success === true) {
      return { success: true }
    } else {
      return { success: false, error: result.error || 'Unknown FCM error' }
    }

  } catch (error) {
    console.error('Error sending FCM notification:', error)
    return { success: false, error: error.message }
  }
}

// Helper function to mark notification as sent
async function markNotificationSent(supabaseClient: any, notificationId: string) {
  const { error } = await supabaseClient
    .from('notification_queue')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', notificationId)

  if (error) {
    console.error(`Error marking notification ${notificationId} as sent:`, error)
  }
}

// Helper function to mark notification as failed
async function markNotificationFailed(supabaseClient: any, notificationId: string, errorMessage: string) {
  // First get current attempts count
  const { data: currentNotification, error: fetchError } = await supabaseClient
    .from('notification_queue')
    .select('attempts')
    .eq('id', notificationId)
    .single()

  if (fetchError) {
    console.error(`Error fetching notification ${notificationId}:`, fetchError)
    return
  }

  // Increment attempts and update status
  const { error } = await supabaseClient
    .from('notification_queue')
    .update({
      status: 'failed',
      error_message: errorMessage,
      attempts: (currentNotification.attempts || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', notificationId)

  if (error) {
    console.error(`Error marking notification ${notificationId} as failed:`, error)
  }
}

// Helper function to update device last used timestamp
async function updateDeviceLastUsed(supabaseClient: any, subscriptionId: string) {
  try {
    const { error } = await supabaseClient
      .from('push_subscriptions')
      .update({ 
        last_used_at: new Date().toISOString(),
        is_active: true
      })
      .eq('id', subscriptionId)

    if (error) {
      console.error('Error updating device last used:', error)
    }
  } catch (error) {
    console.error('Error updating device timestamp:', error)
  }
}

// Helper function to mark device as inactive
async function markDeviceInactive(supabaseClient: any, subscriptionId: string) {
  try {
    const { error } = await supabaseClient
      .from('push_subscriptions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId)

    if (error) {
      console.error('Error marking device as inactive:', error)
    }
  } catch (error) {
    console.error('Error updating device status:', error)
  }
}