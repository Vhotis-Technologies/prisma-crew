export interface CurrentJobProps {
  id: string;
  clientName: string;
  serviceType: string;
  valetType?: string;
  startTime: string;
  estimatedEndTime: string;
  progress: number;
  addons?: string[];
  status: "in_progress" | "accepted" | "completed";
  specialInstruction?: string;
  vehicleInfo?: string;
  loyalty_tier?: string;
  loyalty_benefits?: string[];
  booking_reference?: string;
  clientPhone?: string;
}

// Quick Stats Interfaces
export interface QuickStatsProps {
  weeklyEarnings: number;
  monthlyEarnings: number;
  completedJobsThisWeek: number;
  completedJobsThisMonth: number;
  pendingJobsCount: number;
  averageRating: number;
  totalReviews: number;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: "primary" | "success" | "warning" | "info";
  subtitle?: string;
}

export interface TodayOverviewProps {
  totalAppointments: number;
  completedJobs: number;
  pendingJobs: number;
  nextAppointment?: NextAppointmentProps;
  currentJob?: CurrentJobProps;
  bookingReference?: string;
}

export interface NextAppointmentProps {
  id: string;
  clientName: string;
  serviceType: string;
  valetType?: string;
  appointmentTime: string;
  duration: number;
  address: string;
  vehicleInfo: string;
  addons?: string[];
  specialInstruction?: string;
  loyalty_tier?: string;
  loyalty_benefits?: string[];
}

export interface RecentJobProps {
  id: string;
  clientName: string;
  serviceType: string;
  completedAt: string;
  earnings: number;
  rating?: number;
  status: "completed" | "cancelled";
}

export interface QuickActionProps {
  id: string;
  title: string;
  icon: string;
  action: () => void;
}
