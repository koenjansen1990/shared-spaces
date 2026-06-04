-- ============================================================
-- Shared Spaces – PostgreSQL Schema + RLS
-- Multi-tenant isolation enforced at the database layer.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE member_role   AS ENUM ('owner', 'admin', 'member');
CREATE TYPE plan_type     AS ENUM ('free', 'premium', 'enterprise');
CREATE TYPE slot_type     AS ENUM ('recurring', 'event');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'waitlisted');
CREATE TYPE rule_key      AS ENUM (
  'max_credits_per_week',
  'max_bookings_per_week',
  'min_notice_hours',
  'max_advance_days'
);

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE spaces (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan_type   plan_type   NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

-- One subscription record per space; kept in sync by Stripe webhooks.
CREATE TABLE subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id               UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  plan_type              plan_type   NOT NULL DEFAULT 'free',
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (space_id)
);

CREATE TABLE space_members (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id                UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id                 UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                    member_role NOT NULL DEFAULT 'member',
  -- Per-member credit ceiling; the space-level rule can override downward.
  weekly_credit_allowance SMALLINT    NOT NULL DEFAULT 8 CHECK (weekly_credit_allowance >= 0),
  invited_by              UUID        REFERENCES auth.users(id),
  joined_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (space_id, user_id)
);

CREATE TABLE resources (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id    UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (space_id, name)
);

-- space_id is denormalised here (derivable via resource_id → resources.space_id)
-- but stored for two reasons: simpler RLS predicates and faster index scans.
CREATE TABLE slots (
  id              UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id     UUID       NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  space_id        UUID       NOT NULL REFERENCES spaces(id)    ON DELETE CASCADE,
  slot_type       slot_type  NOT NULL,

  -- Recurring slots: day-of-week (0=Sun … 6=Sat)
  recurrence_day  SMALLINT   CHECK (recurrence_day BETWEEN 0 AND 6),

  -- Event slots: specific calendar date
  event_date      DATE,

  -- Shared
  start_time      TIME       NOT NULL,
  end_time        TIME       NOT NULL,
  max_capacity    SMALLINT   NOT NULL DEFAULT 1 CHECK (max_capacity >= 1),
  credit_cost     SMALLINT   NOT NULL DEFAULT 1 CHECK (credit_cost >= 0),
  is_active       BOOLEAN    NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT valid_time_range        CHECK (end_time > start_time),
  CONSTRAINT recurring_requires_day  CHECK (slot_type != 'recurring' OR recurrence_day IS NOT NULL),
  CONSTRAINT event_requires_date     CHECK (slot_type != 'event'     OR event_date      IS NOT NULL)
);

CREATE TABLE bookings (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id          UUID           NOT NULL REFERENCES slots(id)      ON DELETE RESTRICT,
  space_id         UUID           NOT NULL REFERENCES spaces(id)     ON DELETE CASCADE,
  user_id          UUID           NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_date     DATE           NOT NULL,
  credits_consumed SMALLINT       NOT NULL DEFAULT 1 CHECK (credits_consumed >= 0),
  status           booking_status NOT NULL DEFAULT 'confirmed',
  booked_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  cancelled_at     TIMESTAMPTZ,
  notes            TEXT,

  -- One confirmed booking per user per slot occurrence.
  UNIQUE (slot_id, user_id, booking_date)
);

