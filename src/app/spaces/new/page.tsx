import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import CreateSpaceForm from '@/components/space/CreateSpaceForm';
import PaywallScreen from '@/components/space/PaywallScreen';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create a Space' };

export default async function NewSpacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Count spaces the user owns to enforce free-plan gate
  const { count } = await (supabase
    .from('spaces') as any)
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id);

  const ownedCount = count ?? 0;

  if (ownedCount >= 1) {
    return <PaywallScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create a Space</h1>
          <p className="text-sm text-gray-500 mt-1">
            A Space is a shared home for your group — a studio, collective, or rehearsal room.
          </p>
        </div>
        <CreateSpaceForm />
      </div>
    </div>
  );
}
