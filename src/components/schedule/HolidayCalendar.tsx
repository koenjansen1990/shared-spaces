'use client';

import React, { useState } from 'react';
import { generateInviteLink } from '@/lib/actions/profile';

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
  userId:      string;
  spaceId:     string;
  spaceSlug:   string;
  isAdmin:     boolean;
  bookings:    HolidayBooking[];
  profiles:    HolidayProfile[];
  spaceInfo:   HolidaySpaceInfo;
  membersList: HolidayMemberInfo[];
}

// ── Mock data ─────────────────────────────────────────────────

const _today = new Date();
const _y = _today.getFullYear();
const _m = String(_today.getMonth() + 1).padStart(2, '0');

const MOCK_BOOKINGS: HolidayBooking[] = [
  { id: '1', userId: 'mock-1', checkIn: `${_y}-${_m}-05`, checkOut: `${_y}-${_m}-09`, note: 'Bringing the dog 🐕' },
  { id: '2', userId: 'mock-2', checkIn: `${_y}-${_m}-15`, checkOut: `${_y}-${_m}-18` },
  { id: '3', userId: 'mock-3', checkIn: `${_y}-${_m}-22`, checkOut: `${_y}-${_m}-26`, note: 'Birthday week 🎉' },
];

const MOCK_PROFILES: HolidayProfile[] = [
  { id: 'mock-1', display_name: 'Koen', avatar_url: null },
  { id: 'mock-2', display_name: 'Emma', avatar_url: null },
  { id: 'mock-3', display_name: 'Lars',  avatar_url: null },
];

const MOCK_MEMBERS: HolidayMemberInfo[] = [
  { userId: 'mock-1', displayName: 'Koen', avatarUrl: null },
  { userId: 'mock-2', displayName: 'Emma', avatarUrl: null },
  { userId: 'mock-3', displayName: 'Lars',  avatarUrl: null },
];

// ── Helpers ───────────────────────────────────────────────────

