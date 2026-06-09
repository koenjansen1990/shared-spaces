'use client';

import React, { useState } from 'react';
import { generateInviteLink } from '@/lib/actions/profile';
import { createHolidayBooking, cancelHolidayBooking, updateHolidayBookingNote } from '@/lib/actions/holiday';

// ── Types ─────────────────────────────────────────────────────

export interface HolidayBooking {
  id:       string;
  userId:   string;
  checkIn:  string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD' inclusive
  note?:    string | null;
}

export interface HolidayProfile {
  id:           string;
  display_name: string | null;
  avatar_url:   string | null;
}

export interface HolidaySpaceInfo {
  name:           string;
  welcomeMessage: string | null;
  address:        string | null;
  heroImageUrl:   string | null;
}

export interface HolidayMemberInfo {
  userId:      string;
  displayName: string | null;
  avatarUrl:   string | null;
}

interface Props {
  userId:        string;
  spaceId:       string;
  spaceSlug:     string;
  isAdmin:       boolean;
  bookings:      HolidayBooking[];
  profiles:      HolidayProfile[];
  spaceInfo:     HolidaySpaceInfo;
  membersList:   HolidayMemberInfo[];
  nightsPerYear?: number;
}

// ── Styles — matches WeeklyCalendar slot states ────────────────

const BAND_STYLE = {
  background:   'linear-gradient(191deg, #F7F7F7 0%, #F0F0F0 100%)',
  borderTop:    '1px solid #EEE',
  borderBottom: '1px solid #EEE',
};

// ── Helpers ───────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500',
];

