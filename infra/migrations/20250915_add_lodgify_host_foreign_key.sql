-- Migration: Add host_id foreign key to lodgify_config table
-- Date: 2025-09-15
-- Description: Add host_id column and foreign key constraint to lodgify_config table

-- Add host_id column to lodgify_config table
ALTER TABLE public.lodgify_config 
ADD COLUMN IF NOT EXISTS host_id UUID;

-- Add foreign key constraint to hosts table
ALTER TABLE public.lodgify_config 
ADD CONSTRAINT fk_lodgify_config_host_id 
FOREIGN KEY (host_id) REFERENCES public.hosts(id) 
ON DELETE CASCADE;

-- Add webhook tracking columns if they don't exist
ALTER TABLE public.lodgify_config 
ADD COLUMN IF NOT EXISTS booking_webhook_id TEXT,
ADD COLUMN IF NOT EXISTS message_webhook_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_configured BOOLEAN DEFAULT FALSE;

-- Create index on host_id for better performance
CREATE INDEX IF NOT EXISTS idx_lodgify_config_host_id ON public.lodgify_config(host_id);

-- Update RLS policies to use host_id
DROP POLICY IF EXISTS "Users can view their own lodgify config" ON public.lodgify_config;
DROP POLICY IF EXISTS "Users can insert their own lodgify config" ON public.lodgify_config;
DROP POLICY IF EXISTS "Users can update their own lodgify config" ON public.lodgify_config;
DROP POLICY IF EXISTS "Users can delete their own lodgify config" ON public.lodgify_config;

-- Create new RLS policies based on host_id
CREATE POLICY "Users can view their own lodgify config" ON public.lodgify_config
    FOR SELECT USING (host_id = auth.uid());

CREATE POLICY "Users can insert their own lodgify config" ON public.lodgify_config
    FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "Users can update their own lodgify config" ON public.lodgify_config
    FOR UPDATE USING (host_id = auth.uid());

CREATE POLICY "Users can delete their own lodgify config" ON public.lodgify_config
    FOR DELETE USING (host_id = auth.uid());

-- Add comments
COMMENT ON COLUMN public.lodgify_config.host_id IS 'Foreign key reference to hosts table';
COMMENT ON COLUMN public.lodgify_config.booking_webhook_id IS 'Lodgify webhook ID for booking_change events';
COMMENT ON COLUMN public.lodgify_config.message_webhook_id IS 'Lodgify webhook ID for guest_message_received events';
COMMENT ON COLUMN public.lodgify_config.webhook_configured IS 'Whether webhooks have been successfully configured';
