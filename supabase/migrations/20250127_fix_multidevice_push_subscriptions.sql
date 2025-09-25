-- Migration: Fix push_subscriptions for multi-device support
-- Date: 2025-01-27
-- Description: Remove single device limitation and add proper device identification

BEGIN;

-- Step 1: Remove the problematic unique constraint that limits to one device per platform
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_platform_key;

-- Step 2: Add device identification columns
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_info JSONB DEFAULT '{}';
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 3: Create new unique constraint that allows multiple devices per user/platform
-- This ensures each device can have its own token while preventing duplicate tokens for the same device
ALTER TABLE push_subscriptions ADD CONSTRAINT unique_user_device_token 
    UNIQUE(user_id, device_id, platform);

-- Step 4: Create index for device-based lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_id ON push_subscriptions(device_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_active ON push_subscriptions(last_active);

-- Step 5: Update existing records to have device_id (for backward compatibility)
-- Generate device_id for existing records based on their creation time and user_id
UPDATE push_subscriptions 
SET device_id = 'legacy_' || SUBSTRING(MD5(user_id::text || created_at::text), 1, 16),
    device_name = 'Legacy Device',
    device_info = jsonb_build_object(
        'type', 'legacy',
        'migrated_at', NOW()::text,
        'user_agent', 'Unknown'
    )
WHERE device_id IS NULL;

-- Step 6: Make device_id NOT NULL after populating existing records
ALTER TABLE push_subscriptions ALTER COLUMN device_id SET NOT NULL;

-- Step 7: Drop the existing upsert_push_token function first
DROP FUNCTION IF EXISTS upsert_push_token(UUID, TEXT, TEXT);

-- Update the upsert function to handle device-specific tokens
CREATE OR REPLACE FUNCTION upsert_push_token(
    p_user_id UUID,
    p_token TEXT,
    p_platform TEXT DEFAULT 'fcm',
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_device_id TEXT;
    v_subscription_id UUID;
BEGIN
    -- Generate device_id if not provided
    IF p_device_id IS NULL THEN
        v_device_id := 'auto_' || SUBSTRING(MD5(p_user_id::text || p_token || NOW()::text), 1, 16);
    ELSE
        v_device_id := p_device_id;
    END IF;
    
    -- Upsert the push subscription for this specific device
    INSERT INTO push_subscriptions (
        user_id, 
        token, 
        platform, 
        device_id, 
        device_name, 
        device_info,
        last_active
    )
    VALUES (
        p_user_id, 
        p_token, 
        p_platform, 
        v_device_id, 
        COALESCE(p_device_name, 'Unknown Device'), 
        p_device_info,
        NOW()
    )
    ON CONFLICT (user_id, device_id, platform) 
    DO UPDATE SET 
        token = EXCLUDED.token,
        device_name = COALESCE(EXCLUDED.device_name, push_subscriptions.device_name),
        device_info = push_subscriptions.device_info || EXCLUDED.device_info,
        last_active = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_subscription_id;
    
    RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create function to clean up inactive devices
CREATE OR REPLACE FUNCTION cleanup_inactive_devices(
    p_inactive_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete devices that haven't been active for the specified number of days
    DELETE FROM push_subscriptions 
    WHERE last_active < NOW() - (p_inactive_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    RAISE NOTICE 'Cleaned up % inactive devices older than % days', v_deleted_count, p_inactive_days;
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create function to get active devices for a user
CREATE OR REPLACE FUNCTION get_user_active_devices(
    p_user_id UUID,
    p_platform TEXT DEFAULT 'fcm'
)
RETURNS TABLE (
    id UUID,
    device_id TEXT,
    device_name TEXT,
    token TEXT,
    last_active TIMESTAMP WITH TIME ZONE,
    device_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.id,
        ps.device_id,
        ps.device_name,
        ps.token,
        ps.last_active,
        ps.device_info
    FROM push_subscriptions ps
    WHERE ps.user_id = p_user_id 
      AND ps.platform = p_platform
      AND ps.last_active > NOW() - INTERVAL '30 days'
    ORDER BY ps.last_active DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Grant permissions
GRANT EXECUTE ON FUNCTION upsert_push_token TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_inactive_devices TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_devices TO authenticated;

-- Step 11: Add comments for documentation
COMMENT ON COLUMN push_subscriptions.device_id IS 'Unique identifier for the device, allows multiple devices per user';
COMMENT ON COLUMN push_subscriptions.device_name IS 'Human-readable device name (e.g., "iPhone 12", "Chrome on Windows")';
COMMENT ON COLUMN push_subscriptions.device_info IS 'Additional device information (user agent, screen size, etc.)';
COMMENT ON COLUMN push_subscriptions.last_active IS 'Last time this device was active, used for cleanup';

COMMENT ON FUNCTION upsert_push_token IS 'Upserts push token for a specific device, enabling multi-device support';
COMMENT ON FUNCTION cleanup_inactive_devices IS 'Removes push subscriptions for devices inactive for specified days';
COMMENT ON FUNCTION get_user_active_devices IS 'Returns all active devices for a user within the last 30 days';

COMMIT;