import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import ManagePage from './ManagePage';

interface Props { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'My Spaces' };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const supabase  = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/space/${slug}/manage`);

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, slug, description, welcome_message, contact_email, contact_phone, address, hero_image_url, default_view, onboarding_completed_at, plan_type, owner_id, created_at, updated_at, space_type')
    .eq('slug', slug)
    .single();
  if (!space) return notFound();

  const { data: member } = await supabase
    .from('space_members')
    .select('role, weekly_credit_allowance')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .single();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    redirect(`/space/${slug}/schedule`);
  }

  // Fetch existing rules for inline editing
  const { data: rules } = await (supabase.from('space_rules') as any)
    .select('rule_type, rule_value')
    .eq('space_id', space.id);

  const ruleMap: Record<string, number> = Object.fromEntries(
    (rules ?? []).map((r: { rule_type: string; rule_value: number }) => [r.rule_type, r.rule_value])
  );

  return (
    <ManagePage
      space={space as any}
      slug={slug}
      hoursPerWeek={member.weekly_credit_allowance ?? ruleMap['default_member_hours'] ?? 40}
      nightsPerYear={ruleMap['nights_per_year'] ?? 30}
      maxConsecutive={ruleMap['max_consecutive_nights'] ?? 7}
      advanceDays={ruleMap['max_advance_days'] ?? 90}
    />
  );
}
