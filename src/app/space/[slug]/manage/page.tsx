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
    .select('role')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .single();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    redirect(`/space/${slug}/schedule`);
  }

  return <ManagePage space={space as any} slug={slug} />;
}
