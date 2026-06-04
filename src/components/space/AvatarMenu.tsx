'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Props {
  email:     string;
  initials:  string;
  avatarUrl: string | null;
  isAdmin:   boolean;
  slug:      string;
}

export default function AvatarMenu({ email, initials, avatarUrl, isAdmin, slug }: Props) {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const router          = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200
                   flex items-center justify-center text-sm font-semibold text-gray-700
                   transition-colors select-none overflow-hidden"
      >
        {avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          : initials}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-52 bg-white border border-gray-200
                        rounded-2xl shadow-lg overflow-hidden z-50
                        animate-in fade-in slide-in-from-top-2 duration-150">

          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400 truncate">{email}</p>
          </div>

          <div className="py-1">
            <Link
              href={`/space/${slug}/profile`}
              onClick={() => setOpen(false)}
              className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Profile
            </Link>
            {isAdmin ? (
              <Link
                href={`/space/${slug}/manage`}
                onClick={() => setOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
              >
                My Spaces
              </Link>
            ) : (
              <Link
                href={`/space/${slug}/bookings`}
                onClick={() => setOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
              >
                My Bookings
              </Link>
            )}
            {isAdmin && (
              <Link
                href={`/space/${slug}/members`}
                onClick={() => setOpen(false)}
                className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
              >
                Members
              </Link>
            )}
          </div>

          <div className="border-t border-gray-100">
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
