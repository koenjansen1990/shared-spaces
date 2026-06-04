import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import JoinScreen from '@/components/join/JoinScreen';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'You\'ve been invited' };

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  const service = createSupabaseServiceClient();

  const { data: invite } = await service
    .from('invite_tokens')
    .select('space_id, expires_at, max_uses, use_count')
    .eq('token', token)
    .single();

  if (!invite) notFound();

  const expired =
    (invite.expires_at && new Date(invite.expires_at) < new Date()) ||
    (invite.max_uses !== null && invite.use_count >= invite.max_uses);

  const { data: space } = await service
    .from('spaces')
    .select('name, slug, welcome_message, hero_image_url')
    .eq('id', invite.space_id)
    .single();

  if (!space) notFound();

  // If already logged in and already a member, go straight to schedule
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: existing } = await service
      .from('space_members')
      .select('id')
      .eq('space_id', invite.space_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing) redirect(`/space/${space.slug}/schedule`);
  }

  return (
    <JoinScreen
      token={token}
      spaceName={space.name}
      welcomeMessage={space.welcome_message ?? null}
      heroImageUrl={space.hero_image_url ?? null}
      expired={!!expired}
      isLoggedIn={!!user}
    />
  );
}
