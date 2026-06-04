'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSlot } from '@/lib/actions/slot';
import type { ResourceWithSlots } from '@/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  resource: ResourceWithSlots;
  spaceId:  string;
  isAdmin:  boolean;
}

export default function ResourceCard({ resource, spaceId, isAdmin }: Props) {
  const router = useRouter();
  const [addingSlot, setAddingSlot] = useState(false);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-4">
      {/* Header */}
      <div>
        <h2 className="font-semibold text-neutral-100">{resource.name}</h2>
        {resource.description && (
          <p className="text-xs text-neutral-500 mt-0.5">{resource.description}</p>
        )}
      </div>

      {/* Slot list */}
      {resource.slots.length > 0 ? (
        <ul className="space-y-1.5">
          {resource.slots.filter(s => s.is_active).map(slot => (
            <li key={slot.id} className="flex items-center justify-between text-xs">
              <span className="text-neutral-300">
                {slot.slot_type === 'recurring'
                  ? `Every ${DAYS[slot.recurrence_day!]}`
                  : slot.event_date}
                {' '}
                <span className="text-neutral-500">
                  {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                </span>
              </span>
              <span className="text-neutral-600">
                {slot.credit_cost}cr · {slot.max_capacity} seat{slot.max_capacity !== 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-neutral-600">No slots configured.</p>
      )}

      {/* Add slot */}
      {isAdmin && (
        addingSlot
          ? <AddSlotForm
              resourceId={resource.id}
              spaceId={spaceId}
              onDone={() => { setAddingSlot(false); router.refresh(); }}
              onCancel={() => setAddingSlot(false)}
            />
          : <button
              onClick={() => setAddingSlot(true)}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              + Add slot
            </button>
      )}
    </section>
  );
}

// ── Inline slot form ─────────────────────────────────────────

interface SlotFormProps {
  resourceId: string;
  spaceId:    string;
  onDone:     () => void;
  onCancel:   () => void;
}

function AddSlotForm({ resourceId, spaceId, onDone, onCancel }: SlotFormProps) {
  const [slotType,      setSlotType]      = useState<'recurring' | 'event'>('recurring');
  const [day,           setDay]           = useState(1); // Monday
  const [eventDate,     setEventDate]     = useState('');
  const [startTime,     setStartTime]     = useState('18:00');
  const [endTime,       setEndTime]       = useState('22:00');
  const [capacity,      setCapacity]      = useState(1);
  const [creditCost,    setCreditCost]    = useState(1);
  const [error,         setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }

    startTransition(async () => {
      const result = await createSlot({
        resource_id:    resourceId,
        space_id:       spaceId,
        slot_type:      slotType,
        recurrence_day: slotType === 'recurring' ? day : undefined,
        event_date:     slotType === 'event' ? eventDate : undefined,
        start_time:     startTime,
        end_time:       endTime,
        max_capacity:   capacity,
        credit_cost:    creditCost,
      });

      if (!result.success) {
        setError(result.error ?? 'Something went wrong.');
        return;
      }
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit}
      className="border-t border-neutral-800 pt-3 space-y-3">

      {/* Type toggle */}
      <div className="flex gap-2">
        {(['recurring', 'event'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setSlotType(t)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors
              ${slotType === t
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            {t === 'recurring' ? 'Recurring' : 'One-off event'}
          </button>
        ))}
      </div>

      {/* Day / date */}
      {slotType === 'recurring' ? (
        <div className="space-y-1">
          <label className="block text-xs text-neutral-400">Day of week</label>
          <select
            value={day}
            onChange={e => setDay(Number(e.target.value))}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                       text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          >
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="block text-xs text-neutral-400">Date</label>
          <input
            type="date"
            required
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                       text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          />
        </div>
      )}

      {/* Time range */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="block text-xs text-neutral-400">Start</label>
          <input
            type="time"
            required
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                       text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="block text-xs text-neutral-400">End</label>
          <input
            type="time"
            required
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                       text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Capacity + credits */}
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="block text-xs text-neutral-400">Max seats</label>
          <input
            type="number"
            min={1}
            max={20}
            required
            value={capacity}
            onChange={e => setCapacity(Number(e.target.value))}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                       text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="block text-xs text-neutral-400">Credit cost</label>
          <input
            type="number"
            min={0}
            max={20}
            required
            value={creditCost}
            onChange={e => setCreditCost(Number(e.target.value))}
            className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5
                       text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-neutral-100 px-4 py-1.5 text-xs font-semibold
                     text-neutral-900 hover:bg-white disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : 'Save slot'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-4 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
