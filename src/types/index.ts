// ============================================================
// Domain types – mirror the PostgreSQL schema 1:1.
//
// NOTE: Once you have a Supabase project, replace the Database
// type at the bottom with the output of:
//   pnpm supabase gen types typescript --project-id <id> > src/types/supabase.ts
// and re-export from here.
// ============================================================

export type MemberRole    = 'owner' | 'admin' | 'member';
export type PlanType      = 'free' | 'premium' | 'enterprise';
export type SlotType      = 'recurring' | 'event';
export type BookingStatus = 'confirmed' | 'cancelled' | 'waitlisted';
export type CalendarView  = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type SpaceType     = 'workplace' | 'holiday_home';
export type RuleKey =
  | 'max_credits_per_week'
  | 'max_bookings_per_week'
  | 'min_notice_hours'
  | 'max_advance_days'
  | 'default_member_hours';

// ── Row shapes ───────────────────────────────────────────────

export type Space = {
  id:                      string;
  name:                    string;
  slug:                    string;
  description:             string | null;
  welcome_message:         string | null;
  contact_email:           string | null;
  contact_phone:           string | null;
  address:                 string | null;
  hero_image_url:          string | null;
  space_type:              SpaceType | null;
  owner_id:                string;
  plan_type:               PlanType;
  default_view:            CalendarView;
  onboarding_completed_at: string | null;
  created_at:              string;
  updated_at:              string;
}

export type Subscription = {
  id:                      string;
  space_id:                string;
  plan_type:               PlanType;
  stripe_subscription_id:  string | null;
  stripe_customer_id:      string | null;
  current_period_start:    string | null;
  current_period_end:      string | null;
  cancel_at_period_end:    boolean;
  created_at:              string;
  updated_at:              string;
};

export type SpaceMember = {
  id:                      string;
  space_id:                string;
  user_id:                 string;
  role:                    MemberRole;
  weekly_credit_allowance: number;
  invited_by:              string | null;
  joined_at:               string;
};

export type Resource = {
  id:          string;
  space_id:    string;
  name:        string;
  description: string | null;
  is_active:   boolean;
  created_at:  string;
};

export type Slot = {
  id:             string;
  resource_id:    string;
  space_id:       string;
  slot_type:      SlotType;
  recurrence_day: number | null;
  event_date:     string | null;
  start_time:     string;
  end_time:       string;
  max_capacity:   number;
  credit_cost:    number;
  is_active:      boolean;
  created_at:     string;
};

export type Booking = {
  id:               string;
  slot_id:          string;
  space_id:         string;
  user_id:          string;
  booking_date:     string;
  credits_consumed: number;
  status:           BookingStatus;
  booked_at:        string;
  cancelled_at:     string | null;
  notes:            string | null;
};

export type InviteToken = {
  id:         string;
  space_id:   string;
  token:      string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  max_uses:   number | null;
  use_count:  number;
};

export type InviteTokenInsert = {
  space_id:   string;
  created_by: string;
  token?:     string;
  expires_at?: string | null;
  max_uses?:  number | null;
  use_count?: number;
};

export type SpaceRule = {
  id:         string;
  space_id:   string;
  rule_type:  RuleKey;
  rule_value: number;
  created_at: string;
  updated_at: string;
};

// ── Insert shapes (omit server-generated fields) ─────────────

// Required fields are those that have no DB default and are NOT NULL.
// Optional fields mirror what PostgreSQL allows to be omitted on INSERT.
export type SpaceInsert = {
  name:         string;
  slug:         string;
  owner_id:     string;
  description?: string | null;
  plan_type?:   PlanType;
  space_type?:  SpaceType;
};

export type SpaceUpdate = {
  name?:                    string;
  slug?:                    string;
  description?:             string | null;
  welcome_message?:         string | null;
  contact_email?:           string | null;
  contact_phone?:           string | null;
  address?:                 string | null;
  plan_type?:               PlanType;
  default_view?:            CalendarView;
  onboarding_completed_at?: string | null;
  space_type?:              SpaceType;
};

export type SubscriptionInsert = {
  space_id:               string;
  plan_type?:             PlanType;  // DB default: 'free'
  stripe_subscription_id?: string | null;
  stripe_customer_id?:     string | null;
  current_period_start?:   string | null;
  current_period_end?:     string | null;
  cancel_at_period_end?:   boolean;  // DB default: false
};

export type SpaceMemberInsert = {
  space_id:                string;
  user_id:                 string;
  role?:                   MemberRole;  // DB default: 'member'
  weekly_credit_allowance?: number;     // DB default: 8
  invited_by?:             string | null;
};

export type ResourceInsert = {
  space_id:     string;
  name:         string;
  description?: string | null;
  is_active?:   boolean;  // DB default: true
};

export type SlotInsert = {
  resource_id:    string;
  space_id:       string;
  slot_type:      SlotType;
  start_time:     string;
  end_time:       string;
  recurrence_day?: number | null;
  event_date?:    string | null;
  max_capacity?:  number;   // DB default: 1
  credit_cost?:   number;   // DB default: 1
  is_active?:     boolean;  // DB default: true
};

export type BookingInsert = {
  slot_id:          string;
  space_id:         string;
  user_id:          string;
  booking_date:     string;
  credits_consumed?: number;          // DB default: 1
  status?:           BookingStatus;   // DB default: 'confirmed'
  cancelled_at?:     string | null;
  notes?:            string | null;
};