-- Generic rules engine: each space can override any rule type.
-- New rule types can be added to the enum without schema migrations
-- to business logic; the validation layer reads them by key.
CREATE TABLE space_rules (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   UUID        NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  rule_type  rule_key    NOT NULL,
  rule_value INTEGER     NOT NULL CHECK (rule_value >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (space_id, rule_type)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_spaces_owner              ON spaces(owner_id);
CREATE INDEX idx_spaces_slug               ON spaces(slug);
CREATE INDEX idx_space_members_user        ON space_members(user_id);
CREATE INDEX idx_space_members_space       ON space_members(space_id);
CREATE INDEX idx_resources_space           ON resources(space_id);
CREATE INDEX idx_slots_resource            ON slots(resource_id);
CREATE INDEX idx_slots_space               ON slots(space_id);
CREATE INDEX idx_slots_event_date          ON slots(event_date) WHERE slot_type = 'event';
CREATE INDEX idx_slots_recurring_day       ON slots(recurrence_day) WHERE slot_type = 'recurring';
CREATE INDEX idx_bookings_user             ON bookings(user_id);
CREATE INDEX idx_bookings_slot             ON bookings(slot_id);
CREATE INDEX idx_bookings_space            ON bookings(space_id);
CREATE INDEX idx_bookings_date             ON bookings(booking_date);
-- Composite used by the weekly-credit query in the booking RPC
CREATE INDEX idx_bookings_user_space_week  ON bookings(user_id, space_id, booking_date);
-- Only active, confirmed bookings are counted for capacity
CREATE INDEX idx_bookings_slot_date_status ON bookings(slot_id, booking_date, status)
  WHERE status = 'confirmed';

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_space_rules_updated_at
  BEFORE UPDATE ON space_rules
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER – bypass RLS for lookups
-- that must themselves be trusted, not caller-context-sensitive)
-- ============================================================

-- Returns TRUE if the calling user is a member of the given space.
CREATE OR REPLACE FUNCTION fn_is_space_member(p_space_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM space_members
    WHERE space_id = p_space_id AND user_id = auth.uid()
  );
$$;

-- Returns TRUE if the calling user is owner or admin.
CREATE OR REPLACE FUNCTION fn_is_space_admin(p_space_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM space_members
    WHERE space_id = p_space_id
      AND user_id  = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE spaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_rules    ENABLE ROW LEVEL SECURITY;

-- spaces ----------------------------------------------------
CREATE POLICY "spaces: members can read"
  ON spaces FOR SELECT
  USING (fn_is_space_member(id));

CREATE POLICY "spaces: authenticated users can create"
  ON spaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "spaces: admins can update"
  ON spaces FOR UPDATE
  USING     (fn_is_space_admin(id))
  WITH CHECK(fn_is_space_admin(id));

-- subscriptions ---------------------------------------------
CREATE POLICY "subscriptions: members can read"
  ON subscriptions FOR SELECT
  USING (fn_is_space_member(space_id));

CREATE POLICY "subscriptions: owners full access"
  ON subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM space_members
      WHERE space_id = subscriptions.space_id
        AND user_id  = auth.uid()
        AND role     = 'owner'
    )
  );

-- space_members ---------------------------------------------
CREATE POLICY "space_members: members can read roster"
  ON space_members FOR SELECT
  USING (fn_is_space_member(space_id));

CREATE POLICY "space_members: admins can invite"
  ON space_members FOR INSERT
  WITH CHECK (fn_is_space_admin(space_id));

CREATE POLICY "space_members: admins can update roles"
  ON space_members FOR UPDATE
  USING (fn_is_space_admin(space_id));

CREATE POLICY "space_members: admins or self can remove"
  ON space_members FOR DELETE
  USING (fn_is_space_admin(space_id) OR user_id = auth.uid());

-- resources -------------------------------------------------
CREATE POLICY "resources: members can read"
  ON resources FOR SELECT
  USING (fn_is_space_member(space_id));

CREATE POLICY "resources: admins can insert"
  ON resources FOR INSERT
  WITH CHECK (fn_is_space_admin(space_id));

CREATE POLICY "resources: admins can update"
  ON resources FOR UPDATE
  USING (fn_is_space_admin(space_id));

CREATE POLICY "resources: admins can delete"
  ON resources FOR DELETE
  USING (fn_is_space_admin(space_id));

-- slots -----------------------------------------------------
CREATE POLICY "slots: members can read"
  ON slots FOR SELECT
  USING (fn_is_space_member(space_id));

