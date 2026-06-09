import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import WeeklyCalendar from '@/components/schedule/WeeklyCalendar';
import type { CalendarSlot, CalendarBooking, CalendarProfile, SpaceInfo, MemberInfo } from '@/components/schedule/WeeklyCalendar';
import HolidayCalendar from '@/components/schedule/HolidayCalendar';

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Schedule · ${slug}` };
}

export default async function SchedulePage({ params }: Props) {
  const { slug }   = await params;
  const supabase   = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const { data: space } = await supabase
    .from('spaces')
    .select('id, name, welcome_message, address, hero_image_url, space_type')
    .eq('slug', slug)
    .single();

  if (!space) notFound();

  const { data: member } = await supabase
    .from('space_members')
    .select('role, weekly_credit_allowance')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .single();

  const isAdmin        = member?.role === 'owner' || member?.role === 'admin';
  const weeklyAllowance = member?.weekly_credit_allowance ?? 40;

  // Slots
  const { data: resources } = await supabase
    .from('resources')
    .select('id, name, slots(id, slot_type, recurrence_day, event_date, start_time, end_time, max_capacity, credit_cost, is_active)')
    .eq('space_id', space.id)
    .eq('is_active', true);

  const slots: CalendarSlot[] = (resources ?? []).flatMap(r =>
    (r.slots as unknown as CalendarSlot[])
      .filter((s: CalendarSlot) => s.is_active)
      .map((s: CalendarSlot) => ({ ...s, resource_name: r.name }))
  );

  // Bookings (±8 week window)
  const from = new Date(); from.setDate(from.getDate() - 56);
  const to   = new Date(); to.setDate(to.getDate() + 56);

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, slot_id, booking_date, user_id, status, credits_consumed')
    .eq('space_id', space.id)
    .gte('booking_date', toISODate(from))
    .lte('booking_date', toISODate(to))
    .neq('status', 'cancelled');

  // All space members (for side panel)
  const { data: allMembers } = await supabase
    .from('space_members')
    .select('user_id, role, weekly_credit_allowance')
    .eq('space_id', space.id)
    .order('role');

  // Profiles for booking users + all members
  const bookingUserIds = [...new Set([user.id, ...((bookings ?? []).map(b => b.user_id))])];
  const memberIds      = (allMembers ?? []).map(m => m.user_id);
  const allProfileIds  = [...new Set([...bookingUserIds, ...memberIds])];

  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', allProfileIds);

  const profileMap = Object.fromEntries((profilesData ?? []).map(p => [p.id, p]));

  // Current week used hours
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const { data: weekBookings } = await supabase
    .from('bookings')
    .select('credits_consumed')
    .eq('space_id', space.id)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .gte('booking_date', toISODate(weekStart))
    .lte('booking_date', toISODate(weekEnd));

  const weeklyUsed = (weekBookings ?? []).reduce((s, b) => s + (b.credits_consumed ?? 0), 0);

  const spaceInfo: SpaceInfo = {
    name:           space.name,
    welcomeMessage: space.welcome_message ?? null,
    address:        space.address ?? null,
    heroImageUrl:   space.hero_image_url ?? null,
  };

  const membersList: MemberInfo[] = (allMembers ?? []).map(m => ({
    userId:          m.user_id,
    displayName:     profileMap[m.user_id]?.display_name ?? null,
    avatarUrl:       profileMap[m.user_id]?.avatar_url ?? null,
    weeklyAllowance: m.weekly_credit_allowance,
  }));

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 84px)' }}>
      {(space as any).space_type === 'holiday_home' ? (
        <HolidayCalendar
          userId={user.id}
          spaceId={space.id}
          bookings={[]}
          profiles={(profilesData ?? []) as any}
          isAdmin={isAdmin}
          spaceSlug={slug}
          spaceInfo={spaceInfo}
          membersList={membersList.map(m => ({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl }))}
          nightsPerYear={(space as any).holiday_nights_per_year ?? 30}
        />
      ) : (
        <WeeklyCalendar
          slots={slots}
          bookings={(bookings ?? []) as CalendarBooking[]}
          profiles={(profilesData ?? []) as CalendarProfile[]}
          userId={user.id}
          isAdmin={isAdmin}
          spaceSlug={slug}
          spaceId={space.id}
          weeklyAllowance={weeklyAllowance}
          weeklyUsed={weeklyUsed}
          spaceInfo={spaceInfo}
          membersList={membersList}
        />
      )}
    </div>
  );
}
