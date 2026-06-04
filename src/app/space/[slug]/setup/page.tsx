import { redirect, notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import SetupFlow from '@/components/setup/SetupFlow';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Set up your space' };

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function SetupPage({ params }: Props) {
  const { slug } = await params;
  const supabase  = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/space/${slug}/setup`);

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, slug, description, welcome_message, contact_email, contact_phone, address, default_view, onboarding_completed_at, plan_type, owner_id, created_at, updated_at')
    .eq('slug', slug)
    .single();

  if (!space) notFound();

  // Only admins can run setup
  const { data: member } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .single();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    redirect(`/space/${slug}/schedule`);
  }

  return <SetupFlow space={space} />;
}
