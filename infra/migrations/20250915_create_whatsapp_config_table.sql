-- Migration: Create whatsapp_config table
-- Date: 2025-09-15
-- Description: Create whatsapp_config table with proper host_id foreign key

-- Create whatsapp_config table
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL,
    phone_number_id TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint to hosts table
ALTER TABLE public.whatsapp_config 
ADD CONSTRAINT fk_whatsapp_config_host_id 
FOREIGN KEY (host_id) REFERENCES public.hosts(id) 
ON DELETE CASCADE;

-- Create index on host_id for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_host_id ON public.whatsapp_config(host_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_updated_at ON public.whatsapp_config(updated_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies based on host_id
CREATE POLICY "Users can view their own whatsapp config" ON public.whatsapp_config
    FOR SELECT USING (host_id = auth.uid());

CREATE POLICY "Users can insert their own whatsapp config" ON public.whatsapp_config
    FOR INSERT WITH CHECK (host_id = auth.uid());

CREATE POLICY "Users can update their own whatsapp config" ON public.whatsapp_config
    FOR UPDATE USING (host_id = auth.uid());

CREATE POLICY "Users can delete their own whatsapp config" ON public.whatsapp_config
    FOR DELETE USING (host_id = auth.uid());

-- Add comments
COMMENT ON TABLE public.whatsapp_config IS 'Configuration settings for WhatsApp Business API integration';
COMMENT ON COLUMN public.whatsapp_config.host_id IS 'Foreign key reference to hosts table';
COMMENT ON COLUMN public.whatsapp_config.phone_number_id IS 'WhatsApp Business phone number ID';
COMMENT ON COLUMN public.whatsapp_config.token IS 'WhatsApp Business API access token';
