-- Migration: Fix WhatsApp config RLS policies
-- Date: 2025-09-15
-- Description: Update WhatsApp config table to use host_id instead of admin-only access

-- Add host_id column to whatsapp_config table
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS host_id UUID;

-- Add foreign key constraint to hosts table
ALTER TABLE public.whatsapp_config 
ADD CONSTRAINT fk_whatsapp_config_host_id 
FOREIGN KEY (host_id) REFERENCES public.hosts(id) 
ON DELETE CASCADE;

-- Create index on host_id for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_host_id ON public.whatsapp_config(host_id);

-- Drop existing admin-only RLS policy
DROP POLICY IF EXISTS "Admins can manage WhatsApp config" ON public.whatsapp_config;

-- Create new RLS policies based on host_id
CREATE POLICY "Users can view their own whatsapp config" ON public.whatsapp_config
    FOR SELECT USING (host_id = auth.uid());

CREATE POLICY "Users can insert their own whatsapp config" ON public.whatsapp_config
    FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "Users can update their own whatsapp config" ON public.whatsapp_config
    FOR UPDATE USING (host_id = auth.uid());

CREATE POLICY "Users can delete their own whatsapp config" ON public.whatsapp_config
    FOR DELETE USING (host_id = auth.uid());

-- Add comments
COMMENT ON COLUMN public.whatsapp_config.host_id IS 'Foreign key reference to hosts table';
