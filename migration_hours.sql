-- Fix slot credit costs to hours (morning/afternoon = 4h, full day = 8h)
UPDATE slots SET credit_cost = 8 WHERE start_time = '00:00:00';
UPDATE slots SET credit_cost = 4 WHERE start_time = '08:00:00';
UPDATE slots SET credit_cost = 4 WHERE start_time = '13:00:00';

-- Default weekly allowance: 40 hours (can be overridden per member)
ALTER TABLE space_members
  ALTER COLUMN weekly_credit_allowance SET DEFAULT 40;

-- Update existing members to 40h default
UPDATE space_members SET weekly_credit_allowance = 40 WHERE weekly_credit_allowance = 8;

-- Update space_rules default to 40h  
UPDATE space_rules SET rule_value = 40 WHERE rule_type = 'max_credits_per_week';

-- Update default rule seeder
CREATE OR REPLACE FUNCTION fn_seed_default_rules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO space_rules (space_id, rule_type, rule_value) VALUES
    (NEW.id, 'max_credits_per_week', 40),
    (NEW.id, 'min_notice_hours',      2),
    (NEW.id, 'max_advance_days',      30)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
