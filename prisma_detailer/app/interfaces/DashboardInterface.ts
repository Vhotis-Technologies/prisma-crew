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
  booking_reference?: string;
  clientPhone?: string;
  address?: string;
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
}
