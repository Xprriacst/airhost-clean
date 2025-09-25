-- Create notification queue table for reliable push notification delivery
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'new_message' CHECK (type IN ('new_message', 'emergency', 'booking_update')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON public.notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_at ON public.notification_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient_id ON public.notification_queue(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_conversation_id ON public.notification_queue(conversation_id);

-- Enable RLS
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Hosts can only see their own notifications
CREATE POLICY "Hosts can view their own notifications" ON public.notification_queue
    FOR SELECT TO authenticated
    USING (recipient_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notification_queue
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "System can update notifications" ON public.notification_queue
    FOR UPDATE TO authenticated
    USING (true);

-- Function to handle new inbound messages and queue notifications
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

    -- Insert notification into queue
    INSERT INTO public.notification_queue (
        conversation_id,
        message_id,
        recipient_id,
        type,
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
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on messages table for inbound messages
DROP TRIGGER IF EXISTS trigger_new_inbound_message ON public.messages;
CREATE TRIGGER trigger_new_inbound_message
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_inbound_message();

-- Function to update notification queue updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_notification_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at on notification_queue
CREATE TRIGGER handle_notification_queue_updated_at
    BEFORE UPDATE ON public.notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_notification_queue_updated_at();