CREATE POLICY "slots: admins can insert"
  ON slots FOR INSERT
  WITH CHECK (fn_is_space_admin(space_id));

CREATE POLICY "slots: admins can update"
  ON slots FOR UPDATE
  USING (fn_is_space_admin(space_id));

CREATE POLICY "slots: admins can delete"
  ON slots FOR DELETE
  USING (fn_is_space_admin(space_id));

-- bookings --------------------------------------------------
CREATE POLICY "bookings: members can read space bookings"
  ON bookings FOR SELECT
  USING (fn_is_space_member(space_id));

CREATE POLICY "bookings: members can book for themselves"
  ON bookings FOR INSERT
  WITH CHECK (user_id = auth.uid() AND fn_is_space_member(space_id));

-- Allow status updates (cancellation) by owner or self.
CREATE POLICY "bookings: members can cancel own; admins can cancel any"
  ON bookings FOR UPDATE
  USING (user_id = auth.uid() OR fn_is_space_admin(space_id));

CREATE POLICY "bookings: admins can hard-delete"
  ON bookings FOR DELETE
  USING (fn_is_space_admin(space_id));

-- space_rules -----------------------------------------------
CREATE POLICY "space_rules: members can read"
  ON space_rules FOR SELECT
  USING (fn_is_space_member(space_id));

CREATE POLICY "space_rules: admins full access"
  ON space_rules FOR ALL
  USING (fn_is_space_admin(space_id));

-- ============================================================
-- BOOKING RPC  (atomic, SECURITY DEFINER bypasses RLS so
-- the function itself performs all authorization checks)
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_create_booking(
  p_slot_id      UUID,
  p_booking_date DATE
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id          UUID    := auth.uid();
  v_slot             slots%ROWTYPE;
  v_space_id         UUID;
  v_capacity_used    INTEGER;
  v_week_start       DATE;
  v_week_end         DATE;
  v_credits_used     INTEGER;
  v_credit_ceiling   INTEGER;
  v_member_allowance INTEGER;
  v_rule_value       INTEGER;
  v_booking_id       UUID;
BEGIN
  -- Auth guard
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'UNAUTHENTICATED');
  END IF;

  -- Fetch slot
  SELECT * INTO v_slot FROM slots WHERE id = p_slot_id AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'SLOT_NOT_FOUND');
  END IF;
  v_space_id := v_slot.space_id;

  -- Membership + credit allowance
  SELECT weekly_credit_allowance INTO v_member_allowance
  FROM space_members
  WHERE space_id = v_space_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'NOT_A_MEMBER');
  END IF;

  -- Duplicate booking guard
  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE slot_id = p_slot_id
      AND user_id = v_user_id
      AND booking_date = p_booking_date
      AND status = 'confirmed'
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'ALREADY_BOOKED');
  END IF;

  -- Capacity check
  SELECT COUNT(*) INTO v_capacity_used
  FROM bookings
  WHERE slot_id = p_slot_id
    AND booking_date = p_booking_date
    AND status = 'confirmed';

  IF v_capacity_used >= v_slot.max_capacity THEN
    RETURN json_build_object('success', FALSE, 'error', 'SLOT_FULL',
      'capacity', v_slot.max_capacity,
      'booked',   v_capacity_used);
  END IF;

  -- Weekly credit check
  -- ISO week: Monday = start of week.
  v_week_start := date_trunc('week', p_booking_date::TIMESTAMPTZ)::DATE;
  v_week_end   := v_week_start + 6;

  -- Space-level rule overrides member allowance when stricter.
  SELECT rule_value INTO v_rule_value
  FROM space_rules
  WHERE space_id = v_space_id AND rule_type = 'max_credits_per_week';

  v_credit_ceiling := COALESCE(
    LEAST(v_rule_value, v_member_allowance),
    v_member_allowance
  );

  SELECT COALESCE(SUM(credits_consumed), 0) INTO v_credits_used
  FROM bookings
  WHERE user_id      = v_user_id
    AND space_id     = v_space_id
    AND status       = 'confirmed'
    AND booking_date BETWEEN v_week_start AND v_week_end;

  IF (v_credits_used + v_slot.credit_cost) > v_credit_ceiling THEN
    RETURN json_build_object(
      'success',          FALSE,
      'error',            'INSUFFICIENT_CREDITS',
      'credits_used',     v_credits_used,
      'credits_ceiling',  v_credit_ceiling,
      'credits_required', v_slot.credit_cost
    );
  END IF;

  -- All guards passed – insert
  INSERT INTO bookings (slot_id, space_id, user_id, booking_date, credits_consumed, status)
  VALUES (p_slot_id, v_space_id, v_user_id, p_booking_date, v_slot.credit_cost, 'confirmed')
  RETURNING id INTO v_booking_id;

  RETURN json_build_object('success', TRUE, 'booking_id', v_booking_id);

