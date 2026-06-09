'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import type { CreateSpaceInput } from '@/types';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export type CreateSpaceResult =
  | { success: true }
  | { success: false; error: string; field?: 'name' | 'slug' };

export async function createSpace(
  input: CreateSpaceInput,
): Promise<CreateSpaceResult> {
  // ── Validation ───────────────────────────────────────────
  if (!input.name?.trim()) {
    return { success: false, error: 'Name is required.', field: 'name' };
  }
  if (!input.slug?.trim()) {
    return { success: false, error: 'URL slug is required.', field: 'slug' };
  }
  if (!SLUG_RE.test(input.slug)) {
    return {
      success: false,
      error: 'Slug must be 3–50 lowercase letters, numbers, or hyphens and cannot start or end with a hyphen.',
      field: 'slug',
    };
  }

  // ── Auth ─────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  // ── Uniqueness check ─────────────────────────────────────
  const { data: existing } = await supabase
    .from('spaces')
    .select('id')
    .eq('slug', input.slug)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: 'That URL is already taken. Try a different one.',
      field: 'slug',
    };
  }

  // ── Insert space + owner membership in one round-trip ────
  // Insert the space first, then add the membership.
  // Supabase doesn't support multi-table inserts in a single RPC call without
  // a custom function, so we use two sequential inserts. The space row
  // is created with owner_id = user.id which the RLS INSERT policy requires.
  // Use service-role client for both inserts: auth.uid() is not available
  // in the DB session during Server Actions (JWT isn't forwarded to postgres),
  // so the anon-key client fails the RLS policy even though getUser() works.
  const serviceClient = createSupabaseServiceClient();

  const { data: space, error: spaceError } = await (serviceClient
    .from('spaces') as any)
    .insert({
      name:        input.name.trim(),
      slug:        input.slug.trim(),
      description: input.description?.trim() || null,
      owner_id:    user.id,
      plan_type:   'free',
      space_type:  input.space_type ?? null,
    })
    .select('id, slug')
    .single();

  if (spaceError) {
    if (spaceError.code === '23505') {
      return { success: false, error: 'That URL is already taken.', field: 'slug' };
    }
    return { success: false, error: 'Something went wrong. Please try again.' };
  }
  const { error: memberError } = await serviceClient.from('space_members').insert({
    space_id:                space.id,
    user_id:                 user.id,
    role:                    'owner',
    weekly_credit_allowance: 8,
  });

  if (memberError) {
    await serviceClient.from('spaces').delete().eq('id', space.id);
    return { success: false, error: 'Something went wrong. Please try again.' };
  }

  // Redirect happens outside try/catch so Next.js can handle it properly
  redirect(`/space/${space.slug}/setup`);
}
