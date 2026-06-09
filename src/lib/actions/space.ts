'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import type { CreateSpaceInput } from '@/types';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export type CreateSpaceResult =
  | { success: true }
  | { success: false; error: string; field?: 'name' | 'slug' };

export async function createSpace(
  input: CreateSpaceInput,
): Promise<CreateSpaceResult> {
  // ── Validation ───────────────────────────────────────────
  if (!input.name?.trim()) {
    return { success: false, error: 'Name is required.', field: 'name' };
  }
  if (!input.slug?.trim()) {
    return { success: false, error: 'URL slug is required.', field: 'slug' };
  }
  if (!SLUG_RE.test(input.slug)) {
    return {
      success: false,
      error: 'Slug must be 3–50 lowercase letters, numbers, or hyphens and cannot start or end with a hyphen.',
      field: 'slug',
    };
  }

  // ── Auth ─────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  // ── Uniqueness check ─────────────────────────────────────
  const { data: existing } = await supabase
    .from('spaces')
    .select('id')
    .eq('slug', input.slug)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: 'That URL is already taken. Try a different one.',
      field: 'slug',
    };
  }

  // ── Is this the user's first space? ──────────────────────
  const { count: ownedCount } = await (supabase.from('spaces') as any)
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id);
  const isFirstSpace = (ownedCount ?? 0) === 0;

  // ── Insert space + owner membership in one round-trip ────
  // Insert the space first, then add the membership.
  // Supabase doesn't support multi-table inserts in a single RPC call without
  // a custom function, so we use two sequential inserts. The space row
  // is created with owner_id = user.id which the RLS INSERT policy requires.
  // Use service-role client for both inserts: auth.uid() is not available
  // in the DB session during Server Actions (JWT isn't forwarded to postgres),
  // so the anon-key client fails the RLS policy even though getUser() works.
  const serviceClient = createSupabaseServiceClient();

  const { data: space, error: spaceError } = await (serviceClient
    .from('spaces') as any)
    .insert({
      name:        input.name.trim(),
      slug:        input.slug.trim(),
      description: input.description?.trim() || null,
      owner_id:    user.id,
      plan_type:   'free',
      space_type:  input.space_type ?? null,
    })
    .select('id, slug')
    .single();

  if (spaceError) {
    if (spaceError.code === '23505') {
      return { success: false, error: 'That URL is already taken.', field: 'slug' };
    }
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
  const { error: memberError } = await serviceClient.from('space_members').insert({
    space_id:                space.id,
    user_id:                 user.id,
    role:                    'owner',
    weekly_credit_allowance: 8,
  });

  if (memberError) {
    await serviceClient.from('spaces').delete().eq('id', space.id);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }

  // Save rules based on space type
  if (input.space_type === 'weekly') {
    const hoursPerWeek = input.hours_per_week ?? 40;
    const days         = input.days ?? [1, 2, 3, 4, 5];

    // Update owner's weekly allowance
    await serviceClient.from('space_members')
      .update({ weekly_credit_allowance: hoursPerWeek })
      .eq('space_id', space.id).eq('user_id', user.id);

    // Save default hours rule
    await serviceClient.from('space_rules').insert({
      space_id: space.id, rule_type: 'default_member_hours', rule_value: hoursPerWeek,
    });

    // Create slots for selected days
    if (days.length > 0) {
      const ALL_SLOT_TIMES = [
        { start: '00:00', end: '23:59', hours: 8 },
        { start: '08:00', end: '13:00', hours: 4 },
        { start: '13:00', end: '18:00', hours: 4 },
      ];
      const { data: resource } = await serviceClient.from('resources')
        .insert({ space_id: space.id, name: input.name.trim() })
        .select('id').single();
      if (resource) {
        await serviceClient.from('slots').insert(
          days.flatMap(day => ALL_SLOT_TIMES.map(w => ({
            resource_id: resource.id, space_id: space.id,
            slot_type: 'recurring' as const, recurrence_day: day,
            start_time: w.start, end_time: w.end,
            max_capacity: 10, credit_cost: w.hours,
          })))
        );
      }
    }
  } else if (input.space_type === 'monthly') {
    await (serviceClient.from('spaces') as any)
      .update({
        holiday_nights_per_year:    input.nights_per_year   ?? 30,
        holiday_max_consecutive:    input.max_consecutive   ?? 7,
        holiday_advance_days:       input.advance_days      ?? 90,
      })
      .eq('id', space.id);
  }

  // First-time users get the step-by-step wizard; returning users go straight in
  if (!isFirstSpace) {
    await (serviceClient.from('spaces') as any)
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('id', space.id);
    redirect(`/space/${space.slug}/schedule`);
  }

  redirect(`/space/${space.slug}/setup`);
}

export async function deleteSpace(spaceId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  // Only the owner can delete
  const { data: space } = await supabase
    .from('spaces')
    .select('owner_id')
    .eq('id', spaceId)
    .single();

  if (!space || space.owner_id !== user.id)
    return { success: false, error: 'Only the owner can delete a space.' };

  const serviceClient = createSupabaseServiceClient();
  const { error } = await serviceClient.from('spaces').delete().eq('id', spaceId);

  return error ? { success: false, error: error.message } : { success: true };
}
