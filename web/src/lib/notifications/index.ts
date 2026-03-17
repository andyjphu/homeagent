export { dispatchNotification, flushQueuedNotifications } from "./service";
export { sendSms, isSmsAvailable } from "./sms";
export { sendNotificationEmail, isEmailAvailable } from "./email";
export { NOTIFICATION_EVENT_CONFIG, BATCH_WINDOW_MS, QUIET_HOURS_START, QUIET_HOURS_END } from "./types";
export type {
  NotificationChannel,
  NotificationPriority,
  NotificationPayload,
  NotificationContext,
  NotificationRecord,
  NotificationEventConfig,
} from "./types";
