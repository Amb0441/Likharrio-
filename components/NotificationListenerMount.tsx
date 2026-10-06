import { useInAppNotificationListener } from '../hooks/useInAppNotificationListener';

/**
 * Mounts the Firestore listener that fires in-app toasts for new notifications.
 * Renders nothing — purely a side-effect component.
 */
export default function NotificationListenerMount() {
  useInAppNotificationListener();
  return null;
}
