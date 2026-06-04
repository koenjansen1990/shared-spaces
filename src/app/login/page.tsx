import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AuthForm from '@/components/auth/AuthForm';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Shared Spaces</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in to your account</p>
        </div>
        <AuthForm mode="login" />
        <p className="text-sm text-neutral-500 text-center">
          No account?{' '}
          <a href="/signup" className="text-neutral-300 underline underline-offset-2">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
