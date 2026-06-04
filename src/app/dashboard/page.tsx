import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import DashboardPage from '@/components/dashboard/DashboardPage';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export type SpaceMembership = {
  role: 'owner' | 'admin' | 'member';
  space: {
    id: string;
    name: string;
    slug: string;
    hero_image_url: string | null;
    space_type: string | null;
    onboarding_completed_at: string | null;
    owner_id: string;
  };
};

export default async function DashboardServerPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: memberships } = await (supabase
    .from('space_members') as any)
    .select('role, spaces(id, name, slug, hero_image_url, space_type, onboarding_completed_at, owner_id)')
    .eq('user_id', user.id);

  const rows: SpaceMembership[] = (memberships ?? []).map((m: any) => ({
    role: m.role as 'owner' | 'admin' | 'member',
    space: m.spaces as SpaceMembership['space'],
  })).filter((m: SpaceMembership) => !!m.space);

  const owned  = rows.filter(m => m.role === 'owner' || m.role === 'admin');
  const member = rows.filter(m => m.role === 'member');

  return <DashboardPage owned={owned} member={member} />;
}
