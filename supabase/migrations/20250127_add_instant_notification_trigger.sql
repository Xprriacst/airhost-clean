-- Function to trigger instant notification processing via HTTP request
CREATE OR REPLACE FUNCTION public.trigger_instant_notification(notification_id UUID)
RETURNS void AS $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
    request_body TEXT;
    response TEXT;
BEGIN
    -- Get environment variables (these should be set in your Supabase project)
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.service_role_key', true);
    
    -- Skip if environment variables are not set
    IF supabase_url IS NULL OR service_role_key IS NULL THEN
        RAISE LOG 'Supabase URL or Service Role Key not configured for instant notifications';
        RETURN;
    END IF;

    -- Prepare request body
    request_body := json_build_object(
        'notification_id', notification_id,
        'instant', true
    )::text;

    -- Make HTTP request to notification processor (async, fire-and-forget)
    -- Note: This uses pg_net extension if available, otherwise logs for manual processing
    BEGIN
        -- Try to use pg_net for HTTP requests if available
        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/notification-processor',
            headers := json_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            )::jsonb,
            body := request_body::jsonb
        );
        
        RAISE LOG 'Instant notification triggered for notification_id: %', notification_id;
    EXCEPTION WHEN OTHERS THEN
        -- If pg_net is not available, just log the notification for manual processing
        RAISE LOG 'Could not trigger instant notification (pg_net not available). Notification ID: %', notification_id;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced trigger function that also triggers instant processing
CREATE OR REPLACE FUNCTION public.handle_new_inbound_message_with_instant_notification()
RETURNS TRIGGER AS $$
DECLARE
    conversation_record RECORD;
    notification_title TEXT;
    notification_body TEXT;
    notification_data JSONB;
    new_notification_id UUID;
BEGIN
    -- Only process inbound messages
    IF NEW.direction != 'inbound' THEN
        RETURN NEW;
    END IF;

    -- Get conversation details including host and property info
    SELECT 
        c.id,
        c.host_id,
        c.guest_name,
        c.guest_phone,
        p.name as property_name
    INTO conversation_record
    FROM public.conversations c
    LEFT JOIN public.properties p ON c.property_id = p.id
    WHERE c.id = NEW.conversation_id;

    -- Skip if conversation not found
    IF conversation_record IS NULL THEN
        RETURN NEW;
    END IF;

    -- Prepare notification content
    notification_title := COALESCE(conversation_record.guest_name, 'Guest') || ' - ' || COALESCE(conversation_record.property_name, 'Property');
    notification_body := CASE 
        WHEN LENGTH(NEW.content) > 100 THEN LEFT(NEW.content, 97) || '...'
        ELSE NEW.content
    END;

    -- Prepare notification data
    notification_data := jsonb_build_object(
        'conversationId', NEW.conversation_id,
        'messageId', NEW.id,
        'guestName', conversation_record.guest_name,
        'guestPhone', conversation_record.guest_phone,
        'propertyName', conversation_record.property_name,
        'url', '/chat?conversation=' || NEW.conversation_id,
        'timestamp', EXTRACT(EPOCH FROM NEW.created_at)
    );

    -- Insert notification into queue and get the ID
    INSERT INTO public.notification_queue (
        conversation_id,
        message_id,
        host_id,
        notification_type,
        title,
        body,
        data
    ) VALUES (
        NEW.conversation_id,
        NEW.id,
        conversation_record.host_id,
        'new_message',
        notification_title,
        notification_body,
        notification_data
    ) RETURNING id INTO new_notification_id;

    -- Trigger instant notification processing (async)
    PERFORM public.trigger_instant_notification(new_notification_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the existing trigger with the enhanced version
DROP TRIGGER IF EXISTS trigger_new_inbound_message ON public.messages;
CREATE TRIGGER trigger_new_inbound_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_inbound_message_with_instant_notification();

-- Create a function to manually process pending notifications (for testing)
CREATE OR REPLACE FUNCTION public.process_pending_notifications()
RETURNS TABLE(processed_count INTEGER, success_count INTEGER, failed_count INTEGER) AS $$
DECLARE
    supabase_url TEXT;
    service_role_key TEXT;
    response TEXT;
BEGIN
    -- Get environment variables
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.service_role_key', true);
    
    -- Skip if environment variables are not set
    IF supabase_url IS NULL OR service_role_key IS NULL THEN
        RAISE EXCEPTION 'Supabase URL or Service Role Key not configured';
    END IF;

    -- Call notification processor
    BEGIN
        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/notification-processor',
            headers := json_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            )::jsonb,
            body := '{}'::jsonb
        );
        
        -- Return success (actual counts would need to be retrieved from the response)
        RETURN QUERY SELECT 1, 1, 0;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to call notification processor: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;