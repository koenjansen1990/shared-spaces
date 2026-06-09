'use client';

import React, { useState, useCallback } from 'react';
import { createBooking, cancelBooking, cancelMyBookingsForDate, updateBookingNote } from '@/lib/actions/booking';
import { generateInviteLink } from '@/lib/actions/profile';
import type { Slot, Booking } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildMonthGrid(anchor: Date): Date[] {
  const year  = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const grid: Date[] = [];
  for (let i = startPad; i > 0; i--) grid.push(addDays(first, -i));
  for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(year, month, d));
  const endPad = 42 - grid.length;
  for (let i = 1; i <= endPad; i++) grid.push(addDays(last, i));
  return grid;
}

function firstName(name: string | null): string {
  if (!name) return 'Unknown';
  return name.trim().split(/\s+/)[0];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SLOT_STYLE = {
  default:  { background: 'linear-gradient(11deg, #FAFAFA 0%, #FFF 100%)', border: '1px solid #EEE', borderRadius: '12px' },
  hover:    { background: '#FAFAFA',                                        border: '1px solid #EEE', borderRadius: '12px' },
  selected: { background: 'linear-gradient(191deg, #F7F7F7 0%, #F0F0F0 100%)', border: '1px solid #EEE', borderRadius: '12px' },
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500',
];
function avatarColor(userId: string): string {
  let n = 0;
  for (let i = 0; i < userId.length; i++) n += userId.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function isAllDay(slot: Slot): boolean {
  return slot.start_time.startsWith('00:00') && (slot.end_time.startsWith('23:59') || slot.end_time.startsWith('24:00'));
}

function slotLabel(slot: Slot): string {
  if (isAllDay(slot)) return 'Full day';
  return Number(slot.start_time.slice(0, 2)) < 13 ? 'Morning' : 'Afternoon';
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ profile, size = 'sm' }: { profile?: CalendarProfile; size?: 'xs' | 'sm' | 'md' }) {
  const initials = profile?.display_name
    ? profile.display_name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const dim   = size === 'md' ? 'w-8 h-8 text-xs' : size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-4 h-4 text-[8px]';
  const color = avatarColor(profile?.id ?? '');
  if (profile?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatar_url} alt={initials} className={`${dim} rounded-full object-cover ring-1 ring-white`} />
    );
  }
  return (
    <div className={`${dim} rounded-full ${color} flex items-center justify-center text-white font-semibold ring-1 ring-white`}>
      {initials}
    </div>
  );
}

