-- DEFINITIVE FIX: Drop and recreate trigger function with correct column names
-- Based on actual database schema analysis

-- Step 1: Drop existing trigger and function completely
DROP TRIGGER IF EXISTS trigger_handle_new_inbound_message ON public.messages;
DROP FUNCTION IF EXISTS public.handle_new_inbound_message();

-- Step 2: Create the corrected function
CREATE OR REPLACE FUNCTION public.handle_new_inbound_message()
RETURNS TRIGGER AS $$
DECLARE
    conversation_record RECORD;
    notification_title TEXT;
    notification_body TEXT;
    notification_data JSONB;
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

    -- Insert notification into queue with CORRECT column names:
    -- recipient_id (not host_id), type (not notification_type), message (not body)
    INSERT INTO public.notification_queue (
        conversation_id,
        message_id,
        recipient_id,
        type,
        title,
        message,
        data
    ) VALUES (
        NEW.conversation_id,
        NEW.id,
        conversation_record.host_id,  -- This goes to recipient_id
        'new_message',                -- This goes to type
        notification_title,           -- This goes to title
        notification_body,            -- This goes to message (NOT body)
        notification_data             -- This goes to data
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate the trigger
CREATE TRIGGER trigger_handle_new_inbound_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_inbound_message();

-- Step 4: Verify the function was created
SELECT 'Trigger function recreated successfully' as status;