EXCEPTION
  WHEN unique_violation THEN
    -- Race condition: another request beat us to the last seat or duplicate
    RETURN json_build_object('success', FALSE, 'error', 'CONFLICT');
  WHEN OTHERS THEN
    RETURN json_build_object('success', FALSE, 'error', 'INTERNAL_ERROR', 'detail', SQLERRM);
END;
$$;

-- ============================================================
-- SUBSCRIPTION PLAN LIMITS FUNCTION
-- Called by the application layer before resource/member mutations.
-- Returns a JSON object so the caller can pattern-match error codes.
-- ============================================================

CREATE OR REPLACE FUNCTION rpc_check_space_feature_access(
  p_space_id        UUID,
  p_feature         TEXT  -- e.g. 'add_resource', 'invite_member'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_plan          plan_type;
  v_resource_count INTEGER;
  v_member_count   INTEGER;
BEGIN
  -- Caller must be a member
  IF NOT fn_is_space_member(p_space_id) THEN
    RETURN json_build_object('allowed', FALSE, 'error', 'NOT_A_MEMBER');
  END IF;

  SELECT plan_type INTO v_plan FROM spaces WHERE id = p_space_id;

  -- Premium / Enterprise: no hard limits enforced here
  IF v_plan != 'free' THEN
    RETURN json_build_object('allowed', TRUE);
  END IF;

  -- Free plan limits
  IF p_feature = 'add_resource' THEN
    SELECT COUNT(*) INTO v_resource_count FROM resources
    WHERE space_id = p_space_id AND is_active = TRUE;

    IF v_resource_count >= 1 THEN
      RETURN json_build_object(
        'allowed',  FALSE,
        'error',    'SUBSCRIPTION_REQUIRED',
        'reason',   'Free plan is limited to 1 resource.',
        'limit',    1,
        'current',  v_resource_count
      );
    END IF;
  END IF;

  IF p_feature = 'invite_member' THEN
    SELECT COUNT(*) INTO v_member_count FROM space_members
    WHERE space_id = p_space_id;

    IF v_member_count >= 5 THEN
      RETURN json_build_object(
        'allowed',  FALSE,
        'error',    'SUBSCRIPTION_REQUIRED',
        'reason',   'Free plan is limited to 5 members.',
        'limit',    5,
        'current',  v_member_count
      );
    END IF;
  END IF;

  RETURN json_build_object('allowed', TRUE);
END;
$$;

-- ============================================================
-- SEED: example default rules for a new space
-- (call this after creating a space, or wire into a trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_seed_default_rules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO space_rules (space_id, rule_type, rule_value) VALUES
    (NEW.id, 'max_credits_per_week', 8),
    (NEW.id, 'min_notice_hours',     2),
    (NEW.id, 'max_advance_days',     30)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_spaces_seed_rules
  AFTER INSERT ON spaces
  FOR EACH ROW EXECUTE FUNCTION fn_seed_default_rules();
