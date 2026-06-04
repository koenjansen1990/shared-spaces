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

  const [currentMonth,    setCurrentMonth]    = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectingCheckIn, setSelectingCheckIn] = useState<string | null>(null);
  const [hoverDate,        setHoverDate]        = useState<string | null>(null);
  const [tooltip,          setTooltip]          = useState<HolidayBooking | null>(null);

  const todayStr = toDateStr(new Date());
  const cells    = buildMonthGrid(currentMonth);

  const periodLabel = currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  function findBooking(ds: string) {
    return activeBookings.find(b => b.checkIn <= ds && ds <= b.checkOut);
  }

  function isInPreview(ds: string) {
    if (!selectingCheckIn || !hoverDate) return false;
    const lo = selectingCheckIn < hoverDate ? selectingCheckIn : hoverDate;
    const hi = selectingCheckIn > hoverDate ? selectingCheckIn : hoverDate;
    return lo <= ds && ds <= hi;
  }

  function handleDayClick(ds: string) {
    if (findBooking(ds) && !selectingCheckIn) return;
    if (!selectingCheckIn) {
      setSelectingCheckIn(ds);
    } else {
      if (ds >= selectingCheckIn) {
        // TODO: wire to server action
        console.log('Book:', selectingCheckIn, '→', ds);
        setSelectingCheckIn(null);
        setHoverDate(null);
      } else {
        setSelectingCheckIn(ds);
      }
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
            {selectingCheckIn && (
              <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl px-3 py-1.5 text-xs text-gray-600">
                <span>Check-in: <strong>{selectingCheckIn}</strong></span>
                <button onClick={() => { setSelectingCheckIn(null); setHoverDate(null); }} className="text-gray-400 hover:text-gray-700 ml-1">✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Month grid */}
        <div className="flex-1 overflow-auto">

          {/* Day-of-week headers */}
          <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-gray-100 bg-white" style={{ height: '3rem' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="h-full flex items-center justify-center text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Grid cells */}
          <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(5.5rem, 1fr)' }}>
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="border-b border-r border-gray-50" />;

              const ds       = toDateStr(date);
              const booking  = findBooking(ds);
              const isCI     = booking?.checkIn  === ds;
              const isCO     = booking?.checkOut === ds;
              const isMid    = !!(booking && !isCI && !isCO);
              const isSingle = !!(booking && booking.checkIn === booking.checkOut);
              const inPreview = !booking && isInPreview(ds);
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
                  className={`relative p-2 flex flex-col border-b border-r border-gray-50 transition-colors
                    ${!booking ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'}
                  `}
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

                  {/* Preview highlight */}
                  {inPreview && (
                    <div className="absolute inset-x-0 inset-y-8 bg-gray-100 rounded-lg mx-1" />
                  )}

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

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-2xl p-4 shadow-lg text-sm pointer-events-none"
          style={{ bottom: '32px', right: '320px' }}
        >
          <p className="font-semibold text-gray-900">
            {activeProfiles.find(p => p.id === tooltip.userId)?.display_name ?? 'Member'}
          </p>
          <p className="text-gray-400 text-xs mt-0.5">{tooltip.checkIn} → {tooltip.checkOut}</p>
          {tooltip.note && <p className="text-gray-500 mt-2 text-xs">{tooltip.note}</p>}
        </div>
      )}
    </div>
  );
}
