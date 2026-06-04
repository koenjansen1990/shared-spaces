import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import MembersPage from './MembersPage';

interface Props { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'Members' };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const supabase  = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login`);

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name')
    .eq('slug', slug)
    .single();
  if (!space) return notFound();

  const { data: self } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .single();

  if (!self || (self.role !== 'owner' && self.role !== 'admin')) {
    redirect(`/space/${slug}/schedule`);
  }

  // Fetch all members with their profiles and hour allowances
  const { data: members } = await supabase
    .from('space_members')
    .select('user_id, role, weekly_credit_allowance')
    .eq('space_id', space.id)
    .order('role');

  const userIds = (members ?? []).map(m => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

  const enriched = (members ?? []).map(m => ({
    userId:         m.user_id,
    role:           m.role as string,
    weeklyHours:    m.weekly_credit_allowance,
    displayName:    profileMap[m.user_id]?.display_name ?? null,
    avatarUrl:      profileMap[m.user_id]?.avatar_url   ?? null,
    isCurrentUser:  m.user_id === user.id,
  }));

  const { data: defaultRule } = await supabase
    .from('space_rules')
    .select('rule_value')
    .eq('space_id', space.id)
    .eq('rule_type', 'default_member_hours')
    .single();

  return (
    <MembersPage
      members={enriched}
      spaceId={space.id}
      slug={slug}
      defaultHours={defaultRule?.rule_value ?? 40}
    />
  );
}
