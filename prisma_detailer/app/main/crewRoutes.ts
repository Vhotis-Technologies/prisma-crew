/** Authenticated crew routes after the Today / Schedule / Me shell. */
export const CrewRoutes = {
  today: "/main/today/TodayScreen",
  schedule: "/main/schedule/ScheduleScreen",
  me: "/main/me/MeScreen",
  jobDetails: "/main/appointments/AppointmentDetailsScreen",
  unavailable: "/main/profile/AvailabilityScreen",
  settings: "/main/settings/SettingsScreen",
  notifications: "/main/settings/NotificationScreen",
  history: "/main/me/JobHistoryScreen",
  supportChat: "/main/support/SupportChatScreen",
} as const;