function AvatarStack({ userIds, profiles, max = 3 }: { userIds: string[]; profiles: CalendarProfile[]; max?: number }) {
  const shown  = userIds.slice(0, max);
  const extra  = userIds.length - shown.length;
  const lookup = new Map(profiles.map(p => [p.id, p]));
  return (
    <div className="flex items-center">
      {shown.map((id, i) => (
        <div key={id} style={{ marginLeft: i > 0 ? '-4px' : 0, zIndex: shown.length - i }} className="relative">
          <Avatar profile={lookup.get(id)} size="xs" />
        </div>
      ))}
      {extra > 0 && (
        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[7px] font-semibold text-gray-600 ring-1 ring-white ml-[-4px]">
          +{extra}
        </div>
      )}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ModalSlot = {
  slot:          Slot;
  date:          string;
  booking:       CalendarBooking | null;
  count:         number;
  myDayBookings: CalendarBooking[];
};

type BookedCallback = (slotId: string, date: string, bookingId: string | false, note?: string | null) => void;

const BOOKING_ERRORS: Record<string, string> = {
  ALREADY_BOOKED:       'You already have this booked.',
  SLOT_FULL:            'This slot is full.',
  INSUFFICIENT_CREDITS: 'Not enough hours left this week.',
  NOT_A_MEMBER:         'You\'re not a member of this space.',
  INTERNAL_ERROR:       'Something went wrong. Try again.',
};

// ── SlotCell ───────────────────────────────────────────────────────────────────

function SlotCell({ children, gridStyle, selected, onClick }: {
  children:  React.ReactNode;
  gridStyle: React.CSSProperties;
  selected:  boolean;
  onClick:   () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const style = selected ? SLOT_STYLE.selected : hovered ? SLOT_STYLE.hover : SLOT_STYLE.default;
  return (
    <div style={gridStyle} className="p-1">
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={style}
        className="w-full h-full px-3 py-3 text-left flex flex-col transition-all"
      >
        {children}
      </button>
    </div>
  );
}

function MonthSlotButton({ children, selected, onClick }: {
  children: React.ReactNode;
  selected: boolean;
  onClick:  () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const style = selected ? SLOT_STYLE.selected : hovered ? SLOT_STYLE.hover : SLOT_STYLE.default;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={style}
      className="w-full text-left px-2 py-1.5 transition-all"
    >
      {children}
    </button>
  );
}

// ── InviteCopyButton ───────────────────────────────────────────────────────────

function InviteCopyButton({ spaceId }: { spaceId: string }) {
  const [loading, setLoading] = useState(false);
  const [copied,  setCopied]  = useState(false);

  async function handleCopy() {
    setLoading(true);
    const r = await generateInviteLink(spaceId);
    setLoading(false);
    if (!r.success || !r.token) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${r.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      disabled={loading}
      className={`w-full text-center py-2.5 rounded-xl text-sm font-medium transition-colors border
        ${copied
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
          : 'text-gray-500 hover:bg-gray-100 border-gray-200 disabled:opacity-40'}`}
    >
      {loading ? 'Generating…' : copied ? '✓ Link copied' : 'Copy invite link'}
    </button>
  );
}

// ── SlotModal ──────────────────────────────────────────────────────────────────

function SlotModal({ item, onClose, onBooked, onNoteUpdated, userId, spaceId, profiles, weeklyRemaining }: {
  item:            ModalSlot;
  onClose:         () => void;
  onBooked:        BookedCallback;
  onNoteUpdated:   (bookingId: string, note: string | null) => void;
  userId:          string;
  spaceId:         string;
  profiles:        CalendarProfile[];
  weeklyRemaining: number;
}) {
  const { slot, date, booking, myDayBookings } = item;
  const hours     = slot.credit_cost;
  const isMine    = !!booking && booking.user_id === userId;
  const booked    = !!booking && booking.status === 'confirmed';
  const canAfford = booked || weeklyRemaining >= hours;

  const originalNote = booking?.notes ?? '';
  const [pending, setPending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [note,    setNote]    = useState(originalNote);

  const noteChanged = isMine && note !== originalNote;

  const myProfile = profiles.find(p => p.id === userId);
  const myInitials = myProfile?.display_name
    ? myProfile.display_name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  async function handleBook() {
    setPending(true); setError(null);
    const savedNote = note.trim() || null;
    const r = await createBooking({ slot_id: slot.id, booking_date: date, notes: savedNote });
    setPending(false);
    if (r.success) { onBooked(slot.id, date, r.booking_id, savedNote); onClose(); }
    else if (r.error === 'CONFLICT') setError('conflict');
    else setError(BOOKING_ERRORS[r.error] ?? r.error);
  }

  async function handleSaveNote() {
    if (!booking) return;
    setPending(true); setError(null);
    const r = await updateBookingNote(booking.id, note);
    setPending(false);
    if (!r.success) { setError(r.error ?? 'Something went wrong.'); return; }
    onNoteUpdated(booking.id, note.trim() || null);
    onClose();
  }

  async function handleSwap() {
    setPending(true); setError(null);
    const cancel = await cancelMyBookingsForDate(spaceId, date);
    if (!cancel.success) { setPending(false); setError('Could not cancel existing bookings.'); return; }
    for (const b of myDayBookings) onBooked(b.slot_id, date, false);
    const r = await createBooking({ slot_id: slot.id, booking_date: date });
    setPending(false);
    if (r.success) { onBooked(slot.id, date, r.booking_id); onClose(); }
    else setError(BOOKING_ERRORS[r.error] ?? r.error);
  }

  async function handleCancel() {
    if (!booking) return;
    setPending(true);
    const r = await cancelBooking(booking.id);
    setPending(false);
    if (r.success) { onBooked(slot.id, date, false); onClose(); }
    else setError(r.error ?? 'Something went wrong.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-sm bg-white border border-gray-200 shadow-xl
                   rounded-t-3xl sm:rounded-3xl p-6 space-y-5
                   animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden w-10 h-1 bg-gray-200 rounded-full mx-auto -mt-1 mb-1" />

        {/* X close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </button>

        <div>
          <p className="text-sm text-gray-400">{dateLabel}</p>
          <h2 className="text-3xl font-bold text-gray-900 mt-0.5">{slotLabel(slot)}</h2>
        </div>

        {/* Info pill */}
        <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
          <span className="text-sm font-medium text-gray-900">{hours} hour{hours !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${canAfford ? 'text-gray-400' : 'text-red-500'}`}>
              {booked
                ? `${weeklyRemaining}h left this week`
                : canAfford
                  ? `${weeklyRemaining}h left this week`
                  : `Need ${hours}h, have ${weeklyRemaining}h`}
            </span>
            {myProfile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={myProfile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-white" />
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-1 ring-white ${avatarColor(userId)}`}>
                {myInitials}
              </div>
            )}
          </div>
        </div>

        {/* Note — all states */}
        {error !== 'conflict' && (
          !booked || isMine ? (
            // New booking or my existing booking: single editable textarea
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Leave a note…"
              rows={2}
              className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />
          ) : booking?.notes ? (
            // Someone else's booking: read-only bubble
            <div className="flex gap-2 items-start">
              {(() => {
                const p = profiles.find(pp => pp.id === booking.user_id);
                const initials = p?.display_name?.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
                return p?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
                ) : (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0 mt-0.5 ${avatarColor(booking.user_id)}`}>
                    {initials}
                  </div>
                );
              })()}
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 flex-1">
                <p className="text-sm text-gray-800 leading-snug">{booking.notes}</p>
              </div>
            </div>
          ) : null
        )}

        {error && error !== 'conflict' && <p className="text-red-500 text-sm">{error}</p>}

        <div className="space-y-2">
          {error === 'conflict' ? (
            <>
              <p className="text-sm text-gray-500 pb-1">
                {myDayBookings.length > 0
                  ? 'You have a half-day booked. Switch to full day?'
                  : 'You already have a booking for this date. Switch?'}
              </p>
              <button onClick={handleSwap} disabled={pending}
                className="w-full py-4 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors font-semibold text-base">
                {pending ? 'Switching…' : 'Switch to full day'}
              </button>
            </>
          ) : booked && isMine ? (
            <>
              {noteChanged && (
                <button onClick={handleSaveNote} disabled={pending}
                  className="w-full py-4 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors font-semibold text-base">
                  {pending ? 'Saving…' : 'Save note'}
                </button>
              )}
              <button onClick={handleCancel} disabled={pending}
                className="w-full py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors font-semibold">
                {pending ? 'Cancelling…' : 'Cancel booking'}
              </button>
            </>
          ) : !booked ? (
            <button onClick={handleBook} disabled={pending || !canAfford}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors font-semibold text-base">
              {pending ? 'Booking…' : !canAfford ? 'Not enough hours' : 'Book slot'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Exports ────────────────────────────────────────────────────────────────────

export type CalendarSlot    = Slot & { resource_name: string };
export type CalendarBooking = Pick<Booking, 'id' | 'slot_id' | 'booking_date' | 'user_id' | 'status' | 'credits_consumed' | 'notes'>;
export type CalendarProfile = { id: string; display_name: string | null; avatar_url: string | null };
export type SpaceInfo       = { name: string; welcomeMessage: string | null; address: string | null; heroImageUrl: string | null };
export type MemberInfo      = { userId: string; displayName: string | null; avatarUrl: string | null; weeklyAllowance: number };

interface Props {
  slots:           CalendarSlot[];
  bookings:        CalendarBooking[];
  profiles:        CalendarProfile[];
  userId:          string;
  isAdmin:         boolean;
  spaceSlug:       string;
  spaceId:         string;
  weeklyAllowance: number;
  weeklyUsed:      number;
  spaceInfo:       SpaceInfo;
  membersList:     MemberInfo[];
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function WeeklyCalendar({
  slots, bookings: initial, profiles, userId, isAdmin, spaceSlug, spaceId,
  weeklyAllowance, weeklyUsed: initialWeeklyUsed, spaceInfo, membersList,
}: Props) {
  const [view,        setView]        = useState<'week' | 'month'>('week');
  const [anchor,      setAnchor]      = useState(() => new Date());
  const [bookings,    setBookings]    = useState(initial);
  const [modal,      setModal]      = useState<ModalSlot | null>(null);
  const [weeklyUsed, setWeeklyUsed] = useState(initialWeeklyUsed);

  const today = toISODate(new Date());

  const handleNoteUpdated = useCallback((bookingId: string, note: string | null) => {
    setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, notes: note } : b));
  }, []);

  const handleBooked = useCallback((slotId: string, date: string, bookingId: string | false, note?: string | null) => {
    const cost = slots.find(s => s.id === slotId)?.credit_cost ?? 0;
    setBookings(prev =>
      bookingId !== false
        ? [...prev, { id: bookingId, slot_id: slotId, booking_date: date, user_id: userId, status: 'confirmed' as const, credits_consumed: cost, notes: note ?? null }]
        : prev.map(b => b.slot_id === slotId && b.booking_date === date && b.user_id === userId
            ? { ...b, status: 'cancelled' as const } : b)
    );
    const bookingDate = new Date(date + 'T12:00:00');
    const now = new Date();
    const ws  = new Date(now);
    ws.setHours(0, 0, 0, 0);
    ws.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    if (bookingDate >= ws && bookingDate <= we) {
      setWeeklyUsed(prev => bookingId !== false ? prev + cost : prev - cost);
    }
  }, [userId, slots]);

  function getBookingsFor(slotId: string, date: string) {
    return bookings.filter(b => b.slot_id === slotId && b.booking_date === date && b.status === 'confirmed');
  }

  function openModal(slot: CalendarSlot, date: Date) {
    const dateStr       = toISODate(date);
    const bs            = getBookingsFor(slot.id, dateStr);
    const myDayBookings = bookings.filter(
      b => b.booking_date === dateStr && b.user_id === userId && b.status === 'confirmed' && b.slot_id !== slot.id
    );
    setModal({ slot, date: dateStr, booking: bs.find(b => b.user_id === userId) ?? null, count: bs.length, myDayBookings });
  }

  function slotsForDay(date: Date): CalendarSlot[] {
    const all  = slots.filter(s => s.recurrence_day === date.getDay());
    const seen = new Set<string>();
    return all.filter(s => { const l = slotLabel(s); if (seen.has(l)) return false; seen.add(l); return true; });
  }

  function prev()    { setAnchor(a => view === 'week' ? addDays(a, -7)   : addMonths(a, -1)); }
  function next()    { setAnchor(a => view === 'week' ? addDays(a, 7)    : addMonths(a, 1)); }
  function goToday() { setAnchor(new Date()); }

  const weekStart   = getWeekStart(anchor);
  const weekDates   = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthGrid   = buildMonthGrid(anchor);
  const anchorMonth = anchor.getMonth();

  const monthlyUsed = bookings
    .filter(b => {
      if (b.status !== 'confirmed' || b.user_id !== userId) return false;
      const d = new Date(b.booking_date);
      return d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchorMonth;
    })
    .reduce((s, b) => s + (b.credits_consumed ?? 0), 0);

  const periodLabel = view === 'week'
    ? weekStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Member weekly used computed from bookings state
  const thisWeekStart = toISODate(getWeekStart(new Date()));
  const thisWeekEnd   = toISODate(addDays(getWeekStart(new Date()), 6));
  function getMemberWeeklyUsed(memberId: string): number {
    if (memberId === userId) return weeklyUsed;
    return bookings
      .filter(b => b.user_id === memberId && b.status === 'confirmed' && b.booking_date >= thisWeekStart && b.booking_date <= thisWeekEnd)
      .reduce((s, b) => s + (b.credits_consumed ?? 0), 0);
  }

  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // ── Hours display values ──────────────────────────────────────────────────
  const allowance = view === 'week' ? weeklyAllowance : weeklyAllowance * 4;
  const used      = view === 'week' ? weeklyUsed      : monthlyUsed;
  const remaining = allowance - used;
  const periodStr = view === 'week' ? 'this week' : 'this month';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-3 h-full">

      {/* ── Hours pill (fixed, next to avatar) ───────────────────────────── */}
      <div
        className="fixed z-40 inline-flex items-center justify-center bg-white border border-gray-200 rounded-full"
        style={{ top: '32px', right: '80px', transform: 'translateY(-50%)', padding: '4px 12px 4px 8px', gap: '4px' }}
      >
        <svg className="w-4 h-4 shrink-0 text-gray-900" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">
          {remaining > 0 ? `${remaining}h left` : 'No hours left'}
        </span>
      </div>

      {/* ── Calendar ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 overflow-hidden">

        {/* Toolbar */}
        <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg">‹</button>
            <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg">›</button>
            <h2 className="text-base font-semibold text-gray-900 ml-1">{periodLabel}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors">
              Today
            </button>
            <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
              {(['week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize
                    ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Week view ────────────────────────────────────────────── */}
        {view === 'week' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-1">

            <div
              className="flex-none grid grid-cols-7"
              style={{ height: '10%', minHeight: '4rem' }}
            >
              {weekDates.map((date, i) => {
                const isToday  = toISODate(date) === today;
                const dateStr  = toISODate(date);
                const daySlots = slotsForDay(date);
                const fullDay  = daySlots.find(s => isAllDay(s));
                const fdBks    = fullDay ? getBookingsFor(fullDay.id, dateStr) : [];

                return (
                  <button
                    key={i}
                    disabled={!fullDay}
                    onClick={() => fullDay && openModal(fullDay, date)}
                    className={`py-3 text-center flex flex-col items-center justify-center h-full
                      ${fullDay ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">{DAY_LABELS[i]}</p>
                    <p className={`text-xl font-semibold mt-0.5 ${isToday ? 'text-gray-900' : 'text-gray-400'}`}>
                      {date.getDate()}
                    </p>
                    {isToday && <div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5" />}
                  </button>
                );
              })}
            </div>

            <div
              className="flex-1 min-h-0"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(2, 1fr)' }}
            >
              {weekDates.flatMap((date, col) => {
                const dateStr  = toISODate(date);
                const daySlots = slotsForDay(date);
                const fullDay  = daySlots.find(s => isAllDay(s));
                const fdBks    = fullDay ? getBookingsFor(fullDay.id, dateStr) : [];
                const fdBooked = fdBks.length > 0;

                // Full day booked — one card spanning both rows
                if (fdBooked && fullDay) {
                  const firstBooker = fdBks[0];
                  const bookerName  = firstBooker ? firstName(profileMap.get(firstBooker.user_id)?.display_name ?? null) : '';
                  const noteText    = firstBooker?.notes ?? null;
                  return [(
                    <SlotCell
                      key={`${col}-fullday`}
                      gridStyle={{ gridColumn: col + 1, gridRow: '1 / span 2' }}
                      selected
                      onClick={() => openModal(fullDay, date)}
                    >
                      <div className="flex flex-col gap-2">
                        <AvatarStack userIds={fdBks.map(b => b.user_id)} profiles={profiles} max={3} />
                        {noteText && (
                          <div className="bg-white/60 rounded-xl px-2.5 py-1.5">
                            <p className="text-xs text-gray-600 leading-snug line-clamp-3">{noteText}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-auto">
                        <p className="text-xs text-gray-400 leading-tight">{bookerName}</p>
                        <p className="text-sm font-semibold text-gray-900 leading-tight">Full day</p>
                      </div>
                    </SlotCell>
                  )];
                }

                // Morning + Afternoon cells
                return (['Morning', 'Afternoon'] as const).map((label, row) => {
                  const slot      = daySlots.find(s => slotLabel(s) === label);
                  if (!slot) return (
                    <div key={`${col}-${label}`} style={{ gridColumn: col + 1, gridRow: row + 1 }} />
                  );
                  const slotBks    = getBookingsFor(slot.id, dateStr);
                  const mine       = slotBks.some(b => b.user_id === userId);
                  const firstBooker= slotBks[0];
                  const bookerName = firstBooker ? firstName(profileMap.get(firstBooker.user_id)?.display_name ?? null) : 'Available';
                  const noteText   = firstBooker?.notes ?? null;
                  return (
                    <SlotCell
                      key={`${col}-${label}`}
                      gridStyle={{ gridColumn: col + 1, gridRow: row + 1 }}
                      selected={mine}
                      onClick={() => openModal(slot, date)}
                    >
                      {slotBks.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <AvatarStack userIds={slotBks.map(b => b.user_id)} profiles={profiles} max={3} />
                          {noteText && (
                            <div className="bg-white/60 rounded-xl px-2.5 py-1.5">
                              <p className="text-xs text-gray-600 leading-snug line-clamp-2">{noteText}</p>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mt-auto pt-1">
                        <p className="text-xs text-gray-400 leading-tight">
                          {slotBks.length > 0 ? bookerName : 'Available'}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 leading-tight">{label}</p>
                      </div>
                    </SlotCell>
                  );
                });
              })}
            </div>

            {slots.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-16">No slots configured yet.</p>
            )}
          </div>
        )}

        {/* ── Month view ───────────────────────────────────────── */}
        {view === 'month' && (
          <div className="flex-1 overflow-auto">
            <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-gray-100 bg-white" style={{ height: '3rem' }}>
              {DAY_LABELS.map((d, i) => (
                <div key={d} className="h-full flex items-center justify-center text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(7rem, 1fr)' }}>
              {monthGrid.map((date, i) => {
                const dateStr  = toISODate(date);
                const isToday  = dateStr === today;
                const inMonth  = date.getMonth() === anchorMonth;
                const daySlots = slotsForDay(date);
                const fullDay  = daySlots.find(s => isAllDay(s));

                return (
                  <div
                    key={i}
                    className={`p-3 flex flex-col gap-2 transition-colors
                      ${inMonth ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-30'}`}
                    onClick={() => inMonth && fullDay && openModal(fullDay, date)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xl font-semibold ${inMonth ? 'text-gray-800' : 'text-gray-300'}`}>{date.getDate()}</span>
                      {isToday && <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />}
                    </div>

                    <div className="flex flex-col gap-0.5" onClick={e => e.stopPropagation()}>
                      {(() => {
                        if (!inMonth) return null;

                        // Full day booked — show single chip
                        const fdBks = fullDay ? getBookingsFor(fullDay.id, dateStr) : [];
                        if (fdBks.length > 0 && fullDay) {
                          const mine     = fdBks.some(b => b.user_id === userId);
                          const noteText = fdBks[0]?.notes ?? null;
                          return (
                            <MonthSlotButton key="fullday" selected={mine} onClick={() => openModal(fullDay, date)}>
                              <span className="flex items-center justify-between gap-1">
                                <span className="truncate text-xs font-medium text-gray-700">
                                  Full day{noteText ? ' · ' + noteText : ''}
                                </span>
                                <AvatarStack userIds={fdBks.map(b => b.user_id)} profiles={profiles} max={2} />
                              </span>
                            </MonthSlotButton>
                          );
                        }

                        // Morning + Afternoon chips
                        return (['Morning', 'Afternoon'] as const)
                          .map(label => daySlots.find(s => slotLabel(s) === label))
                          .filter((slot): slot is CalendarSlot => !!slot)
                          .map(slot => {
                            const slotBks  = getBookingsFor(slot.id, dateStr);
                            const mine     = slotBks.some(b => b.user_id === userId);
                            const noteText = slotBks[0]?.notes ?? null;
                            return (
                              <MonthSlotButton key={slot.id} selected={mine} onClick={() => openModal(slot, date)}>
                                <span className="flex items-center justify-between gap-1">
                                  <span className="truncate text-xs font-medium text-gray-700">
                                    {slotLabel(slot)}{noteText ? ' · ' + noteText : ''}
                                  </span>
                                  {slotBks.length > 0 && (
                                    <AvatarStack userIds={slotBks.map(b => b.user_id)} profiles={profiles} max={2} />
                                  )}
                                </span>
                              </MonthSlotButton>
                            );
                          });
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Side panel ───────────────────────────────────────────────────── */}
      <div className="w-72 xl:w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">

        {/* Top: space info + location (scrollable) */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Space info */}
          <div>
            {spaceInfo.heroImageUrl && (
              <div className="relative" style={{ height: '211px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spaceInfo.heroImageUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, white 100%)' }} />
              </div>
            )}
            <div className="px-5 flex items-center" style={{ height: '64px' }}>
              <h2 className="text-base font-semibold text-gray-900">{spaceInfo.name}</h2>
            </div>
            {spaceInfo.welcomeMessage && (
              <p className="px-5 pb-4 text-sm text-gray-500 leading-relaxed">{spaceInfo.welcomeMessage}</p>
            )}
            <hr className="border-gray-100 mx-5" />
          </div>

          {/* Location */}
          {spaceInfo.address && (
            <div className="px-5 py-5 space-y-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Location</p>
              <div className="space-y-1.5">
                <p className="text-sm text-gray-700 whitespace-pre-line leading-snug">{spaceInfo.address}</p>
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(spaceInfo.address.replace(/\n/g, ', '))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  View on map →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Bottom: members + settings */}
        <div>
          <hr className="border-gray-100 mx-5" />

          {/* Members */}
          <div className="p-5 space-y-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Members</p>
            <div className="space-y-3">
              {membersList.map(m => {
                const used      = getMemberWeeklyUsed(m.userId);
                const remaining = m.weeklyAllowance - used;
                const initials  = m.displayName?.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
                return (
                  <div key={m.userId} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden ${m.avatarUrl ? '' : avatarColor(m.userId)}`}>
                      {m.avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : initials}
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{m.displayName ?? 'Unknown'}</span>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">{remaining}h left</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-5 pb-5">
            <InviteCopyButton spaceId={spaceId} />
          </div>
        </div>
      </div>

      {modal && (
        <SlotModal
          key={`${modal.date}-${modal.slot.id}`}
          item={modal}
          onClose={() => setModal(null)}
          onBooked={handleBooked}
          onNoteUpdated={handleNoteUpdated}
          userId={userId}
          spaceId={spaceId}
          profiles={profiles}
          weeklyRemaining={weeklyAllowance - weeklyUsed}
        />
      )}
    </div>
  );
}
