-- Run this SQL in your Supabase SQL Editor to fix the schema cache error
ALTER TABLE match_slot ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- Verify if the column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'match_slot' AND column_name = 'pix_key';