export type SpaceRuleInsert = {
  space_id:   string;
  rule_type:  RuleKey;
  rule_value: number;
};

// ── Composite / joined views ─────────────────────────────────

export type ResourceWithSlots = Resource & { slots: Slot[] };
export type SpaceWithMembers  = Space   & { space_members: SpaceMember[] };
export type BookingWithSlot   = Booking & { slot: Slot; resource: Resource };

// ── API result types ─────────────────────────────────────────

export type BookingErrorCode =
  | 'UNAUTHENTICATED'
  | 'SLOT_NOT_FOUND'
  | 'NOT_A_MEMBER'
  | 'ALREADY_BOOKED'
  | 'SLOT_FULL'
  | 'INSUFFICIENT_CREDITS'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export type SubscriptionErrorCode = 'SUBSCRIPTION_REQUIRED' | 'NOT_A_MEMBER';

export type BookingResult =
  | { success: true;  booking_id: string }
  | { success: false; error: BookingErrorCode; [key: string]: unknown };

export type FeatureAccessResult =
  | { allowed: true }
  | { allowed: false; error: SubscriptionErrorCode; reason?: string; limit?: number; current?: number };

// ── Mutation input types ─────────────────────────────────────

export type CreateSpaceInput = {
  name:             string;
  slug:             string;
  description?:     string;
  space_type?:      'workplace' | 'holiday_home';
  // Studio rules
  days?:            number[];
  hours_per_week?:  number;
  // Holiday home rules
  nights_per_year?:  number;
  max_consecutive?:  number;
  advance_days?:     number;
};

export type CreateResourceInput = {
  space_id:     string;
  name:         string;
  description?: string;
};

export type CreateSlotInput = {
  resource_id:    string;
  space_id:       string;
  slot_type:      SlotType;
  recurrence_day?: number;
  event_date?:    string;
  start_time:     string;
  end_time:       string;
  max_capacity:   number;
  credit_cost:    number;
};

export type CreateBookingInput = {
  slot_id:      string;
  booking_date: string;
};

export type UpdateSpaceRuleInput = {
  space_id:   string;
  rule_type:  RuleKey;
  rule_value: number;
};

export type SpaceFeature = 'add_resource' | 'invite_member';

export const FREE_PLAN_LIMITS = {
  resources: 1,
  members:   5,
} as const;

// ── Supabase Database generic ────────────────────────────────
// Must conform to Supabase's GenericSchema:
//   Tables: { Row, Insert, Update, Relationships }
//   Views, Functions, Enums, CompositeTypes
// IMPORTANT: Row types must be `type` aliases, not `interface` —
// TypeScript interfaces don't satisfy Record<string, unknown> constraints
// in strict generic checking, causing Schema to resolve as `never`.

export type Json =
  | string | number | boolean | null
  | { [key: string]: Json }
  | Json[];

export type Database = {
  public: {
    Tables: {
      spaces: {
        Row:           Space & { space_type: SpaceType };
        Insert:        SpaceInsert & { space_type?: SpaceType };
        Update:        SpaceUpdate & { space_type?: SpaceType };
        Relationships: [];
      };
      subscriptions: {
        Row:           Subscription;
        Insert:        SubscriptionInsert;
        Update:        Partial<SubscriptionInsert>;
        Relationships: [];
      };
      space_members: {
        Row:           SpaceMember;
        Insert:        SpaceMemberInsert;
        Update:        Partial<SpaceMemberInsert>;
        Relationships: [];
      };
      resources: {
        Row:           Resource;
        Insert:        ResourceInsert;
        Update:        Partial<ResourceInsert>;
        Relationships: [];
      };
      slots: {
        Row:           Slot;
        Insert:        SlotInsert;
        Update:        Partial<SlotInsert>;
        Relationships: [];
      };
      bookings: {
        Row:           Booking;
        Insert:        BookingInsert;
        Update:        Partial<BookingInsert>;
        Relationships: [];
      };
      space_rules: {
        Row:           SpaceRule;
        Insert:        SpaceRuleInsert;
        Update:        Partial<SpaceRuleInsert>;
        Relationships: [];
      };
      invite_tokens: {
        Row:           InviteToken;
        Insert:        InviteTokenInsert;
        Update:        Partial<InviteTokenInsert>;
        Relationships: [];
      };
      profiles: {
        Row:           { id: string; display_name: string | null; avatar_url: string | null; updated_at: string };
        Insert:        { id: string; display_name?: string | null; avatar_url?: string | null; updated_at?: string };
        Update:        { display_name?: string | null; avatar_url?: string | null; updated_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      rpc_create_booking: {
        Args:    { p_slot_id: string; p_booking_date: string };
        Returns: Json;
      };
      rpc_check_space_feature_access: {
        Args:    { p_space_id: string; p_feature: string };
        Returns: Json;
      };
      fn_is_space_member: {
        Args:    { p_space_id: string };
        Returns: boolean;
      };
      fn_is_space_admin: {
        Args:    { p_space_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      member_role:    MemberRole;
      plan_type:      PlanType;
      slot_type:      SlotType;
      booking_status: BookingStatus;
      rule_key:       RuleKey;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
