-- Migration: Remove hosts table and use auth.users.id directly for host_id
-- Date: 2025-01-27
-- Description: Migrate from separate hosts table to using auth.users.id directly as host_id
-- This aligns with client's existing database structure

BEGIN;

-- Step 1: Create a temporary mapping table to preserve host data
CREATE TEMP TABLE host_mapping AS
SELECT 
    h.id as old_host_id,
    h.email,
    au.id as new_host_id,
    h.phone_number_id,
    h.whatsapp_access_token,
    h.created_at,
    h.updated_at
FROM public.hosts h
JOIN auth.users au ON h.email = au.email;

-- Step 2: Update properties table to use auth.users.id
-- First, add a temporary column
ALTER TABLE public.properties ADD COLUMN new_host_id UUID;

-- Update with auth.users.id
UPDATE public.properties p
SET new_host_id = hm.new_host_id
FROM host_mapping hm
WHERE p.host_id = hm.old_host_id;

-- Drop old foreign key constraint
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_host_id_fkey;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS fk_properties_host_id;

-- Drop old column and rename new one
ALTER TABLE public.properties DROP COLUMN host_id;
ALTER TABLE public.properties RENAME COLUMN new_host_id TO host_id;

-- Make host_id NOT NULL and add foreign key to auth.users
ALTER TABLE public.properties ALTER COLUMN host_id SET NOT NULL;
ALTER TABLE public.properties ADD CONSTRAINT fk_properties_host_id 
    FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Update conversations table to use auth.users.id
-- Add temporary column if it doesn't exist
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS new_host_id UUID;

-- Update conversations through properties relationship
UPDATE public.conversations c
SET new_host_id = p.host_id
FROM public.properties p
WHERE c.property_id = p.id
AND c.new_host_id IS NULL;

-- Drop old foreign key constraint if exists
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS fk_conversations_host_id;

-- Drop old host_id column if it exists and rename new one
ALTER TABLE public.conversations DROP COLUMN IF EXISTS host_id;
ALTER TABLE public.conversations RENAME COLUMN new_host_id TO host_id;

-- Add foreign key to auth.users
ALTER TABLE public.conversations ADD CONSTRAINT fk_conversations_host_id 
    FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Update lodgify_config table
-- Add temporary column
ALTER TABLE public.lodgify_config ADD COLUMN IF NOT EXISTS new_host_id UUID;

-- Update with auth.users.id
UPDATE public.lodgify_config lc
SET new_host_id = hm.new_host_id
FROM host_mapping hm
WHERE lc.host_id = hm.old_host_id;

-- Drop old foreign key constraint
ALTER TABLE public.lodgify_config DROP CONSTRAINT IF EXISTS fk_lodgify_config_host_id;
ALTER TABLE public.lodgify_config DROP CONSTRAINT IF EXISTS unique_lodgify_config_host_id;

-- Drop old column and rename new one
ALTER TABLE public.lodgify_config DROP COLUMN IF EXISTS host_id;
ALTER TABLE public.lodgify_config RENAME COLUMN new_host_id TO host_id;

-- Add foreign key to auth.users and unique constraint
ALTER TABLE public.lodgify_config ADD CONSTRAINT fk_lodgify_config_host_id 
    FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.lodgify_config ADD CONSTRAINT unique_lodgify_config_host_id 
    UNIQUE (host_id);

-- Step 5: Update whatsapp_config table
-- Add temporary column
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS new_host_id UUID;

-- Update with auth.users.id
UPDATE public.whatsapp_config wc
SET new_host_id = hm.new_host_id
FROM host_mapping hm
WHERE wc.host_id = hm.old_host_id;

-- Drop old foreign key constraint
ALTER TABLE public.whatsapp_config DROP CONSTRAINT IF EXISTS fk_whatsapp_config_host_id;

-- Drop old column and rename new one
ALTER TABLE public.whatsapp_config DROP COLUMN IF EXISTS host_id;
ALTER TABLE public.whatsapp_config RENAME COLUMN new_host_id TO host_id;

-- Make host_id NOT NULL and add foreign key to auth.users
ALTER TABLE public.whatsapp_config ALTER COLUMN host_id SET NOT NULL;
ALTER TABLE public.whatsapp_config ADD CONSTRAINT fk_whatsapp_config_host_id 
    FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 6: Update messaging_config table
-- Add temporary column
ALTER TABLE public.messaging_config ADD COLUMN IF NOT EXISTS new_host_id UUID;

-- Update with auth.users.id
UPDATE public.messaging_config mc
SET new_host_id = hm.new_host_id
FROM host_mapping hm
WHERE mc.host_id = hm.old_host_id;

-- Drop old foreign key constraint
ALTER TABLE public.messaging_config DROP CONSTRAINT IF EXISTS fk_messaging_config_host_id;
ALTER TABLE public.messaging_config DROP CONSTRAINT IF EXISTS unique_messaging_config_per_host;

-- Drop old column and rename new one
ALTER TABLE public.messaging_config DROP COLUMN IF EXISTS host_id;
ALTER TABLE public.messaging_config RENAME COLUMN new_host_id TO host_id;

-- Make host_id NOT NULL and add foreign key to auth.users
ALTER TABLE public.messaging_config ALTER COLUMN host_id SET NOT NULL;
ALTER TABLE public.messaging_config ADD CONSTRAINT fk_messaging_config_host_id 
    FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messaging_config ADD CONSTRAINT unique_messaging_config_per_host 
    UNIQUE (host_id);

-- Step 7: Update all RLS policies to use auth.uid() directly

