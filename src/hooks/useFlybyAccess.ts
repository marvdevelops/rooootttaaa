import { useEffect, useState } from 'react';
import { useUserTier } from './useUserTier';
import { FlybyAccessMode, getCachedFlybyAccessMode, refreshFlybyAccessMode } from '../utils/appConfigApi';

/**
 * Reads app_config.flyby_access_mode (cached locally, refreshed on mount)
 * rather than a hardcoded tier check, so the free/Pro policy can flip
 * without an app release. free_limited (N/month for free users) isn't
 * implemented yet — no usage-count tracking exists — so it currently
 * behaves the same as pro_only. Default is free_all, matching the
 * launch policy in T5-flyby-video.md.
 */
export function useFlybyAccess(): { allowed: boolean; mode: FlybyAccessMode } {
  const tier = useUserTier();
  const [mode, setMode] = useState<FlybyAccessMode>('free_all');

  useEffect(() => {
    getCachedFlybyAccessMode().then(setMode);
    refreshFlybyAccessMode().then(setMode);
  }, []);

  const allowed = mode === 'free_all' || tier === 'paid';
  return { allowed, mode };
}
