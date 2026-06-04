'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { updateProfile, updateAvatarUrl } from '@/lib/actions/profile';

interface SpaceInfo {
  id:              string;
  name:            string;
  welcome_message: string | null;
  contact_email:   string | null;
  contact_phone:   string | null;
  address:         string | null;
}

interface Props {
  userId:      string;
  email:       string;
  displayName: string | null;
  avatarUrl:   string | null;
  isAdmin:     boolean;
  space:       SpaceInfo;
  slug:        string;
}

const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-cyan-500'];
function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export default function ProfilePage({ userId, email, displayName: initialName, avatarUrl: initialAvatar, isAdmin, space, slug }: Props) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(initialName ?? '');
  const [avatarUrl,   setAvatarUrl]   = useState(initialAvatar ?? '');
  const [uploading,   setUploading]   = useState(false);
  const [profileMsg,  setProfileMsg]  = useState<string | null>(null);
  const [isPending,   startTransition]= useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = displayName.trim()
    ? displayName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setProfileMsg(null);
    const supabase = createSupabaseBrowserClient();
    const ext  = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { setProfileMsg(error.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    setAvatarUrl(url);
    const r = await updateAvatarUrl(url);
    setUploading(false);
    setProfileMsg(r.success ? 'Avatar updated.' : (r.error ?? 'Error'));
  }

  function handleSaveProfile() {
    setProfileMsg(null);
    startTransition(async () => {
      const r = await updateProfile(displayName);
      setProfileMsg(r.success ? 'Profile saved.' : (r.error ?? 'Error'));
    });
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-2xl px-5 py-4 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors';

  return (
    <div className="max-w-lg mx-auto w-full space-y-10 py-4">

      <button onClick={() => router.push(`/space/${slug}/schedule`)}
        className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← Back to schedule
      </button>

      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <button onClick={() => fileRef.current?.click()} className="relative group shrink-0" disabled={uploading}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white overflow-hidden ${avatarUrl ? '' : avatarColor(userId)}`}>
              {avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs text-white font-medium">{uploading ? '…' : 'Change'}</span>
            </div>
          </button>
          <div>
            <p className="text-sm font-medium text-gray-800">Profile photo</p>
            <p className="text-xs text-gray-400 mt-0.5">Click to upload · JPG, PNG, WebP</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>

        {/* Display name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">Display name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name" className={inputCls} />
        </div>

        {/* Email read-only */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">Email</label>
          <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-gray-400 text-sm">
            {email}
          </div>
        </div>

        {profileMsg && (
          <p className={`text-sm ${profileMsg.includes('saved') || profileMsg.includes('updated') ? 'text-emerald-600' : 'text-red-500'}`}>
            {profileMsg}
          </p>
        )}

        <button onClick={handleSaveProfile} disabled={isPending}
          className="w-full bg-gray-900 text-white rounded-2xl py-4 font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors">
          {isPending ? 'Saving…' : 'Save profile'}
        </button>
      </section>

      {isAdmin && (
        <section className="pt-4 border-t border-gray-200">
          <button onClick={() => router.push(`/space/${slug}/manage`)}
            className="w-full border border-gray-200 text-gray-700 rounded-2xl py-4 font-semibold hover:bg-gray-50 transition-colors">
            Manage space →
          </button>
        </section>
      )}
    </div>
  );
}