-- Update properties RLS policies
DROP POLICY IF EXISTS "Properties belong to hosts" ON public.properties;
CREATE POLICY "Properties belong to hosts" ON public.properties
    FOR ALL USING (host_id = auth.uid());

-- Update conversations RLS policies
DROP POLICY IF EXISTS "Conversations belong to hosts" ON public.conversations;
CREATE POLICY "Conversations belong to hosts" ON public.conversations
    FOR ALL USING (
        host_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = conversations.property_id 
            AND p.host_id = auth.uid()
        )
    );

-- Update messages RLS policies
DROP POLICY IF EXISTS "Messages belong to hosts" ON public.messages;
DROP POLICY IF EXISTS "Les hôtes peuvent voir les messages de leurs conversations" ON public.messages;
CREATE POLICY "Messages belong to hosts" ON public.messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM public.conversations 
            WHERE host_id = auth.uid()
        )
    );

-- Update lodgify_config RLS policies
DROP POLICY IF EXISTS "Users can view their own lodgify config" ON public.lodgify_config;
DROP POLICY IF EXISTS "Users can insert their own lodgify config" ON public.lodgify_config;
DROP POLICY IF EXISTS "Users can update their own lodgify config" ON public.lodgify_config;
DROP POLICY IF EXISTS "Users can delete their own lodgify config" ON public.lodgify_config;

CREATE POLICY "Users can view their own lodgify config" ON public.lodgify_config
    FOR SELECT USING (host_id = auth.uid());
CREATE POLICY "Users can insert their own lodgify config" ON public.lodgify_config
    FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "Users can update their own lodgify config" ON public.lodgify_config
    FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "Users can delete their own lodgify config" ON public.lodgify_config
    FOR DELETE USING (host_id = auth.uid());

-- Update whatsapp_config RLS policies
DROP POLICY IF EXISTS "Users can view their own whatsapp config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Users can insert their own whatsapp config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Users can update their own whatsapp config" ON public.whatsapp_config;
DROP POLICY IF EXISTS "Users can delete their own whatsapp config" ON public.whatsapp_config;

CREATE POLICY "Users can view their own whatsapp config" ON public.whatsapp_config
    FOR SELECT USING (host_id = auth.uid());
CREATE POLICY "Users can insert their own whatsapp config" ON public.whatsapp_config
    FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "Users can update their own whatsapp config" ON public.whatsapp_config
    FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "Users can delete their own whatsapp config" ON public.whatsapp_config
    FOR DELETE USING (host_id = auth.uid());

-- Update messaging_config RLS policies
DROP POLICY IF EXISTS "Users can view their own messaging config" ON public.messaging_config;
DROP POLICY IF EXISTS "Users can insert their own messaging config" ON public.messaging_config;
DROP POLICY IF EXISTS "Users can update their own messaging config" ON public.messaging_config;
DROP POLICY IF EXISTS "Users can delete their own messaging config" ON public.messaging_config;

CREATE POLICY "Users can view their own messaging config" ON public.messaging_config
    FOR SELECT USING (host_id = auth.uid());
CREATE POLICY "Users can insert their own messaging config" ON public.messaging_config
    FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "Users can update their own messaging config" ON public.messaging_config
    FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "Users can delete their own messaging config" ON public.messaging_config
    FOR DELETE USING (host_id = auth.uid());

-- Step 8: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_properties_host_id ON public.properties(host_id);
CREATE INDEX IF NOT EXISTS idx_conversations_host_id ON public.conversations(host_id);
CREATE INDEX IF NOT EXISTS idx_lodgify_config_host_id ON public.lodgify_config(host_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_config_host_id ON public.whatsapp_config(host_id);
CREATE INDEX IF NOT EXISTS idx_messaging_config_host_id ON public.messaging_config(host_id);

-- Step 9: Store WhatsApp and phone data in auth.users metadata (optional)
-- This preserves the phone_number_id and whatsapp_access_token data
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
        'phone_number_id', hm.phone_number_id,
        'whatsapp_access_token', hm.whatsapp_access_token,
        'migrated_from_hosts_table', true
    )
FROM host_mapping hm
WHERE auth.users.id = hm.new_host_id
AND (hm.phone_number_id IS NOT NULL OR hm.whatsapp_access_token IS NOT NULL);

-- Step 10: Drop the hosts table
DROP TABLE IF EXISTS public.hosts CASCADE;

-- Step 11: Add comments for documentation
COMMENT ON COLUMN public.properties.host_id IS 'Foreign key reference to auth.users.id';
COMMENT ON COLUMN public.conversations.host_id IS 'Foreign key reference to auth.users.id';
COMMENT ON COLUMN public.lodgify_config.host_id IS 'Foreign key reference to auth.users.id';
COMMENT ON COLUMN public.whatsapp_config.host_id IS 'Foreign key reference to auth.users.id';
COMMENT ON COLUMN public.messaging_config.host_id IS 'Foreign key reference to auth.users.id';

COMMIT;

-- Verification queries (run these after migration)
-- SELECT 'Properties with valid host_id' as check_name, COUNT(*) as count FROM public.properties WHERE host_id IS NOT NULL;
-- SELECT 'Conversations with valid host_id' as check_name, COUNT(*) as count FROM public.conversations WHERE host_id IS NOT NULL;
-- SELECT 'Lodgify configs with valid host_id' as check_name, COUNT(*) as count FROM public.lodgify_config WHERE host_id IS NOT NULL;
-- SELECT 'WhatsApp configs with valid host_id' as check_name, COUNT(*) as count FROM public.whatsapp_config WHERE host_id IS NOT NULL;
-- SELECT 'Messaging configs with valid host_id' as check_name, COUNT(*) as count FROM public.messaging_config WHERE host_id IS NOT NULL;