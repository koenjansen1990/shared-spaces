import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import SignupPageClient from '@/components/auth/SignupPageClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create account · Shared Spaces' };

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/');

  return <SignupPageClient mode="signup" />;
}
