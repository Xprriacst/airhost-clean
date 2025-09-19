-- Add property JSONB field to conversations table
-- This field will store property information in the format:
-- [{"id": "uuid", "name": "property name", "host_id": "uuid"}]

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS property JSONB;

-- Add comment to explain the field structure
COMMENT ON COLUMN public.conversations.property IS 'Property information in JSONB format: [{"id": "uuid", "name": "property name", "host_id": "uuid"}]';

-- Create index for better performance when querying by property data
CREATE INDEX IF NOT EXISTS idx_conversations_property_gin 
ON public.conversations USING gin(property);