/* Defines the interface for the detailers reviews and rating after a was is completed */
export interface ReviewProps {
  id: string;
  rating: number;
  comment: string;
  created_by: string;
  created_at: string;
}

/* Defines the interface for the detailers profile */
export interface UserProfileProps {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  post_code?: string;
  country?: string;
  allow_push_notifications?: boolean;
  allow_email_notifications?: boolean;
  allow_marketing_emails?: boolean;
  is_verified?: boolean;
}

/* Defines the interface for the detailers statistics */
export interface DetailerStatisticsInterface {
  avg_rating: number;
  total_bookings: number;
  reviews: ReviewProps[];
  total_earnings: number;
}

/* Defines the interface for the detailers address */
export interface MyAddressProps {
  id?: string;
  address: string;
  post_code: string;
  city: string;
  country: string;
}
