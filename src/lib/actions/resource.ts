'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { checkSpaceFeatureAccess } from '@/lib/guards/subscription';
import type { CreateResourceInput } from '@/types';

export async function createResource(
  input: CreateResourceInput,
): Promise<{ success: boolean; resource_id?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  // Verify admin role
  const { data: member } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', input.space_id)
    .eq('user_id', user.id)
    .single();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return { success: false, error: 'Only admins can add resources.' };
  }

  // Paywall guard
  const access = await checkSpaceFeatureAccess(input.space_id, 'add_resource');
  if (!access.allowed) {
    return { success: false, error: access.error };
  }

  // Use service-role to bypass RLS (auth.uid() not available in DB session)
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from('resources')
    .insert({
      space_id:    input.space_id,
      name:        input.name,
      description: input.description ?? null,
    })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };

  const { data: space } = await service
    .from('spaces')
    .select('slug')
    .eq('id', input.space_id)
    .single();

  if (space?.slug) revalidatePath(`/space/${space.slug}/resources`);

  return { success: true, resource_id: data.id };
}

export async function inviteMember(
  spaceId: string,
  userId:  string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const access = await checkSpaceFeatureAccess(spaceId, 'invite_member');
  if (!access.allowed) {
    return { success: false, error: access.error };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.from('space_members').insert({
    space_id:   spaceId,
    user_id:    userId,
    role:       'member',
    invited_by: user.id,
  });

  if (error) return { success: false, error: error.message };

  const { data: space } = await service
    .from('spaces')
    .select('slug')
    .eq('id', spaceId)
    .single();

  if (space?.slug) revalidatePath(`/space/${space.slug}/members`);

  return { success: true };
}
