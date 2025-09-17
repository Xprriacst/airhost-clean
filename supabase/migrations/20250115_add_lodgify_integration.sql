-- Add Lodgify integration columns to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS lodgify_property_id INTEGER UNIQUE;

-- Add Lodgify integration columns to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS lodgify_booking_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS lodgify_thread_uid TEXT;

-- Add Lodgify message ID to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS lodgify_message_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_lodgify_property_id 
ON public.properties(lodgify_property_id);

CREATE INDEX IF NOT EXISTS idx_conversations_lodgify_booking_id 
ON public.conversations(lodgify_booking_id);

CREATE INDEX IF NOT EXISTS idx_conversations_lodgify_thread_uid 
ON public.conversations(lodgify_thread_uid);

CREATE INDEX IF NOT EXISTS idx_messages_lodgify_message_id 
ON public.messages(lodgify_message_id);

-- Add comments for documentation
COMMENT ON COLUMN public.properties.lodgify_property_id IS 'Lodgify property ID for webhook integration';
COMMENT ON COLUMN public.conversations.lodgify_booking_id IS 'Lodgify booking ID that created this conversation';
COMMENT ON COLUMN public.conversations.lodgify_thread_uid IS 'Lodgify thread UID for message routing';
COMMENT ON COLUMN public.messages.lodgify_message_id IS 'Lodgify message ID to prevent duplicates';

-- Update RLS policies to include new columns
-- (Existing policies should automatically cover new columns)