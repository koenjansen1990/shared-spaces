'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CreateBookingInput, BookingResult } from '@/types';

// createBooking – Server Action
//
// All capacity, credit, and membership validation is handled atomically inside
// the rpc_create_booking PostgreSQL function (SECURITY DEFINER). This layer is
// responsible for:
//   1. Input validation (shape + date sanity)
//   2. Auth session retrieval
//   3. Calling the RPC
//   4. Translating DB error codes into user-facing messages
//   5. Invalidating the relevant Next.js cache segments on success
export async function createBooking(
  input: CreateBookingInput,
): Promise<BookingResult> {
  // ── 1. Input validation ──────────────────────────────────
  if (!input.slot_id || typeof input.slot_id !== 'string') {
    return { success: false, error: 'SLOT_NOT_FOUND' };
  }

  const bookingDate = new Date(input.booking_date);
  if (isNaN(bookingDate.getTime())) {
    return { success: false, error: 'SLOT_NOT_FOUND' };
  }

  // Bookings cannot be made for dates more than 365 days in the future
  // (the DB rule max_advance_days enforces the per-space limit).
  const maxFuture = new Date();
  maxFuture.setFullYear(maxFuture.getFullYear() + 1);
  if (bookingDate > maxFuture) {
    return { success: false, error: 'SLOT_NOT_FOUND' };
  }

  // ── 2. Auth ──────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'UNAUTHENTICATED' };
  }

  // ── 3. Atomic booking via PostgreSQL RPC ─────────────────
  // The RPC runs all remaining guards (membership, duplicate, capacity,
  // weekly credits) in a single transaction, eliminating TOCTOU races.
  const { data, error: rpcError } = await supabase.rpc('rpc_create_booking', {
    p_slot_id:      input.slot_id,
    p_booking_date: input.booking_date,
  });

  if (rpcError) {
    console.error('[createBooking] RPC error:', rpcError.message);
    return { success: false, error: 'INTERNAL_ERROR', detail: rpcError.message };
  }

  const result = data as BookingResult;

  // ── 4. Cache invalidation on success ────────────────────
  if (result.success) {
    // We need the slug to invalidate the right path; fetch it from the booking.
    // The slot's space_id is embedded in the RPC result indirectly, so we do a
    // lightweight lookup here (one indexed query, no RLS hop needed).
    const { data: slotRow } = await supabase
      .from('slots')
      .select('space_id, spaces(slug)')
      .eq('id', input.slot_id)
      .single();

    if (slotRow?.spaces) {
      const slug = (slotRow.spaces as unknown as { slug: string }).slug;
      revalidatePath(`/space/${slug}/schedule`);
      revalidatePath(`/space/${slug}/bookings`);
    }
  }

  return result;
}

// cancelBooking – sets status to 'cancelled' (soft delete).
// The DB policy allows owners of a booking or space admins to do this.
export async function cancelBooking(bookingId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, space_id, slots(space_id, spaces(slug))')
    .eq('id', bookingId)
    .single();

  if (fetchError || !booking) {
    return { success: false, error: 'NOT_FOUND' };
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // Invalidate schedule cache
  const slug = (booking as unknown as { slots: { spaces: { slug: string } } })?.slots?.spaces?.slug;
  if (slug) {
    revalidatePath(`/space/${slug}/schedule`);
    revalidatePath(`/space/${slug}/bookings`);
  }

  return { success: true };
}

// cancelMyBookingsForDate — cancels all of the current user's confirmed bookings
// for a given space + date. Used when switching from half-day to full day.
export async function cancelMyBookingsForDate(
  spaceId: string,
  date: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .eq('booking_date', date)
    .eq('status', 'confirmed');

  if (error) return { success: false, error: error.message };

  revalidatePath(`/space`);
  return { success: true };
}
