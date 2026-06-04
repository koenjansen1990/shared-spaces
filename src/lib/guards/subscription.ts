import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SpaceFeature, FeatureAccessResult } from '@/types';

// Central paywall guard. Call this before any mutation that is plan-gated.
// Returns the raw DB result so callers can inspect limit/current for UI hints.
//
// Usage:
//   const access = await checkSpaceFeatureAccess(spaceId, 'add_resource');
//   if (!access.allowed) {
//     if (access.error === 'SUBSCRIPTION_REQUIRED') triggerUpgradeModal(access);
//     throw new Error(access.error);
//   }
export async function checkSpaceFeatureAccess(
  spaceId: string,
  feature: SpaceFeature,
): Promise<FeatureAccessResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('rpc_check_space_feature_access', {
    p_space_id: spaceId,
    p_feature:  feature,
  });

  if (error) {
    console.error('[checkSpaceFeatureAccess] RPC error:', error.message);
    return { allowed: false, error: 'NOT_A_MEMBER' };
  }

  return data as FeatureAccessResult;
}
