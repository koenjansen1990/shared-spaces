'use server';

import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export async function createHolidayBooking(
  spaceId:  string,
  checkIn:  string,
  checkOut: string,
  note:     string,
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient() as any;
  const { data, error } = await service.from('holiday_bookings')
    .insert({ space_id: spaceId, user_id: user.id, check_in: checkIn, check_out: checkOut, note: note.trim() || null })
    .select('id')
    .single();

  if (error) return { success: false as const, error: error.message };
  return { success: true as const, id: data.id };
}

export async function cancelHolidayBooking(bookingId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient() as any;
  const { error } = await service.from('holiday_bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', user.id); // can only cancel your own

  return error ? { success: false as const, error: error.message } : { success: true as const };
}

export async function updateHolidayBookingNote(bookingId: string, note: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false as const, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient() as any;
  const { error } = await service.from('holiday_bookings')
    .update({ note: note.trim() || null })
    .eq('id', bookingId)
    .eq('user_id', user.id); // can only edit your own

  return error ? { success: false as const, error: error.message } : { success: true as const };
}