const BOOKING_COLORS = [
  { bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8' },
  { bg: '#EDE9FE', border: '#C4B5FD', text: '#6D28D9' },
  { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46' },
  { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E' },
  { bg: '#FCE7F3', border: '#F9A8D4', text: '#9D174D' },
  { bg: '#CFFAFE', border: '#67E8F9', text: '#155E75' },
];

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-amber-500',
];

function avatarColorClass(userId: string): string {
  let n = 0;
  for (const c of userId) n += c.charCodeAt(0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function bookingColor(userId: string) {
  let n = 0;
  for (const c of userId) n += c.charCodeAt(0);
  return BOOKING_COLORS[n % BOOKING_COLORS.length];
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
  modal, userId, profiles, onClose,
}: {
  modal:    ModalState;
  userId:   string;
  profiles: HolidayProfile[];
  onClose:  () => void;
}) {
  const isNew      = modal.mode === 'new';
  const existing   = isNew ? null : modal.booking;
  const isMine     = existing?.userId === userId;
  const profile    = existing ? profiles.find(p => p.id === existing.userId) : null;
  const color      = existing ? bookingColor(existing.userId) : null;

  const [checkIn,  setCheckIn]  = useState(isNew ? modal.checkIn : existing!.checkIn);
  const [checkOut, setCheckOut] = useState(isNew ? modal.checkIn : existing!.checkOut);
  const [note,     setNote]     = useState(isNew ? '' : (existing?.note ?? ''));
  const [pending,  setPending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // Night count
  const nights = Math.max(0, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000
  )) + 1;

  const checkInLabel = new Date(checkIn + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const checkOutLabel = new Date(checkOut + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  async function handleBook() {
    if (checkOut < checkIn) { setError('Check-out must be after check-in.'); return; }
    setPending(true); setError(null);
    // TODO: wire to server action
    console.log('Booking:', checkIn, '→', checkOut, note);
    setPending(false);
    onClose();
  }

  async function handleCancel() {
    setPending(true);
    // TODO: wire to server action
    console.log('Cancel booking:', existing?.id);
    setPending(false);
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

        {/* Header */}
        {isNew ? (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest">New booking</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-0.5">Choose your dates</h2>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden"
              style={{ backgroundColor: color!.text }}
            >
              {profile?.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : getInitials(profile?.display_name ?? null, existing!.userId)
              }
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest">Booked by</p>
              <h2 className="text-xl font-bold text-gray-900">{profile?.display_name ?? 'Member'}</h2>
            </div>
          </div>
        )}

        {/* Date range */}
        {isNew ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-widest">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  min={toDateStr(new Date())}
                  onChange={e => { setCheckIn(e.target.value); if (e.target.value > checkOut) setCheckOut(e.target.value); }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-widest">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={e => setCheckOut(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-400 transition-colors"
                />
              </div>
            </div>
            <p className="text-sm text-gray-400 text-center">
              {checkOut >= checkIn ? <><strong className="text-gray-700">{nights}</strong> night{nights !== 1 ? 's' : ''}</> : null}
            </p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Check-in</span>
              <span className="font-medium text-gray-900">{checkInLabel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Check-out</span>
              <span className="font-medium text-gray-900">{checkOutLabel}</span>
            </div>
            <div className="flex justify-between text-sm pt-1 border-t border-gray-200 mt-1">
              <span className="text-gray-400">Duration</span>
              <span className="font-medium text-gray-900">{nights} night{nights !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-widest">
            {isNew ? 'Leave a note' : 'Note'}
          </label>
          {isNew || isMine ? (
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Bringing the dog 🐕, Birthday week 🎉…"
              rows={2}
              readOnly={!isNew && !isMine}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-400 transition-colors resize-none"
            />
          ) : (
            existing?.note
              ? <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5">{existing.note}</p>
              : <p className="text-sm text-gray-300 italic">No note left.</p>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="space-y-2">
          {isNew ? (
            <button
              onClick={handleBook}
              disabled={pending || checkOut < checkIn}
              className="w-full py-4 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors font-semibold text-base"
            >
              {pending ? 'Booking…' : `Book · ${nights} night${nights !== 1 ? 's' : ''}`}
            </button>
          ) : isMine ? (
            <button
              onClick={handleCancel}
              disabled={pending}
              className="w-full py-4 rounded-2xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors font-semibold"
            >
              {pending ? 'Cancelling…' : 'Cancel booking'}
            </button>
          ) : null}
          <button onClick={onClose} className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function HolidayCalendar({
  userId, spaceId, spaceSlug, isAdmin,
  bookings: bookingsProp,
  profiles: profilesProp,
  spaceInfo,
  membersList: membersListProp,
}: Props) {
  const activeBookings = bookingsProp.length > 0 ? bookingsProp : MOCK_BOOKINGS;
  const activeProfiles = profilesProp.length > 0 ? profilesProp : MOCK_PROFILES;
  const activeMembers  = membersListProp.length > 0 ? membersListProp : MOCK_MEMBERS;

  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [hoverDate,    setHoverDate]    = useState<string | null>(null);
  const [modal,        setModal]        = useState<ModalState | null>(null);
  const [tooltip,      setTooltip]      = useState<HolidayBooking | null>(null);

  const todayStr = toDateStr(new Date());
  const cells    = buildMonthGrid(currentMonth);

  const periodLabel = currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  function findBooking(ds: string) {
    return activeBookings.find(b => b.checkIn <= ds && ds <= b.checkOut);
  }

  function handleDayClick(ds: string) {
    const booking = findBooking(ds);
    if (booking) {
      setModal({ mode: 'existing', booking });
    } else {
      setModal({ mode: 'new', checkIn: ds });
    }
  }

  // Nights booked this year per member
  const yearStr = String(new Date().getFullYear());
  function getNightsUsed(memberId: string): number {
    return activeBookings
      .filter(b => b.userId === memberId && b.checkIn.startsWith(yearStr))
      .reduce((sum, b) => {
        const ci = new Date(b.checkIn);
        const co = new Date(b.checkOut);
        return sum + Math.round((co.getTime() - ci.getTime()) / 86400000) + 1;
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(() => { const d = new Date(); d.setDate(1); return d; })}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
            >
              Today
            </button>
          </div>
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

          {/* Grid cells — fills remaining height */}
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
              const color    = booking ? bookingColor(booking.userId) : null;
              const profile  = booking ? activeProfiles.find(p => p.id === booking.userId) : null;

              // Band border-radius effect
              let borderRadius = '10px';
              if (booking && !isSingle) {
                if (isCI)      borderRadius = '10px 0 0 10px';
                else if (isCO) borderRadius = '0 10px 10px 0';
                else           borderRadius = '0';
              }

              const bandStyle: React.CSSProperties = booking ? {
                borderRadius,
                backgroundColor: color!.bg,
                borderTop:    `1.5px solid ${color!.border}`,
                borderBottom: `1.5px solid ${color!.border}`,
                borderLeft:   (!isMid && !isCO) ? `1.5px solid ${color!.border}` : 'none',
                borderRight:  (!isMid && !isCI) ? `1.5px solid ${color!.border}` : 'none',
              } : {};

              return (
                <div
                  key={ds}
                  className="relative p-2 flex flex-col border-b border-r border-gray-50 transition-colors cursor-pointer hover:bg-gray-50"
                  onClick={() => handleDayClick(ds)}
                  onMouseEnter={() => { setHoverDate(ds); if (booking) setTooltip(booking); }}
                  onMouseLeave={() => { setHoverDate(null); setTooltip(null); }}
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
                      {/* Avatar on check-in */}
                      {isCI && (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white overflow-hidden shrink-0 mr-1.5"
                          style={{ backgroundColor: color!.text }}
                        >
                          {profile?.avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            : getInitials(profile?.display_name ?? null, booking.userId)
                          }
                        </div>
                      )}
                      {/* Name + note icon on check-in */}
                      {isCI && (
                        <span className="text-xs font-medium truncate" style={{ color: color!.text }}>
                          {profile?.display_name?.split(' ')[0] ?? ''}
                          {booking.note ? ' 💬' : ''}
                        </span>
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

        {/* Top: scrollable space info */}
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

        {/* Bottom: members + invite */}
        <div>
          <hr className="border-gray-100 mx-5" />
          <div className="p-5 space-y-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Members</p>
            <div className="space-y-3">
              {activeMembers.map(m => {
                const nights   = getNightsUsed(m.userId);
                const initials = getInitials(m.displayName, m.userId);
                return (
                  <div key={m.userId} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 overflow-hidden ${m.avatarUrl ? '' : avatarColorClass(m.userId)}`}>
                      {m.avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : initials}
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{m.displayName ?? 'Unknown'}</span>
                    <span className="text-xs text-gray-400 tabular-nums shrink-0">{nights}n this year</span>
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
        <HolidayModal
          modal={modal}
          userId={userId}
          profiles={activeProfiles}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
