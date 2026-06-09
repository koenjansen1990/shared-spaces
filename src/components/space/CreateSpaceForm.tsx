'use client';

import { useState, useTransition } from 'react';
import { createSpace } from '@/lib/actions/space';
import Button from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import Label from '@/components/ui/Label';

// Derives a URL-safe slug from a plain-text name as the user types.
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

const DAYS = [
  { label: 'Mo', value: 1 }, { label: 'Tu', value: 2 }, { label: 'We', value: 3 },
  { label: 'Th', value: 4 }, { label: 'Fr', value: 5 }, { label: 'Sa', value: 6 }, { label: 'Su', value: 0 },
];

export default function CreateSpaceForm() {
  const [spaceType,   setSpaceType]   = useState<'workplace' | 'holiday_home' | null>(null);
  const [name,        setName]        = useState('');
  const [slug,        setSlug]        = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [fieldError,  setFieldError]  = useState<'name' | 'slug' | null>(null);

  // Studio rules
  const [days,         setDays]         = useState<number[]>([1, 2, 3, 4, 5]);
  const [hoursPerWeek, setHoursPerWeek] = useState(40);

  // Holiday home rules
  const [nightsPerYear,  setNightsPerYear]  = useState(30);
  const [maxConsecutive, setMaxConsecutive] = useState(7);
  const [advanceDays,    setAdvanceDays]    = useState(90);

  const [isPending, startTransition] = useTransition();

  function toggleDay(d: number) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  function handleSlugChange(value: string) {
    setSlugTouched(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(null);

    startTransition(async () => {
      const result = await createSpace({
        name, slug, description,
        space_type:     spaceType ?? undefined,
        days,
        hours_per_week: hoursPerWeek,
        nights_per_year:   nightsPerYear,
        max_consecutive:   maxConsecutive,
        advance_days:      advanceDays,
      });
      // If createSpace succeeds it redirects; we only land here on failure.
      if (!result.success) {
        setError(result.error);
        setFieldError(result.field ?? null);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Type picker */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { type: 'workplace',    emoji: '🏢', label: 'Workspace / Studio' },
          { type: 'holiday_home', emoji: '🏡', label: 'Holiday Home, Van or Boat' },
        ] as const).map(({ type, emoji, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => setSpaceType(type)}
            className={`text-left rounded-2xl border p-4 transition-all
              ${spaceType === type
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}`}
          >
            <div className="text-2xl mb-2">{emoji}</div>
            <p className="text-xs font-semibold text-gray-700 leading-snug">{label}</p>
          </button>
        ))}
      </div>

      {/* Rules — shown after type is picked */}
      {spaceType && (
        <div className="border-t border-gray-100 pt-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Rules</p>

          {spaceType === 'workplace' ? (
            <>
              <div className="space-y-2">
                <Label>Open days</Label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map(d => (
                    <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                      className={`aspect-square rounded-xl text-xs font-semibold transition-all
                        ${days.includes(d.value)
                          ? 'bg-gray-900 text-white'
                          : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Hours per week per member</Label>
                <Input type="number" min={1} value={hoursPerWeek}
                  onChange={e => setHoursPerWeek(Number(e.target.value))} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Nights per year per member</Label>
                <Input type="number" min={1} value={nightsPerYear}
                  onChange={e => setNightsPerYear(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Max consecutive nights</Label>
                <Input type="number" min={1} value={maxConsecutive}
                  onChange={e => setMaxConsecutive(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>How many days ahead can members book?</Label>
                <Input type="number" min={1} value={advanceDays}
                  onChange={e => setAdvanceDays(Number(e.target.value))} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">Space name</Label>
        <Input
          id="name"
          type="text"
          required
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Otis Studio Collectief"
          className={fieldError === 'name' ? 'border-red-400 focus:border-red-400' : ''}
        />
        {fieldError === 'name' && error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-1.5">
        <Label htmlFor="slug">URL</Label>
        <div className={`flex items-center rounded-2xl border bg-white overflow-hidden transition-colors focus-within:border-gray-400 ${fieldError === 'slug' ? 'border-red-400' : 'border-gray-200'}`}>
          <span className="px-4 py-4 text-sm text-gray-400 border-r border-gray-200 shrink-0 bg-gray-50">
            /space/
          </span>
          <input
            id="slug"
            type="text"
            required
            value={slug}
            onChange={e => handleSlugChange(e.target.value)}
            placeholder="otis-studio"
            className="flex-1 bg-transparent px-4 py-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
          />
        </div>
        {fieldError === 'slug' && error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : (
          <p className="text-xs text-gray-400">
            Lowercase letters, numbers, and hyphens only.
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="font-normal text-gray-400">(optional)</span>
        </Label>
        <Textarea
          id="description"
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="A short description your members will see."
        />
      </div>

      {/* Generic error (not tied to a field) */}
      {error && !fieldError && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isPending || !spaceType || !name.trim() || !slug.trim()}
      >
        {isPending ? 'Creating…' : 'Create Space'}
      </Button>
    </form>
  );
}
