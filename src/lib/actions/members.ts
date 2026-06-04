'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export async function updateMemberHours(
  spaceId: string,
  memberId: string,
  weeklyHours: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const { data: self } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .single();

  if (!self || (self.role !== 'owner' && self.role !== 'admin')) {
    return { success: false, error: 'FORBIDDEN' };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from('space_members')
    .update({ weekly_credit_allowance: weeklyHours })
    .eq('space_id', spaceId)
    .eq('user_id', memberId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/space`);
  return { success: true };
}

export async function updateDefaultMemberHours(
  spaceId: string,
  hours: number,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const { data: self } = await supabase
    .from('space_members').select('role')
    .eq('space_id', spaceId).eq('user_id', user.id).single();
  if (!self || (self.role !== 'owner' && self.role !== 'admin')) {
    return { success: false, error: 'FORBIDDEN' };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.from('space_rules')
    .upsert({ space_id: spaceId, rule_type: 'default_member_hours', rule_value: hours },
             { onConflict: 'space_id,rule_type' });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
