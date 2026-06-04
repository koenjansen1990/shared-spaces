'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSpaceDetails, saveAvailability, completeOnboarding } from '@/lib/actions/setup';
import type { Space, CalendarView } from '@/types';

const DAYS = [
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
  { label: 'Su', value: 0 },
];

const VIEWS: { label: string; value: CalendarView; sub: string }[] = [
  { label: 'Day',   value: 'daily',   sub: 'Ideal for busy studios' },
  { label: 'Week',  value: 'weekly',  sub: 'Most popular' },
  { label: 'Month', value: 'monthly', sub: 'Great for planning ahead' },
  { label: 'Year',  value: 'yearly',  sub: 'Full overview' },
];

interface Props { space: Space }

export default function SetupFlow({ space }: Props) {
  const router = useRouter();
  const [step, setStep]             = useState(1);
  const [isPending, startTransition]= useTransition();
  const [error, setError]           = useState<string | null>(null);

  const [name, setName]           = useState(space.name);
  const [description, setDesc]    = useState(space.description ?? '');

  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [view, setView] = useState<CalendarView>('weekly');

  const [welcome,     setWelcome]  = useState('');
  const [inviteToken, setToken]    = useState<string | null>(null);
  const [copied,      setCopied]   = useState(false);

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function copyLink() {
    if (!inviteToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleStep1() {
    setError(null);
    if (!name.trim()) { setError('Give your space a name.'); return; }
    startTransition(async () => {
      const r = await saveSpaceDetails(space.id, name, description);
      if (!r.success) { setError(r.error); return; }
      setStep(2);
    });
  }

  async function handleStep2() {
    setError(null);
    startTransition(async () => {
      const r = await saveAvailability(space.id, name, days, view, 10, 1);
      if (!r.success) { setError(r.error); return; }
      setStep(3);
    });
  }

  async function handleStep3() {
    setError(null);
    startTransition(async () => {
      const r = await completeOnboarding(space.id, welcome);
      if (!r.success) { setError(r.error); return; }
      setToken(r.token);
    });
  }

  function handleEnter() { router.push(`/space/${space.slug}/schedule`); }

  const inputCls = `w-full bg-white border border-gray-200 rounded-2xl px-6 py-5
    text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-colors`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Progress bar */}
      <div className="fixed top-0 inset-x-0 z-50 h-0.5 bg-gray-200">
        <div className="h-full bg-gray-900 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {/* Step dots */}
      <div className="fixed top-6 inset-x-0 z-50 flex justify-center gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300
            ${s === step ? 'bg-gray-900 w-4' : s < step ? 'bg-gray-400' : 'bg-gray-300'}`}
            style={{ width: s === step ? '1rem' : '0.375rem' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-16 max-w-lg mx-auto w-full">

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-gray-400">Step 1 of 3</p>
              <h1 className="text-4xl font-bold text-gray-900 leading-tight">What's your space called?</h1>
              <p className="text-gray-400">You can always change this later.</p>
            </div>

            <div className="space-y-4">
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="Otis August Studio"
                className={`${inputCls} text-2xl font-medium`} />
              <textarea value={description} onChange={e => setDesc(e.target.value)}
                placeholder="A short description — optional. What kind of space is this?"
                rows={3} className={`${inputCls} text-lg resize-none`} />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button onClick={handleStep1} disabled={isPending || !name.trim()}
              className="w-full bg-gray-900 text-white rounded-2xl py-5 text-lg font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors">
              {isPending ? 'Saving…' : 'Continue'}
            </button>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-gray-400">Step 2 of 3</p>
              <h1 className="text-4xl font-bold text-gray-900 leading-tight">When is {name} available?</h1>
              <p className="text-gray-400">Set recurring days and times.</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">Days</p>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map(d => (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    className={`aspect-square rounded-xl text-sm font-semibold transition-all
                      ${days.includes(d.value)
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600 font-medium">Default calendar view</p>
              <div className="grid grid-cols-2 gap-3">
                {VIEWS.map(v => (
                  <button key={v.value} type="button" onClick={() => setView(v.value)}
                    className={`rounded-2xl p-5 text-left transition-all border
                      ${view === v.value
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    <p className="text-lg font-semibold">{v.label}</p>
                    <p className={`text-xs mt-0.5 ${view === v.value ? 'text-gray-400' : 'text-gray-400'}`}>{v.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="space-y-3">
              <button onClick={handleStep2} disabled={isPending}
                className="w-full bg-gray-900 text-white rounded-2xl py-5 text-lg font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors">
                {isPending ? 'Saving…' : 'Continue'}
              </button>
              <button onClick={() => setStep(1)}
                className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Back
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {!inviteToken ? (
              <>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-widest text-gray-400">Step 3 of 3</p>
                  <h1 className="text-4xl font-bold text-gray-900 leading-tight">Welcome your group</h1>
                  <p className="text-gray-400">Add a short message members will see when they join. Optional.</p>
                </div>

                <textarea value={welcome} onChange={e => setWelcome(e.target.value)}
                  placeholder={`Welcome to ${name}. We share this space together — please be respectful of each other's sessions.`}
                  rows={4} className={`${inputCls} text-lg resize-none`} />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="space-y-3">
                  <button onClick={handleStep3} disabled={isPending}
                    className="w-full bg-gray-900 text-white rounded-2xl py-5 text-lg font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors">
                    {isPending ? 'Finishing…' : 'Generate invite link'}
                  </button>
                  <button onClick={() => setStep(2)}
                    className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    Back
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <div className="text-5xl mb-4">🎉</div>
                  <h1 className="text-4xl font-bold text-gray-900 leading-tight">{name} is ready.</h1>
                  <p className="text-gray-400">Share this link with your group.</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                  <p className="text-sm text-gray-500 font-mono break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/join/${inviteToken}` : `/join/${inviteToken}`}
                  </p>
                  <button onClick={copyLink}
                    className="w-full bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl py-3 text-sm font-semibold text-gray-700 transition-colors">
                    {copied ? '✓ Copied' : 'Copy invite link'}
                  </button>
                </div>

                <button onClick={handleEnter}
                  className="w-full bg-gray-900 text-white rounded-2xl py-5 text-lg font-semibold hover:bg-gray-800 transition-colors">
                  Enter {name} →
                </button>
              </div>
            )}
          </div>
        )}

        {!inviteToken && (
          <button onClick={handleEnter} className="mt-8 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Continue later
          </button>
        )}
      </div>
    </div>
  );
}
