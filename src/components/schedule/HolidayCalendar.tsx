'use client';

import { useState } from 'react';

interface HolidayBooking {
  id:       string;
  userId:   string;
  checkIn:  string; // 'YYYY-MM-DD'
  checkOut: string; // 'YYYY-MM-DD' (inclusive last night = day before checkout)
  note?:    string | null;
}

interface HolidayProfile {
  id:           string;
  display_name: string | null;
  avatar_url:   string | null;
}

interface Props {
  userId:    string;
  spaceId:   string;
  bookings:  HolidayBooking[];
  profiles:  HolidayProfile[];
  isAdmin:   boolean;
  spaceSlug: string;
}

// ── Mock data ────────────────────────────────────────────────

const today = new Date();
const y = today.getFullYear();
const m = String(today.getMonth() + 1).padStart(2, '0');

const MOCK_BOOKINGS: HolidayBooking[] = [
  { id: '1', userId: 'mock-1', checkIn: `${y}-${m}-05`, checkOut: `${y}-${m}-09`, note: 'Bringing the dog 🐕' },
  { id: '2', userId: 'mock-2', checkIn: `${y}-${m}-15`, checkOut: `${y}-${m}-18` },
  { id: '3', userId: 'mock-3', checkIn: `${y}-${m}-22`, checkOut: `${y}-${m}-26`, note: 'Birthday week 🎉' },
];

const MOCK_PROFILES: HolidayProfile[] = [
  { id: 'mock-1', display_name: 'Koen', avatar_url: null },
  { id: 'mock-2', display_name: 'Emma', avatar_url: null },
  { id: 'mock-3', display_name: 'Lars',  avatar_url: null },
];

// ── Colors ───────────────────────────────────────────────────

