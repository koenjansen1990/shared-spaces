'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { joinSpace } from '@/lib/actions/join';
import Button from '@/components/ui/Button';

interface Props {
  token:          string;
  spaceName:      string;
  welcomeMessage: string | null;
  heroImageUrl:   string | null;
  expired:        boolean;
  isLoggedIn:     boolean;
}

export default function JoinScreen({ token, spaceName, welcomeMessage, heroImageUrl, expired, isLoggedIn }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    if (!isLoggedIn) {
      router.push(`/login?next=/join/${token}`);
      return;
    }
    startTransition(async () => {
      await joinSpace(token);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#F7F7F7' }}>
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">

        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">

          {/* Hero image */}
          {heroImageUrl && (
            <div className="relative" style={{ height: '211px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImageUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, white 100%)' }} />
            </div>
          )}

          <div className="px-8 pt-6 pb-8 space-y-8">

            {expired ? (
              <div className="space-y-3 text-center py-6">
                <p className="text-4xl">🔒</p>
                <h1 className="text-2xl font-bold text-gray-900">This link has expired</h1>
                <p className="text-sm text-gray-400">Ask the admin for a fresh invite link.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">You're invited</p>
                  <h1 className="text-3xl font-bold text-gray-900 leading-tight">{spaceName}</h1>
                  {welcomeMessage && (
                    <p className="text-gray-500 text-sm leading-relaxed pt-1">{welcomeMessage}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Button onClick={handleJoin} disabled={isPending}>
                    {isPending ? 'Joining…' : isLoggedIn ? `Join ${spaceName}` : 'Sign in to join'}
                  </Button>

                  {!isLoggedIn && (
                    <p className="text-center text-sm text-gray-400">
                      Don't have an account?{' '}
                      <a
                        href={`/signup?next=/join/${token}`}
                        className="text-gray-700 hover:text-gray-900 underline transition-colors"
                      >
                        Sign up
                      </a>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
