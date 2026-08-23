import { createClient } from './supabase/client';
import { NotificationPreferences } from './types';

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('likes_enabled, rsvps_enabled, comments_enabled, replies_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  // Falls back to all-on if the row is somehow missing — a DB trigger creates
  // one for every profile, this is just a defensive default.
  return {
    likesEnabled: data?.likes_enabled ?? true,
    rsvpsEnabled: data?.rsvps_enabled ?? true,
    commentsEnabled: data?.comments_enabled ?? true,
    repliesEnabled: data?.replies_enabled ?? true,
  };
}

export async function updateNotificationPreferences(userId: string, patch: Partial<NotificationPreferences>): Promise<void> {
  const supabase = createClient();
  const dbPatch: Record<string, boolean> = {};
  if (patch.likesEnabled !== undefined) dbPatch.likes_enabled = patch.likesEnabled;
  if (patch.rsvpsEnabled !== undefined) dbPatch.rsvps_enabled = patch.rsvpsEnabled;
  if (patch.commentsEnabled !== undefined) dbPatch.comments_enabled = patch.commentsEnabled;
  if (patch.repliesEnabled !== undefined) dbPatch.replies_enabled = patch.repliesEnabled;

  const { error } = await supabase
    .from('notification_preferences')
    .update({ ...dbPatch, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}
