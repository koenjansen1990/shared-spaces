'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import type { CreateSlotInput } from '@/types';

export type CreateSlotResult =
  | { success: true;  slot_id: string }
  | { success: false; error: string };

export async function createSlot(input: CreateSlotInput): Promise<CreateSlotResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  // Verify the caller is an admin of this space
  const { data: member } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', input.space_id)
    .eq('user_id', user.id)
    .single();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return { success: false, error: 'Only admins can add slots.' };
  }

  // Validate time range
  if (input.end_time <= input.start_time) {
    return { success: false, error: 'End time must be after start time.' };
  }

  // Use service-role to bypass RLS (same pattern as createSpace)
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from('slots')
    .insert({
      resource_id:    input.resource_id,
      space_id:       input.space_id,
      slot_type:      input.slot_type,
      recurrence_day: input.recurrence_day ?? null,
      event_date:     input.event_date ?? null,
      start_time:     input.start_time,
      end_time:       input.end_time,
      max_capacity:   input.max_capacity,
      credit_cost:    input.credit_cost,
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  // Fetch slug for cache invalidation
  const { data: space } = await service
    .from('spaces')
    .select('slug')
    .eq('id', input.space_id)
    .single();

  if (space?.slug) {
    revalidatePath(`/space/${space.slug}/resources`);
    revalidatePath(`/space/${space.slug}/schedule`);
  }

  return { success: true, slot_id: data.id };
}
