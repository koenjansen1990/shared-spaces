import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import AuthForm from '@/components/auth/AuthForm';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect('/');

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Create account</h1>
          <p className="text-sm text-neutral-500 mt-1">Join Shared Spaces</p>
        </div>
        <AuthForm mode="signup" />
        <p className="text-sm text-neutral-500 text-center">
          Already have an account?{' '}
          <a href="/login" className="text-neutral-300 underline underline-offset-2">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
