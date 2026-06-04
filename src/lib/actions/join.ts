'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export type JoinResult =
  | { success: true; slug: string }
  | { success: false; error: 'UNAUTHENTICATED' | 'INVALID_TOKEN' | 'EXPIRED' | 'ALREADY_MEMBER' | 'INTERNAL_ERROR' };

export async function joinSpace(token: string): Promise<JoinResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient();

  // Look up token
  const { data: invite } = await service
    .from('invite_tokens')
    .select('id, space_id, expires_at, max_uses, use_count')
    .eq('token', token)
    .single();

  if (!invite) return { success: false, error: 'INVALID_TOKEN' };

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { success: false, error: 'EXPIRED' };
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return { success: false, error: 'EXPIRED' };
  }

  // Get space slug
  const { data: space } = await service
    .from('spaces')
    .select('slug')
    .eq('id', invite.space_id)
    .single();

  if (!space) return { success: false, error: 'INTERNAL_ERROR' };

  // Check if already a member
  const { data: existing } = await service
    .from('space_members')
    .select('id')
    .eq('space_id', invite.space_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) redirect(`/space/${space.slug}/schedule`);

  // Look up space default hours for new members
  const { data: defaultRule } = await service
    .from('space_rules')
    .select('rule_value')
    .eq('space_id', invite.space_id)
    .eq('rule_type', 'default_member_hours')
    .single();

  const weeklyHours = defaultRule?.rule_value ?? 40;

  // Add member
  const { error: memberErr } = await service.from('space_members').insert({
    space_id:                invite.space_id,
    user_id:                 user.id,
    role:                    'member',
    weekly_credit_allowance: weeklyHours,
  });

  if (memberErr) return { success: false, error: 'INTERNAL_ERROR' };

  // Increment use_count
  await service
    .from('invite_tokens')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id);

  redirect(`/space/${space.slug}/schedule`);
}
