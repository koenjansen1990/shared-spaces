'use client';

import { useState } from 'react';
import { createBooking } from '@/lib/actions/booking';
import type { BookingErrorCode } from '@/types';

const ERROR_MESSAGES: Record<BookingErrorCode, string> = {
  UNAUTHENTICATED:     'You must be logged in.',
  SLOT_NOT_FOUND:      'This slot no longer exists.',
  NOT_A_MEMBER:        'You are not a member of this space.',
  ALREADY_BOOKED:      'You already have this slot booked.',
  SLOT_FULL:           'This slot is fully booked.',
  INSUFFICIENT_CREDITS:'You have used all your credits for this week.',
  CONFLICT:            'Someone else just took the last spot. Try again.',
  INTERNAL_ERROR:      'Something went wrong. Please try again.',
};

interface Props {
  slotId:      string;
  bookingDate?: string;  // ISO date; defaults to today
}

export default function BookSlotButton({ slotId, bookingDate }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleBook() {
    setState('loading');
    setErrorMsg(null);

    const date = bookingDate ?? new Date().toISOString().slice(0, 10);
    const result = await createBooking({ slot_id: slotId, booking_date: date });

    if (result.success) {
      setState('success');
    } else {
      setState('error');
      setErrorMsg(ERROR_MESSAGES[result.error as BookingErrorCode] ?? result.error);
    }
  }

  if (state === 'success') {
    return <span className="text-xs text-green-400 font-medium">Booked</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleBook}
        disabled={state === 'loading'}
        className="text-xs px-3 py-1 rounded bg-neutral-700 hover:bg-neutral-600
                   text-neutral-100 transition-colors disabled:opacity-50"
      >
        {state === 'loading' ? '…' : 'Book'}
      </button>
      {state === 'error' && errorMsg && (
        <p className="text-xs text-red-400 max-w-[16rem] text-right">{errorMsg}</p>
      )}
    </div>
  );
}
