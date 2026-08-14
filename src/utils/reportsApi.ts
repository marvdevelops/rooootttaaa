import { supabase } from '../lib/supabase';

export type ReportTargetType = 'route' | 'profile' | 'comment' | 'group_run';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export async function createReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details = '',
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const reporterId = userData.user?.id;
  if (!reporterId) throw new Error('You must be signed in to report.');

  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
    details,
  });

  if (error) throw new Error(error.message);
}
