import { UserProfileProps } from "./ProfileInterfaces";

export default interface AuthState {
  user?: UserProfileProps | null;
  access?: string;
  refresh?: string;
  isAuthenticated?: boolean;
  isLoading?: boolean;
  signUpData?: SignUpScreenProps | null;
  confirmPassword?: string;
}

export interface SignUpScreenProps {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
}

export interface LoginScreenProps {
  email: string;
  password: string;
}
