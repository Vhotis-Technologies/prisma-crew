export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  timestamp: Date;
  isRead: boolean;
  data?: any; // Additional data for specific notification types
}

export enum NotificationType {
  APPOINTMENT_STARTED = "appointment_started",
  BOOKING_CONFIRMED = "booking_confirmed",
  BOOKING_CANCELLED = "booking_cancelled",
  BOOKING_RESCHEDULED = "booking_rescheduled",
  BOOKING_CREATED = "booking_created",
  CLEANING_COMPLETED = "cleaning_completed",
  PENDING = "pending",
  CAR_READY = "car_ready",
  PAYMENT_RECEIVED = "payment_received",
  REMINDER = "reminder",
  SYSTEM = "system",
}

export enum NotificationStatus {
  SUCCESS = "success",
  WARNING = "warning",
  ERROR = "error",
  INFO = "info",
}

export interface NotificationIcon {
  name: string;
  color: string;
  size?: number;
}

export interface NotificationFilters {
  showRead: boolean;
  showUnread: boolean;
  types: NotificationType[];
}
