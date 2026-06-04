import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProfilePage from './ProfilePage';

interface Props { params: Promise<{ slug: string }> }

export const metadata: Metadata = { title: 'Profile' };

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const supabase  = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, welcome_message, contact_email, contact_phone, address')
    .eq('slug', slug)
    .single();
  if (!space) return notFound();

  const { data: member } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .single();
  if (!member) return notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single();

  const isAdmin = member.role === 'owner' || member.role === 'admin';

  return (
    <ProfilePage
      userId={user.id}
      email={user.email ?? ''}
      displayName={profile?.display_name ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      isAdmin={isAdmin}
      space={{ ...space }}
      slug={slug}
    />
  );
}
