-- Migration: onboarding + calendar view preference
-- Run in Supabase SQL Editor → New query

-- Track whether setup has been completed (NULL = not done)
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Default calendar view preference per space
DO $$ BEGIN
  CREATE TYPE calendar_view AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS default_view calendar_view NOT NULL DEFAULT 'weekly';

-- Welcome message (if not already added from previous migration)
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- Invite tokens
CREATE TABLE IF NOT EXISTS invite_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID        NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  max_uses   SMALLINT,
  use_count  SMALLINT    NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token    ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_space_id ON invite_tokens(space_id);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_tokens: public read by token"
  ON invite_tokens FOR SELECT USING (TRUE);

CREATE POLICY "invite_tokens: admins can manage"
  ON invite_tokens FOR ALL USING (fn_is_space_admin(space_id));
