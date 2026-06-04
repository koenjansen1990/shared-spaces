'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveSpaceDetails, saveAvailability, completeOnboarding, saveSpaceType, saveHolidayRules } from '@/lib/actions/setup';
import type { Space } from '@/types';
import Button from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';

const DAYS = [
  { label: 'Mo', value: 1 },
  { label: 'Tu', value: 2 },
  { label: 'We', value: 3 },
  { label: 'Th', value: 4 },
  { label: 'Fr', value: 5 },
  { label: 'Sa', value: 6 },
  { label: 'Su', value: 0 },
];


interface Props { space: Space }

export default function SetupFlow({ space }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError]            = useState<string | null>(null);

  const existingType = (space as any).space_type as 'workplace' | 'holiday_home' | null ?? null;
  const [spaceType, setSpaceType] = useState<'workplace' | 'holiday_home' | null>(existingType);
  const [step, setStep]              = useState(existingType ? 1 : 0);

  const [name, setName]        = useState(space.name);
  const [description, setDesc] = useState(space.description ?? '');

  const [days,         setDays]         = useState<number[]>([1, 3, 5]);
  const [hoursPerWeek, setHoursPerWeek] = useState(40);

  // Holiday home rules
  const [nightsPerYear,  setNightsPerYear]  = useState(30);
  const [maxConsecutive, setMaxConsecutive] = useState(7);
  const [advanceDays,    setAdvanceDays]    = useState(90);

  const [welcome,     setWelcome] = useState('');
  const [inviteToken, setToken]   = useState<string | null>(null);
  const [copied,      setCopied]  = useState(false);

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function copyLink() {
    if (!inviteToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStep0(type: 'workplace' | 'holiday_home') {
    setSpaceType(type);
    startTransition(async () => {
      await saveSpaceType(space.id, type);
      setStep(1);
    });
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
      if (spaceType === 'holiday_home') {
        const r = await saveHolidayRules(space.id, nightsPerYear, maxConsecutive, advanceDays);
        if (!r.success) { setError(r.error); return; }
      } else {
        const r = await saveAvailability(space.id, name, days, hoursPerWeek, 10, 1);
        if (!r.success) { setError(r.error); return; }
      }
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Progress bar — only visible after step 0 */}
      {step > 0 && (
        <div className="fixed top-0 inset-x-0 z-50 h-0.5 bg-gray-200">
          <div className="h-full bg-gray-900 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      )}

      {/* Step dots — only visible after step 0 */}
      {step > 0 && (
        <div className="fixed top-6 inset-x-0 z-50 flex justify-center gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 rounded-full transition-all duration-300
              ${s === step ? 'bg-gray-900 w-4' : s < step ? 'bg-gray-400' : 'bg-gray-300'}`}
              style={{ width: s === step ? '1rem' : '0.375rem' }}
            />
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-16 max-w-lg mx-auto w-full">

        {/* ── Step 0 — Space type picker ── */}
        {step === 0 && (
          <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2 text-center">
              <h1 className="text-4xl font-bold text-gray-900">What are you sharing?</h1>
              <p className="text-gray-400">This shapes how your calendar and fairness rules work.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* Workspace card */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStep0('workplace')}
                className={`text-left bg-white border rounded-2xl p-6 hover:border-gray-400 cursor-pointer transition-all
                  ${spaceType === 'workplace' ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
              >
                <div className="text-4xl mb-3">🏢</div>
                <p className="text-lg font-bold text-gray-900">Workspace or Studio</p>
                <p className="text-sm text-gray-400 mt-1">Book by morning or afternoon slots. Fair weekly hours per member.</p>
              </button>

              {/* Holiday home card */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStep0('holiday_home')}
                className={`text-left bg-white border rounded-2xl p-6 hover:border-gray-400 cursor-pointer transition-all
                  ${spaceType === 'holiday_home' ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}
              >
                <div className="text-4xl mb-3">🏡</div>
                <p className="text-lg font-bold text-gray-900">Holiday Home, Van or Boat</p>
                <p className="text-sm text-gray-400 mt-1">Book multi-day stays. Fair annual nights per member.</p>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-gray-400">Step 1 of 3</p>
              <h1 className="text-4xl font-bold text-gray-900 leading-tight">What&apos;s your space called?</h1>
              <p className="text-gray-400">You can always change this later.</p>
            </div>

            <div className="space-y-4">
              <Input autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="Otis August Studio" className="text-2xl font-medium" />
              <Textarea value={description} onChange={e => setDesc(e.target.value)}
                placeholder="A short description — optional. What kind of space is this?"
                rows={3} className="text-lg" />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <Button onClick={handleStep1} disabled={isPending || !name.trim()}>
              {isPending ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        )}

        {/* ── Step 2 (workplace / studio) ── */}
        {step === 2 && spaceType !== 'holiday_home' && (
          <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-gray-400">Step 2 of 3</p>
              <h1 className="text-4xl font-bold text-gray-900 leading-tight">Set the rules for {name}</h1>
              <p className="text-gray-400">These keep things fair for everyone.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm text-gray-600 font-medium">Open days</p>
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

              <div className="space-y-2">
                <label className="text-sm text-gray-600 font-medium">Hours per week per member</label>
                <Input
                  type="number"
                  value={hoursPerWeek}
                  onChange={e => setHoursPerWeek(Number(e.target.value))}
                  min={1}
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="space-y-3">
              <Button onClick={handleStep2} disabled={isPending}>
                {isPending ? 'Saving…' : 'Continue'}
              </Button>
              <Button variant="ghost" size="md" full onClick={() => setStep(1)}>Back</Button>
            </div>
          </div>
        )}

        {/* ── Step 2 (holiday home) ── */}
        {step === 2 && spaceType === 'holiday_home' && (
          <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-gray-400">Step 2 of 3</p>
              <h1 className="text-4xl font-bold text-gray-900 leading-tight">Set the rules for {name}</h1>
              <p className="text-gray-400">These keep things fair for everyone.</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm text-gray-600 font-medium">Nights per year</label>
                <Input
                  type="number"
                  value={nightsPerYear}
                  onChange={e => setNightsPerYear(Number(e.target.value))}
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600 font-medium">Max consecutive nights</label>
                <Input
                  type="number"
                  value={maxConsecutive}
                  onChange={e => setMaxConsecutive(Number(e.target.value))}
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-600 font-medium">How many days ahead can members book?</label>
                <Input
                  type="number"
                  value={advanceDays}
                  onChange={e => setAdvanceDays(Number(e.target.value))}
                  min={1}
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="space-y-3">
              <Button onClick={handleStep2} disabled={isPending}>
                {isPending ? 'Saving…' : 'Continue'}
              </Button>
              <Button variant="ghost" size="md" full onClick={() => setStep(1)}>Back</Button>
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

                <Textarea value={welcome} onChange={e => setWelcome(e.target.value)}
                  placeholder={`Welcome to ${name}. We share this space together — please be respectful of each other's sessions.`}
                  rows={4} className="text-lg" />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="space-y-3">
                  <Button onClick={handleStep3} disabled={isPending}>
                    {isPending ? 'Finishing…' : 'Generate invite link'}
                  </Button>
                  <Button variant="ghost" size="md" full onClick={() => setStep(2)}>Back</Button>
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
                  <Button variant="secondary" size="md" onClick={copyLink}>
                    {copied ? '✓ Copied' : 'Copy invite link'}
                  </Button>
                </div>

                <Button onClick={handleEnter}>Enter {name} →</Button>
              </div>
            )}
          </div>
        )}

        {!inviteToken && (
          <Button variant="ghost" size="sm" onClick={handleEnter} className="mt-8">
            Continue later
          </Button>
        )}
      </div>
    </div>
  );
}
