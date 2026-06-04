'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateMemberHours, updateDefaultMemberHours } from '@/lib/actions/members';

interface Member {
  userId:        string;
  role:          string;
  weeklyHours:   number;
  displayName:   string | null;
  avatarUrl:     string | null;
  isCurrentUser: boolean;
}

interface Props {
  members:      Member[];
  spaceId:      string;
  slug:         string;
  defaultHours: number;
}

const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-orange-500','bg-pink-500','bg-cyan-500'];
function avatarColor(id: string) {
  let n = 0; for (const c of id) n += c.charCodeAt(0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

const HOUR_PRESETS = [8, 16, 24, 32, 40];

const inputCls = 'w-16 bg-white border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-gray-700 text-center focus:outline-none focus:border-gray-400 transition-colors';

export default function MembersPage({ members, spaceId, slug, defaultHours: initialDefault }: Props) {
  const router = useRouter();
  const [hours, setHours] = useState<Record<string, number>>(
    Object.fromEntries(members.map(m => [m.userId, m.weeklyHours]))
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [saved,  setSaved]  = useState<string | null>(null);

  const [defaultH,      setDefaultH]      = useState(initialDefault);
  const [savingDefault, setSavingDefault] = useState(false);
  const [savedDefault,  setSavedDefault]  = useState(false);

  async function handleSaveDefault() {
    setSavingDefault(true);
    await updateDefaultMemberHours(spaceId, defaultH);
    setSavingDefault(false);
    setSavedDefault(true);
    setTimeout(() => setSavedDefault(false), 2000);
  }

  async function handleSave(userId: string) {
    setSaving(userId);
    const r = await updateMemberHours(spaceId, userId, hours[userId]);
    setSaving(null);
    if (r.success) { setSaved(userId); setTimeout(() => setSaved(null), 2000); }
  }

  return (
    <div className="max-w-lg mx-auto w-full space-y-8 py-4">

      <button onClick={() => router.push(`/space/${slug}/schedule`)}
        className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
        ← Back to schedule
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="text-sm text-gray-400 mt-1">Assign weekly hours per member.</p>
      </div>

      {/* Default for new members */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Default for new members</p>
          <p className="text-xs text-gray-400 mt-0.5">Applied automatically when someone joins via invite.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {HOUR_PRESETS.map(h => (
            <button key={h} onClick={() => setDefaultH(h)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                ${defaultH === h
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}>
              {h}h
            </button>
          ))}
          <input type="number" min={0} max={168} value={defaultH}
            onChange={e => setDefaultH(Number(e.target.value))}
            className={inputCls} />
        </div>
        <button onClick={handleSaveDefault} disabled={savingDefault || defaultH === initialDefault}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all
            ${savedDefault
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40'}`}>
          {savingDefault ? 'Saving…' : savedDefault ? 'Saved ✓' : 'Save default'}
        </button>
      </div>

      <div className="space-y-3">
        {members.map(m => {
          const initials = m.displayName
            ? m.displayName.trim().split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase()
            : m.userId.slice(0,2).toUpperCase();
          const isSaving = saving === m.userId;
          const isSaved  = saved  === m.userId;

          return (
            <div key={m.userId} className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white overflow-hidden shrink-0 ${m.avatarUrl ? '' : avatarColor(m.userId)}`}>
                  {m.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {m.displayName ?? 'Unknown'}
                    {m.isCurrentUser && <span className="text-gray-400 ml-1.5 text-xs">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{m.role}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 tabular-nums shrink-0">
                  {hours[m.userId]}h / week
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {HOUR_PRESETS.map(h => (
                  <button key={h} onClick={() => setHours(prev => ({ ...prev, [m.userId]: h }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                      ${hours[m.userId] === h
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'}`}>
                    {h}h
                  </button>
                ))}
                <input type="number" min={0} max={168} value={hours[m.userId]}
                  onChange={e => setHours(prev => ({ ...prev, [m.userId]: Number(e.target.value) }))}
                  className={inputCls} />
              </div>

              <button onClick={() => handleSave(m.userId)} disabled={isSaving || hours[m.userId] === m.weeklyHours}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${isSaved
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40'}`}>
                {isSaving ? 'Saving…' : isSaved ? 'Saved ✓' : 'Save'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
