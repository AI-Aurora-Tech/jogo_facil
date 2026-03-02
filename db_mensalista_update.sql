-- Update registered_team table for better mensalista management
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES "user"(id);
ALTER TABLE registered_team ADD COLUMN IF NOT EXISTS status_detail TEXT; -- For rejection reason or notes

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