const BOOKING_COLORS = [
  { bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8' }, // blue
  { bg: '#EDE9FE', border: '#C4B5FD', text: '#6D28D9' }, // violet
  { bg: '#D1FAE5', border: '#6EE7B7', text: '#065F46' }, // emerald
  { bg: '#FEF3C7', border: '#FCD34D', text: '#92400E' }, // amber
  { bg: '#FCE7F3', border: '#F9A8D4', text: '#9D174D' }, // pink
  { bg: '#CFFAFE', border: '#67E8F9', text: '#155E75' }, // cyan
];

function bookingColor(userId: string) {
  let n = 0;
  for (const c of userId) n += c.charCodeAt(0);
  return BOOKING_COLORS[n % BOOKING_COLORS.length];
}

function initials(profile: HolidayProfile | undefined) {
  if (!profile) return '?';
  return (profile.display_name ?? profile.id)
    .trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Grid builder ─────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────

export default function HolidayCalendar({ bookings: bookingsProp, profiles: profilesProp }: Props) {
  const activeBookings = bookingsProp.length > 0 ? bookingsProp : MOCK_BOOKINGS;
  const activeProfiles = profilesProp.length > 0 ? profilesProp : MOCK_PROFILES;

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selectingCheckIn, setSelectingCheckIn] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ booking: HolidayBooking; x: number; y: number } | null>(null);

  function prevMonth() {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const cells = buildMonthGrid(currentMonth);
  const todayStr = new Date().toISOString().slice(0, 10);

  function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function findBooking(ds: string) {
    return activeBookings.find(b => b.checkIn <= ds && ds <= b.checkOut);
  }

  function isInPreview(ds: string) {
    if (!selectingCheckIn || !hoverDate) return false;
    const lo = selectingCheckIn < hoverDate ? selectingCheckIn : hoverDate;
    const hi = selectingCheckIn < hoverDate ? hoverDate : selectingCheckIn;
    return lo <= ds && ds <= hi;
  }

  function handleDayClick(ds: string) {
    if (findBooking(ds) && !selectingCheckIn) return;
    if (!selectingCheckIn) {
      setSelectingCheckIn(ds);
    } else {
      if (ds >= selectingCheckIn) {
        console.log('Book:', selectingCheckIn, '→', ds);
        setSelectingCheckIn(null);
        setHoverDate(null);
      } else {
        setSelectingCheckIn(ds);
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto" style={{ backgroundColor: '#F7F7F7' }}>
      <div className="max-w-2xl mx-auto w-full px-5 py-6">

        {/* Month nav */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white border border-transparent hover:border-gray-200 transition-all text-xl"
          >
            ‹
          </button>
          <h2 className="text-lg font-bold text-gray-900">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-white border border-transparent hover:border-gray-200 transition-all text-xl"
          >
            ›
          </button>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
            <div key={d} className="text-xs text-gray-400 font-medium text-center py-1">{d}</div>
          ))}
        </div>

        {/* Status hint */}
        {selectingCheckIn && (
          <div className="mb-3 text-xs text-gray-500 text-center">
            Check-in: <strong>{selectingCheckIn}</strong> — now click a check-out date
            <button
              onClick={() => { setSelectingCheckIn(null); setHoverDate(null); }}
              className="ml-2 text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;

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

            let borderRadius = '12px';
            if (booking && !isSingle) {
              if (isCI)       borderRadius = '12px 0 0 12px';
              else if (isCO)  borderRadius = '0 12px 12px 0';
              else            borderRadius = '0';
            }

            const cellStyle: React.CSSProperties = {
              borderRadius,
              backgroundColor: booking ? color!.bg : inPreview ? '#E5E7EB' : undefined,
              borderTop:    booking ? `1.5px solid ${color!.border}` : undefined,
              borderBottom: booking ? `1.5px solid ${color!.border}` : undefined,
              borderLeft:   booking && !isMid && !isCO  ? `1.5px solid ${color!.border}` : booking ? 'none' : undefined,
              borderRight:  booking && !isMid && !isCI  ? `1.5px solid ${color!.border}` : booking ? 'none' : undefined,
            };

            return (
              <div
                key={ds}
                style={cellStyle}
                className={`relative h-14 flex flex-col items-center justify-center transition-all select-none
                  ${!booking && !inPreview ? 'hover:bg-white hover:border hover:border-gray-200 rounded-xl cursor-pointer' : ''}
                  ${booking ? 'cursor-default' : ''}
                `}
                onClick={() => handleDayClick(ds)}
                onMouseEnter={() => {
                  setHoverDate(ds);
                  if (booking) setTooltip({ booking, x: 0, y: 0 });
                }}
                onMouseLeave={() => {
                  setHoverDate(null);
                  setTooltip(null);
                }}
              >
                {/* Date number */}
                <span
                  className={`text-sm font-medium ${isToday && !booking ? 'text-gray-900 font-bold' : ''}`}
                  style={{ color: booking ? color!.text : undefined }}
                >
                  {date.getDate()}
                </span>

                {/* Today dot */}
                {isToday && (
                  <div className={`absolute bottom-1.5 w-1 h-1 rounded-full ${booking ? 'opacity-50' : 'bg-gray-400'}`}
                    style={booking ? { backgroundColor: color!.text } : undefined}
                  />
                )}

                {/* Avatar on check-in */}
                {isCI && profile && (
                  <div
                    className="absolute -top-2 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white overflow-hidden z-10"
                    style={{ backgroundColor: color!.text }}
                    title={profile.display_name ?? undefined}
                  >
                    {profile.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : initials(profile)
                    }
                  </div>
                )}

                {/* Note icon */}
                {isCI && booking?.note && (
                  <span className="absolute bottom-1 right-1 text-[10px] opacity-60">💬</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-2xl p-4 shadow-lg text-sm pointer-events-none"
            style={{ bottom: '80px', left: '50%', transform: 'translateX(-50%)', minWidth: '200px' }}
          >
            <p className="font-semibold text-gray-900">
              {activeProfiles.find(p => p.id === tooltip.booking.userId)?.display_name ?? 'Member'}
            </p>
            <p className="text-gray-400 text-xs mt-0.5">{tooltip.booking.checkIn} → {tooltip.booking.checkOut}</p>
            {tooltip.booking.note && <p className="text-gray-500 mt-2 text-xs">{tooltip.booking.note}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
