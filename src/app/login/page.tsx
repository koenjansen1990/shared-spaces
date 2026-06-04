import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import SignupPageClient from '@/components/auth/SignupPageClient';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in · Shared Spaces' };

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { next } = await searchParams;
    redirect(next ?? '/');
  }

  return <SignupPageClient mode="login" />;
}
