import { redirect, notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AvatarMenu from '@/components/space/AvatarMenu';
import type { SpaceMember } from '@/types';

interface Props {
  children: React.ReactNode;
  params:   Promise<{ slug: string }>;
}

export default async function SpaceLayout({ children, params }: Props) {
  const { slug } = await params;
  const supabase  = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/space/${slug}`);

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, slug, plan_type')
    .eq('slug', slug)
    .single();

  if (!space) notFound();

  const { data: member } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .single<Pick<SpaceMember, 'role'>>();

  if (!member) notFound();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single();

  const isAdmin  = member.role === 'owner' || member.role === 'admin';
  const initials = (profile?.display_name ?? user.email ?? '?')
    .trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F7F7F7' }}>

      {/* ── Top bar ───────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between bg-transparent"
              style={{ paddingTop: '14px', paddingBottom: '14px', paddingRight: '32px' }}>
        <div />
        <AvatarMenu
          email={user.email ?? ''}
          initials={initials}
          avatarUrl={profile?.avatar_url ?? null}
          isAdmin={isAdmin}
          slug={slug}
        />
      </header>

      {/* ── Page content ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col" style={{ paddingTop: '64px' }}>
        <div className="w-full px-5 pb-5 flex-1 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
