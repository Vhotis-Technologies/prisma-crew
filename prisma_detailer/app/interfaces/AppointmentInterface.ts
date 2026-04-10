// Calendar and Day View Interfaces
export interface CalendarDayProps {
  date: string;
  day: number;
  month: number;
  year: number;
  hasAppointments: boolean;
  appointmentCount: number;
  isToday: boolean;
  isSelected: boolean;
}

export interface TimeSlotProps {
  id: string;
  time: string; // Format: "09:00", "10:00", etc.
  hour: number;
  hasJob: boolean;
  job?: JobCardProps;
  isOccupiedByPreviousJob?: boolean;
  slotsToOccupy?: number;
}

export interface JobCardProps {
  id: number;
  booking_reference: string;
  service_type: string;
  client_name: string;
  valet_type: string;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  status: JobStatus;
}

export interface JobDetailsProps {
  id: string;
  booking_reference: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_color: string;
  vehicle_license: string;
  service_type: ServiceTypeProps;
  address: string;
  city: string;
  post_code: string;
  country: string;
  latitude: number;
  longitude: number;
  appointment_date: string;
  appointment_time: string;
  duration: number; // in minutes
  status: JobStatus;
  created_at: string;
  updated_at: string;
  specialInstruction?: string;
  valetType?: string;
  addons?: string[];
  before_images_interior?: Array<{
    id: number;
    image_url: string;
    uploaded_at: string;
    segment: string;
  }>;
  before_images_exterior?: Array<{
    id: number;
    image_url: string;
    uploaded_at: string;
    segment: string;
  }>;
  after_images_interior?: Array<{
    id: number;
    image_url: string;
    uploaded_at: string;
    segment: string;
  }>;
  after_images_exterior?: Array<{
    id: number;
    image_url: string;
    uploaded_at: string;
    segment: string;
  }>;
  fleet_maintenance?: FleetMaintenanceProps;
  loyalty_tier?: string;
  loyalty_benefits?: string[];
}

// Service Type Details
export interface ServiceTypeProps {
  id?: string;
  name: string;
  description: string[];
  duration: number; // in minutes
  price: number;
}

// Job Status Enum
export type JobStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

// Availability Interface (for blocking time slots)
export interface AvailabilityProps {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
}

// Fleet Maintenance Interface
export interface FleetMaintenanceProps {
  id?: number;
  job?: number;
  tire_tread_depth?: number;
  tire_condition?: string;
  wiper_status?: "good" | "needs_work" | "bad";
  oil_level?: "good" | "low" | "needs_change" | "needs_refill";
  coolant_level?: "good" | "low" | "needs_change" | "needs_refill";
  brake_fluid_level?: "good" | "low" | "needs_change" | "needs_refill";
  battery_condition?: "good" | "weak" | "replace";
  headlights_status?: "working" | "dim" | "not_working";
  taillights_status?: "working" | "dim" | "not_working";
  indicators_status?: "working" | "not_working";
  vehicle_condition_notes?: string;
  damage_report?: string;
  inspected_by?: number;
  inspected_at?: string;
}
