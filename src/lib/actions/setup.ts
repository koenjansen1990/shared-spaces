'use server';

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

// Step 1: save space name + description
export async function saveSpaceDetails(spaceId: string, name: string, description: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from('spaces')
    .update({ name: name.trim(), description: description.trim() || null })
    .eq('id', spaceId);

  return error ? { success: false as const, error: error.message } : { success: true as const };
}

const ALL_SLOT_TIMES = [
  { start: '00:00', end: '23:59', hours: 8 }, // Full day
  { start: '08:00', end: '13:00', hours: 4 }, // Morning
  { start: '13:00', end: '18:00', hours: 4 }, // Afternoon
];

// Step 2: save availability + view preference
export async function saveAvailability(
  spaceId:      string,
  spaceName:    string,
  days:         number[],
  hoursPerWeek: number,
  capacity:     number,
  credits:      number,
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient();

  // Save weekly credit allowance on the owner's membership + space_rules
  await service.from('space_members')
    .update({ weekly_credit_allowance: hoursPerWeek })
    .eq('space_id', spaceId)
    .eq('user_id', user.id);

  await service.from('space_rules')
    .upsert(
      { space_id: spaceId, rule_type: 'default_member_hours', rule_value: hoursPerWeek },
      { onConflict: 'space_id,rule_type' },
    );

  // Create or reuse the default resource
  const { data: existing } = await service
    .from('resources')
    .select('id')
    .eq('space_id', spaceId)
    .limit(1)
    .single();

  let resourceId: string;

  if (existing) {
    resourceId = existing.id;
    // With ON DELETE CASCADE on bookings.slot_id, deleting slots removes bookings automatically
    await service.from('slots').delete().eq('resource_id', resourceId);
  } else {
    const { data: newResource, error: resErr } = await service
      .from('resources')
      .insert({ space_id: spaceId, name: spaceName })
      .select('id')
      .single();
    if (resErr) return { success: false as const, error: resErr.message };
    resourceId = newResource.id;
  }

  // Build slots: full day + morning + afternoon for each selected day
  if (days.length > 0) {
    const slots = days.flatMap(day =>
      ALL_SLOT_TIMES.map(w => ({
        resource_id:    resourceId,
        space_id:       spaceId,
        slot_type:      'recurring' as const,
        recurrence_day: day,
        start_time:     w.start,
        end_time:       w.end,
        max_capacity:   capacity,
        credit_cost:    w.hours,
      }))
    );

    const { error: slotErr } = await service.from('slots').insert(slots);
    if (slotErr) return { success: false as const, error: slotErr.message };
  }

  return { success: true as const };
}

// Step 3: generate invite token + complete onboarding
export async function completeOnboarding(spaceId: string, welcomeMessage: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient();

  // Save welcome message + mark onboarding done
  await service.from('spaces').update({
    welcome_message:         welcomeMessage.trim() || null,
    onboarding_completed_at: new Date().toISOString(),
  }).eq('id', spaceId);

  // Create a default invite token (delete previous if exists)
  await service.from('invite_tokens').delete().eq('space_id', spaceId);
  const { data: token, error } = await service
    .from('invite_tokens')
    .insert({ space_id: spaceId, created_by: user.id })
    .select('token')
    .single();

  if (error) return { success: false as const, error: error.message };

  return { success: true as const, token: token.token };
}

// Step 0: save space type (weekly | monthly)
export async function saveSpaceType(spaceId: string, spaceType: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };
  const service = createSupabaseServiceClient();
  // Map new type names → DB enum values until migration is applied.
  const DB_SPACE_TYPE: Record<string, string> = { weekly: 'workplace', monthly: 'holiday_home' };
  const dbSpaceType = DB_SPACE_TYPE[spaceType] ?? spaceType;
  const { error } = await (service.from('spaces') as any).update({ space_type: dbSpaceType }).eq('id', spaceId);
  return error ? { success: false as const, error: error.message } : { success: true as const };
}

// Step 2 (monthly): save nights rules
export async function saveHolidayRules(
  spaceId: string,
  nightsPerYear: number,
  maxConsecutiveNights: number,
  advanceBookingDays: number,
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };
  const service = createSupabaseServiceClient();
  const rules = [
    { space_id: spaceId, rule_type: 'max_credits_per_week' as const, rule_value: nightsPerYear },
    { space_id: spaceId, rule_type: 'max_bookings_per_week' as const, rule_value: maxConsecutiveNights },
    { space_id: spaceId, rule_type: 'max_advance_days' as const, rule_value: advanceBookingDays },
  ];
  await service.from('space_rules').delete().eq('space_id', spaceId);
  const { error } = await service.from('space_rules').insert(rules);
  return error ? { success: false as const, error: error.message } : { success: true as const };
}
