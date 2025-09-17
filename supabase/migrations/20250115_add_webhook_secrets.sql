-- Migration: Add webhook secret columns to lodgify_config table
-- Date: 2025-01-15
-- Description: Add webhook secret storage for HMAC signature verification

-- Add webhook secret columns to lodgify_config table
ALTER TABLE public.lodgify_config 
ADD COLUMN IF NOT EXISTS booking_webhook_secret TEXT,
ADD COLUMN IF NOT EXISTS message_webhook_secret TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.lodgify_config.booking_webhook_secret IS 'Secret for verifying booking_change webhook signatures';
COMMENT ON COLUMN public.lodgify_config.message_webhook_secret IS 'Secret for verifying guest_message_received webhook signatures';

-- Create index for better performance when looking up secrets
CREATE INDEX IF NOT EXISTS idx_lodgify_config_booking_webhook_secret ON public.lodgify_config(booking_webhook_secret) WHERE booking_webhook_secret IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lodgify_config_message_webhook_secret ON public.lodgify_config(message_webhook_secret) WHERE message_webhook_secret IS NOT NULL;


