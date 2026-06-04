'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  mode: 'login' | 'signup';
}

export default function AuthForm({ mode }: Props) {
  const router  = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [sent,     setSent]     = useState(false); // for signup confirmation state

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-300">
        Check your email — we sent a confirmation link to <strong>{email}</strong>.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm text-neutral-400" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900
                     px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600
                     focus:border-neutral-500 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-neutral-400" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900
                     px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600
                     focus:border-neutral-500 focus:outline-none"
          placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
          minLength={8}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold
                   text-neutral-900 hover:bg-white disabled:opacity-50 transition-colors"
      >
        {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
    </form>
  );
}
