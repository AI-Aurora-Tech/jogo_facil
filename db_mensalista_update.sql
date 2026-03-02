-- Update registered_team table for better mensalista management
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES field(id);
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS fixed_day INTEGER DEFAULT 0;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS fixed_time TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS fixed_duration_minutes INTEGER DEFAULT 60;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS captain_name TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS captain_phone TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS sport TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS court_name TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES "user"(id);
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS status_detail TEXT; -- For extra notes

-- Ensure status is tracked correctly. We'll use the existing status column but standardize values.
-- Values: 'pending', 'approved', 'rejected', 'cancelled', 'active', 'inactive'
-- Note: 'approved' and 'active' are often synonymous in this context, but 'active' implies the subscription is current.

-- Add a trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_registered_team_updated_at ON registered_team;
CREATE TRIGGER update_registered_team_updated_at
    BEFORE UPDATE ON registered_team
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Fix MatchSlot history visibility: ensure we have an index for faster history lookups
CREATE INDEX IF NOT EXISTS idx_match_slot_date_field ON match_slot(field_id, date);
CREATE INDEX IF NOT EXISTS idx_match_slot_field_id ON match_slot(field_id);
CREATE INDEX IF NOT EXISTS idx_match_slot_date ON match_slot(date);
CREATE INDEX IF NOT EXISTS idx_match_slot_field_date_time ON match_slot(field_id, date, time);
CREATE INDEX IF NOT EXISTS idx_match_slot_field_date_court ON match_slot(field_id, date, court_name);
CREATE INDEX IF NOT EXISTS idx_match_slot_status ON match_slot(status);
