'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

export async function updateProfile(displayName: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: displayName.trim() || null, updated_at: new Date().toISOString() });

  if (error) return { success: false, error: error.message };
  revalidatePath('/space', 'layout');
  return { success: true };
}

export async function updateAvatarUrl(avatarUrl: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() });

  if (error) return { success: false, error: error.message };
  revalidatePath('/space', 'layout');
  return { success: true };
}

export async function generateInviteLink(spaceId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  const service = createSupabaseServiceClient();
  await service.from('invite_tokens').delete().eq('space_id', spaceId);
  const { data, error } = await service
    .from('invite_tokens')
    .insert({ space_id: spaceId, created_by: user.id })
    .select('token')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, token: data.token };
}

export async function updateSpaceDetails(
  spaceId: string,
  data: { welcome_message?: string; contact_email?: string; contact_phone?: string; address?: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHENTICATED' };

  // Verify admin
  const { data: member } = await supabase
    .from('space_members')
    .select('role')
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .single();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return { success: false, error: 'FORBIDDEN' };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from('spaces')
    .update({
      welcome_message: data.welcome_message?.trim() || null,
      contact_email:   data.contact_email?.trim()   || null,
      contact_phone:   data.contact_phone?.trim()   || null,
      address:         data.address?.trim()          || null,
    })
    .eq('id', spaceId);

  if (error) return { success: false, error: error.message };
  revalidatePath('/space', 'layout');
  return { success: true };
}