function avatarColorClass(userId: string): string {
  let n = 0;
  for (const c of userId) n += c.charCodeAt(0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function getInitials(name: string | null, fallback: string): string {
  return (name ?? fallback).trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildMonthGrid(month: Date): (Date | null)[] {
  const year  = month.getFullYear();
  const mon   = month.getMonth();
  const first = new Date(year, mon, 1);
  const last  = new Date(year, mon + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, mon, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── InviteCopyButton ──────────────────────────────────────────

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

// ── HolidayModal ─────────────────────────────────────────────

type ModalState =
  | { mode: 'new';      checkIn: string }
  | { mode: 'existing'; booking: HolidayBooking };

function HolidayModal({
  modal, userId, spaceId, profiles, nightsRemaining, onBooked, onUpdated, onCancelled, onClose,
}: {
  modal:          ModalState;
  userId:         string;
  spaceId:        string;
  profiles:       HolidayProfile[];
  nightsRemaining: number;
  onBooked:       (booking: HolidayBooking) => void;
  onUpdated:      (booking: HolidayBooking) => void;
  onCancelled:    (id: string) => void;
  onClose:        () => void;
}) {
  const isNew    = modal.mode === 'new';
  const existing = isNew ? null : modal.booking;
  const isMine   = existing?.userId === userId;
  const profile  = existing ? profiles.find(p => p.id === existing.userId) : null;

  const myProfile  = profiles.find(p => p.id === userId);
  const myInitials = myProfile?.display_name
    ? myProfile.display_name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const [checkIn,  setCheckIn]  = useState(isNew ? modal.checkIn : existing!.checkIn);
  const [checkOut, setCheckOut] = useState(isNew ? modal.checkIn : existing!.checkOut);
  const [note,     setNote]     = useState(isNew ? '' : (existing?.note ?? ''));
  const [pending,  setPending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const originalNote = isNew ? '' : (existing?.note ?? '');
  const noteChanged  = !isNew && isMine && note !== originalNote;

  const nights = Math.max(0, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  )) + 1;

  const checkInLabel  = new Date(checkIn  + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const checkOutLabel = new Date(checkOut + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  // Format date as dd/mm/yyyy for display in inputs
  function formatDateDisplay(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  async function handleBook() {
    if (checkOut < checkIn) { setError('Check-out must be after check-in.'); return; }
    setPending(true); setError(null);
    const r = await createHolidayBooking(spaceId, checkIn, checkOut, note);
    setPending(false);
    if (!r.success) { setError(r.error); return; }
    onBooked({ id: r.id, userId, checkIn, checkOut, note: note.trim() || null });
    onClose();
  }

  async function handleSaveNote() {
    if (!existing) return;
    setPending(true); setError(null);
    const r = await updateHolidayBookingNote(existing.id, note);
    setPending(false);
    if (!r.success) { setError(r.error); return; }
    onUpdated({ ...existing, note: note.trim() || null });
    onClose();
  }

  async function handleCancel() {
    if (!existing) return;
    setPending(true);
    const r = await cancelHolidayBooking(existing.id);
    setPending(false);
    if (!r.success) { setError(r.error); return; }
    onCancelled(existing.id);
    onClose();
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

        {/* Header */}
        {isNew ? (
          <div>
            <p className="text-sm text-gray-400">New booking</p>
            <h2 className="text-3xl font-bold text-gray-900 mt-0.5">Pick your dates</h2>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden ${profile?.avatar_url ? '' : avatarColorClass(existing!.userId)}`}>
              {profile?.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : getInitials(profile?.display_name ?? null, existing!.userId)
              }
            </div>
            <div>
              <p className="text-sm text-gray-400">Booked by</p>
              <h2 className="text-2xl font-bold text-gray-900">{profile?.display_name ?? 'Member'}</h2>
            </div>
          </div>
        )}

        {/* Date range */}
        {isNew ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Check-in</label>
                <div className="relative">
                  <input
                    type="date"
                    value={checkIn}
                    min={toDateStr(new Date())}
                    onChange={e => { setCheckIn(e.target.value); if (e.target.value > checkOut) setCheckOut(e.target.value); }}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Check-out</label>
                <div className="relative">
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn}
                    onChange={e => setCheckOut(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Nights + remaining pill */}
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
              <span className="text-sm font-medium text-gray-900">{nights} night{nights !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">{nightsRemaining} days left this year</span>
                {myProfile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={myProfile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-white" />
                ) : (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-1 ring-white ${avatarColorClass(userId)}`}>
                    {myInitials}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Check-in</span>
              <span className="font-medium text-gray-900">{checkInLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Check-out</span>
              <span className="font-medium text-gray-900">{checkOutLabel}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
              <span className="text-gray-400">Duration</span>
              <span className="font-medium text-gray-900">{nights} night{nights !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Note */}
        {isNew || isMine ? (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Leave a note..."
            rows={2}
            className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
          />
        ) : (
          existing?.note
            ? <p className="text-sm text-gray-600 bg-gray-50 rounded-2xl px-4 py-3">{existing.note}</p>
            : null
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="space-y-2">
          {isNew ? (
            <button
              onClick={handleBook}
              disabled={pending || checkOut < checkIn}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors font-semibold text-base"
            >
              {pending ? 'Booking…' : `Book ${nights} night${nights !== 1 ? 's' : ''}`}
            </button>
          ) : isMine ? (
            <>
              {noteChanged && (
                <button
                  onClick={handleSaveNote}
                  disabled={pending}
                  className="w-full py-4 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors font-semibold text-base"
                >
                  {pending ? 'Saving…' : 'Save note'}
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={pending}
                className="w-full py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors font-semibold"
              >
                {pending ? 'Cancelling…' : 'Cancel booking'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function HolidayCalendar({
  userId, spaceId, spaceSlug, isAdmin,
  bookings: initialBookings,
  profiles,
  spaceInfo,
  membersList,
  nightsPerYear = 30,
}: Props) {
  const [bookings,     setBookings]     = useState(initialBookings);
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [modal,        setModal]        = useState<ModalState | null>(null);

  const todayStr    = toDateStr(new Date());
  const cells       = buildMonthGrid(currentMonth);
  const periodLabel = currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  function findBooking(ds: string) {
    return bookings.find(b => b.checkIn <= ds && ds <= b.checkOut);
  }

  function handleBooked(booking: HolidayBooking) {
    setBookings(prev => [...prev, booking]);
  }

  function handleUpdated(booking: HolidayBooking) {
    setBookings(prev => prev.map(b => b.id === booking.id ? booking : b));
  }

  function handleCancelled(id: string) {
    setBookings(prev => prev.filter(b => b.id !== id));
  }

  // Nights used this year per member
  const yearStr       = String(new Date().getFullYear());
  const myNightsUsed  = bookings
    .filter(b => b.userId === userId && b.checkIn.startsWith(yearStr))
    .reduce((sum, b) => sum + Math.round((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86400000) + 1, 0);
  const myNightsLeft  = Math.max(0, nightsPerYear - myNightsUsed);
  function getNightsUsed(memberId: string): number {
    return bookings
      .filter(b => b.userId === memberId && b.checkIn.startsWith(yearStr))
      .reduce((sum, b) => {
        const nights = Math.round(
          (new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86400000
        ) + 1;
        return sum + nights;
      }, 0);
  }

  return (
    <div className="flex gap-3 h-full">

      {/* ── Calendar panel ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 overflow-hidden">

        {/* Toolbar */}
        <div className="flex-none flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg"
            >‹</button>
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg"
            >›</button>
            <h2 className="text-base font-semibold text-gray-900 ml-1">{periodLabel}</h2>
          </div>
          <button
            onClick={() => setCurrentMonth(() => { const d = new Date(); d.setDate(1); return d; })}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Month grid */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Day-of-week headers */}
          <div className="flex-none grid grid-cols-7 border-b border-gray-100" style={{ height: '3rem' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="h-full flex items-center justify-center text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="flex-1 grid grid-cols-7 min-h-0" style={{ gridTemplateRows: `repeat(${cells.length / 7}, 1fr)` }}>
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="border-b border-r border-gray-50" />;

              const ds       = toDateStr(date);
              const booking  = findBooking(ds);
              const isCI     = booking?.checkIn  === ds;
              const isCO     = booking?.checkOut === ds;
              const isMid    = !!(booking && !isCI && !isCO);
              const isSingle = !!(booking && booking.checkIn === booking.checkOut);
              const isToday  = ds === todayStr;
              const profile  = booking ? profiles.find(p => p.id === booking.userId) : null;

              // Band border-radius — same as slot cell selected state
              let borderRadius = '10px';
              if (booking && !isSingle) {
                if (isCI)      borderRadius = '10px 0 0 10px';
                else if (isCO) borderRadius = '0 10px 10px 0';
                else           borderRadius = '0';
              }

              const bandStyle: React.CSSProperties = booking ? {
                ...BAND_STYLE,
                borderRadius,
                borderLeft:  (!isMid && !isCO) ? '1px solid #EEE' : 'none',
                borderRight: (!isMid && !isCI) ? '1px solid #EEE' : 'none',
              } : {};

              return (
                <div
                  key={ds}
                  className="relative p-2 flex flex-col border-b border-r border-gray-50 transition-colors cursor-pointer hover:bg-gray-50"
                  onClick={() => setModal(booking ? { mode: 'existing', booking } : { mode: 'new', checkIn: ds })}
                >
                  {/* Date number */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`text-sm font-semibold leading-none ${isToday ? 'text-gray-900' : 'text-gray-500'}`}>
                      {date.getDate()}
                    </span>
                    {isToday && <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />}
                  </div>

                  {/* Booking band */}
                  {booking && (
                    <div
                      className="absolute left-0 right-0 flex items-center px-2"
                      style={{ ...bandStyle, top: '2rem', height: '2rem' }}
                    >
                      {isCI && (
                        <>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white overflow-hidden shrink-0 mr-1.5 ${profile?.avatar_url ? '' : avatarColorClass(booking.userId)}`}>
                            {profile?.avatar_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              : getInitials(profile?.display_name ?? null, booking.userId)
                            }
                          </div>
                          <span className="text-xs font-medium text-gray-700 truncate">
                            {profile?.display_name?.split(' ')[0] ?? ''}
                            {booking.note ? ' 💬' : ''}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Side panel ───────────────────────────────────────── */}
      <div className="w-72 xl:w-80 flex-shrink-0 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
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

          {spaceInfo.address && (
            <div className="px-5 py-5 space-y-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Location</p>
              <div className="space-y-1.5">
                <p className="text-sm text-gray-700 whitespace-pre-line leading-snug">{spaceInfo.address}</p>
                <a
                  href={`https://maps.google.com/maps?q=${encodeURIComponent(spaceInfo.address.replace(/\n/g, ', '))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  View on map →
                </a>
              </div>
            </div>
          )}
        </div>

        <div>
          <hr className="border-gray-100 mx-5" />
          <div className="p-5 space-y-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Members</p>
            <div className="space-y-3">
              {membersList.map(m => (
                <div key={m.userId} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden ${m.avatarUrl ? '' : avatarColorClass(m.userId)}`}>
                    {m.avatarUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : getInitials(m.displayName, m.userId)}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{m.displayName ?? 'Unknown'}</span>
                  <span className="text-xs text-gray-400 tabular-nums shrink-0">{getNightsUsed(m.userId)}n this year</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 pb-5">
            <InviteCopyButton spaceId={spaceId} />
          </div>
        </div>
      </div>

      {modal && (
        <HolidayModal
          modal={modal}
          userId={userId}
          spaceId={spaceId}
          profiles={profiles}
          nightsRemaining={myNightsLeft}
          onBooked={handleBooked}
          onUpdated={handleUpdated}
          onCancelled={handleCancelled}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
