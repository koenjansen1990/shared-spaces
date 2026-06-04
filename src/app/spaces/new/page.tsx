import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import CreateSpaceForm from '@/components/space/CreateSpaceForm';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create a Space' };

export default async function NewSpacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Create a Space</h1>
          <p className="text-sm text-neutral-500 mt-1">
            A Space is a shared home for your group — a studio, collective, or rehearsal room.
          </p>
        </div>
        <CreateSpaceForm />
      </div>
    </div>
  );
}
