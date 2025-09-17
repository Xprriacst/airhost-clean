-- Migration: Add messaging configuration tables
-- Date: 2025-09-13
-- Description: Create tables for Lodgify configuration and messaging channel preferences

-- Create lodgify_config table
CREATE TABLE IF NOT EXISTS public.lodgify_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key TEXT NOT NULL,
    api_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messaging_config table
CREATE TABLE IF NOT EXISTS public.messaging_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    preferred_channel TEXT NOT NULL CHECK (preferred_channel IN ('whatsapp', 'lodgify')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for lodgify_config
ALTER TABLE public.lodgify_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lodgify config" ON public.lodgify_config
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own lodgify config" ON public.lodgify_config
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own lodgify config" ON public.lodgify_config
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own lodgify config" ON public.lodgify_config
    FOR DELETE USING (true);

-- Add RLS policies for messaging_config
ALTER TABLE public.messaging_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messaging config" ON public.messaging_config
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own messaging config" ON public.messaging_config
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own messaging config" ON public.messaging_config
    FOR UPDATE USING (true);

CREATE POLICY "Users can delete their own messaging config" ON public.messaging_config
    FOR DELETE USING (true);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lodgify_config_updated_at ON public.lodgify_config(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messaging_config_updated_at ON public.messaging_config(updated_at DESC);

-- Add comments
COMMENT ON TABLE public.lodgify_config IS 'Configuration settings for Lodgify API integration';
COMMENT ON TABLE public.messaging_config IS 'User preferences for messaging channel selection';
COMMENT ON COLUMN public.lodgify_config.api_key IS 'Lodgify API key for authentication';
COMMENT ON COLUMN public.lodgify_config.api_url IS 'Optional custom API URL for Lodgify';
COMMENT ON COLUMN public.messaging_config.preferred_channel IS 'Preferred messaging channel: whatsapp or lodgify';
