import { useCallback, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { markPrePermissionPrompted, shouldShowPrePermissionModal } from '../lib/notificationPrePermission';
import { registerPushToken, requestSystemPermission } from '../lib/pushNotifications';

/** Drives NotificationPermissionModal — call maybePrompt() right after a contextual moment (first RSVP, first schedule) succeeds. No-ops if the OS permission is already decided or we asked recently. */
export function useNotificationPrePermission() {
  const { session } = useAuth();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  const maybePrompt = useCallback(async (contextMessage: string) => {
    if (!(await shouldShowPrePermissionModal())) return;
    setMessage(contextMessage);
    setVisible(true);
  }, []);

  const handleAllow = useCallback(async () => {
    setVisible(false);
    await markPrePermissionPrompted();
    const granted = await requestSystemPermission();
    if (granted && session) await registerPushToken(session.user.id);
  }, [session]);

  const handleDismiss = useCallback(async () => {
    setVisible(false);
    await markPrePermissionPrompted();
  }, []);

  return { visible, message, maybePrompt, handleAllow, handleDismiss };
}
