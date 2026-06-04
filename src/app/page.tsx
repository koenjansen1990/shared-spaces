import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Root route: authenticated users go to their spaces list,
// unauthenticated users go to the login page.
export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Find the first space the user belongs to and send them there.
  const { data: membership } = await supabase
    .from('space_members')
    .select('spaces(slug)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const slug = (membership?.spaces as unknown as { slug: string } | null)?.slug;
  if (slug) redirect(`/space/${slug}/schedule`);

  // No spaces yet → onboarding
  redirect('/spaces/new');
}
