-- Migration: Fix messaging_config table to add host_id foreign key
-- Date: 2025-01-16
-- Description: Add host_id foreign key to messaging_config table to make it user-specific

-- First, drop existing table if it exists (since it likely has no proper data)
DROP TABLE IF EXISTS public.messaging_config CASCADE;

-- Recreate messaging_config table with proper host_id foreign key
CREATE TABLE public.messaging_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    host_id UUID NOT NULL,
    preferred_channel TEXT NOT NULL CHECK (preferred_channel IN ('whatsapp', 'lodgify')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint to hosts table
ALTER TABLE public.messaging_config 
ADD CONSTRAINT fk_messaging_config_host_id 
FOREIGN KEY (host_id) REFERENCES public.hosts(id) 
ON DELETE CASCADE;

-- Add unique constraint to ensure one config per host
ALTER TABLE public.messaging_config 
ADD CONSTRAINT unique_messaging_config_per_host 
UNIQUE (host_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messaging_config_host_id ON public.messaging_config(host_id);
CREATE INDEX IF NOT EXISTS idx_messaging_config_updated_at ON public.messaging_config(updated_at DESC);

-- Enable RLS
ALTER TABLE public.messaging_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies based on host_id
CREATE POLICY "Users can view their own messaging config" ON public.messaging_config
    FOR SELECT USING (host_id = auth.uid());

CREATE POLICY "Users can insert their own messaging config" ON public.messaging_config
    FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "Users can update their own messaging config" ON public.messaging_config
    FOR UPDATE USING (host_id = auth.uid());

CREATE POLICY "Users can delete their own messaging config" ON public.messaging_config
    FOR DELETE USING (host_id = auth.uid());

-- Add comments
COMMENT ON TABLE public.messaging_config IS 'User-specific preferences for messaging channel selection';
COMMENT ON COLUMN public.messaging_config.host_id IS 'Foreign key reference to hosts table';
COMMENT ON COLUMN public.messaging_config.preferred_channel IS 'Preferred messaging channel: whatsapp or lodgify';