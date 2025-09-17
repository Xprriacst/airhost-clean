-- Migration: Add unique constraint on host_id to lodgify_config table
-- Date: 2025-01-16
-- Description: Prevent duplicate lodgify_config entries for the same host

-- First, remove any duplicate entries (keep the most recent one)
WITH duplicates AS (
  SELECT id, host_id,
    ROW_NUMBER() OVER (PARTITION BY host_id ORDER BY updated_at DESC) as rn
  FROM public.lodgify_config
  WHERE host_id IS NOT NULL
)
DELETE FROM public.lodgify_config
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on host_id
ALTER TABLE public.lodgify_config 
ADD CONSTRAINT unique_lodgify_config_host_id UNIQUE (host_id);

-- Add comment for documentation
COMMENT ON CONSTRAINT unique_lodgify_config_host_id ON public.lodgify_config 
IS 'Ensures each host can only have one lodgify configuration';