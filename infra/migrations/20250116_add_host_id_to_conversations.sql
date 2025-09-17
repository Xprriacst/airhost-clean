-- Migration: Add host_id column to conversations table
-- Date: 2025-01-16
-- Description: Add host_id column to conversations table for direct host relationship

BEGIN;

-- Add host_id column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS host_id UUID;

-- Add foreign key constraint to hosts table
ALTER TABLE public.conversations 
ADD CONSTRAINT fk_conversations_host_id 
FOREIGN KEY (host_id) REFERENCES public.hosts(id) 
ON DELETE CASCADE;

-- Create index on host_id for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_host_id ON public.conversations(host_id);

-- Populate host_id from existing property relationships
UPDATE public.conversations 
SET host_id = p.host_id
FROM public.properties p
WHERE conversations.property_id = p.id
AND conversations.host_id IS NULL;

-- Update RLS policies to include host_id access
DROP POLICY IF EXISTS "Conversations belong to hosts" ON public.conversations;

CREATE POLICY "Conversations belong to hosts" ON public.conversations
FOR ALL USING (
  host_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM properties p 
    WHERE p.id = conversations.property_id 
    AND p.host_id = auth.uid()
  )
);

-- Add comment for documentation
COMMENT ON COLUMN public.conversations.host_id IS 'Direct reference to host for improved query performance';

COMMIT;