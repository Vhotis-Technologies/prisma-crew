/**
 * Onboarding hook: multi-step signup form, validation, registration, and terms flow.
 * Wizard UI state lives in OnboardingProvider so SignUpScreen and step components share it.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { router } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/app/store/my_store";
import {
  setSignUpData,
  clearSignUpData,
  setIsLoading,
  setConfirmPassword,
} from "@/app/store/slices/authSlice";
import { SignUpScreenProps } from "@/app/interfaces/AuthInterface";
import { RootState } from "@/app/store/my_store";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { useRegisterMutation } from "@/app/store/api/authApi";
import { useSnackbar } from "@/app/contexts/SnackbarContext";
import { AddressSearchResult } from "@/app/components/shared/AddressSearchInput";

type SignUpFieldErrors = Partial<Record<keyof SignUpScreenProps, string>>;

/**
 * Map server/technical registration errors to user-facing messages.
 * @param errorMessage - Raw error string from API or network layer
 * @returns User-friendly error message
 */
const parseUserFriendlyError = (errorMessage: string): string => {
  const message = errorMessage.toLowerCase();

  if (message.includes("duplicate key value violates unique constraint")) {
    if (
      message.includes("username") ||
      message.includes("main_user_username_key")
    ) {
      return "An account with this email address already exists. Please use a different email or try logging in.";
    }
    if (message.includes("email")) {
      return "An account with this email address already exists. Please use a different email or try logging in.";
    }
    if (message.includes("phone")) {
      return "An account with this phone number already exists. Please use a different phone number.";
    }
    return "An account with this information already exists. Please check your details and try again.";
  }

  if (message.includes("violates unique constraint")) {
    return "This information is already in use. Please check your details and try again.";
  }

  if (message.includes("foreign key constraint")) {
    return "There was an issue with your registration data. Please try again.";
  }

  if (
    message.includes("validation error") ||
    message.includes("invalid input")
  ) {
    return "Please check your information and make sure all fields are filled correctly.";
  }

  if (
    message.includes("network error") ||
    message.includes("connection refused")
  ) {
    return "Unable to connect to our servers. Please check your internet connection and try again.";
  }

  if (message.includes("timeout") || message.includes("request timeout")) {
    return "The request took too long to process. Please try again.";
  }

  if (message.includes("unauthorized") || message.includes("forbidden")) {
    return "Access denied. Please try again or contact support.";
  }

  if (message.includes("internal server error") || message.includes("500")) {
    return "Something went wrong on our end. Please try again later or contact support if the problem persists.";
  }

  if (
    message.includes("missing required fields") ||
    message.includes("required field")
  ) {
    return "Please fill in all required fields and try again.";
  }

  if (message.includes("invalid email") || message.includes("email format")) {
    return "Please enter a valid email address.";
  }

  if (
    message.includes("password") &&
    (message.includes("short") || message.includes("weak"))
  ) {
    return "Password must be at least 8 characters long.";
  }

  if (
    message.includes("phone") &&
    (message.includes("invalid") || message.includes("format"))
  ) {
    return "Please enter a valid phone number.";
  }

  return "Registration failed. Please check your information and try again.";
};

const EMPTY_SIGNUP: SignUpScreenProps = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  address: "",
  city: "",
  postcode: "",
  country: "",
  latitude: null,
  longitude: null,
};

type OnboardingContextValue = ReturnType<typeof useOnboardingState>;

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Internal wizard state used by OnboardingProvider. */
function useOnboardingState() {
  const dispatch = useAppDispatch();
  const { showSnackbarWithConfig } = useSnackbar();
  const signUpData = useAppSelector(
    (state: RootState) => state.auth.signUpData,
  );
  const confirmPassword = useAppSelector(
    (state: RootState) => state.auth.confirmPassword,
  );

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const [register] = useRegisterMutation();

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<SignUpFieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const steps = useMemo(
    () => [
      { id: 1, title: "Personal Info", icon: "person-outline" },
      { id: 2, title: "Security", icon: "lock-closed-outline" },
      { id: 3, title: "Location", icon: "location-outline" },
    ],
    [],
  );

  /**
   * Validate fields for the current signup step.
   * @param step - Wizard step number (1–3)
   * @returns True when the step passes validation
   */
  const validateStep = useCallback(
    (step: number): SignUpFieldErrors => {
      const data = signUpData ?? EMPTY_SIGNUP;
      const newErrors: SignUpFieldErrors = {};

      switch (step) {
        case 1:
          if (!data.first_name?.trim())
            newErrors.first_name = "First name is required";
          if (!data.last_name?.trim())
            newErrors.last_name = "Last name is required";
          if (!data.email?.trim()) {
            newErrors.email = "Email is required";
          } else if (!/\S+@\S+\.\S+/.test(data.email)) {
            newErrors.email = "Please enter a valid email";
          }
          if (!data.phone?.trim()) {
            newErrors.phone = "Phone number is required";
          } else {
            const phoneDigits = data.phone.replace(/\D/g, "");
            if (phoneDigits.length < 10 || phoneDigits.length > 15) {
              newErrors.phone =
                "Please enter a valid phone number (10-15 digits)";
            }
          }
          break;
        case 2:
          if (!data.password?.trim()) {
            newErrors.password = "Password is required";
          } else if (data.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters";
          } else if (!/[A-Z]/.test(data.password)) {
            newErrors.password =
              "Password must contain at least one uppercase letter";
          } else if (!/[a-z]/.test(data.password)) {
            newErrors.password =
              "Password must contain at least one lowercase letter";
          }
          break;
        case 3:
          if (
            data.latitude == null ||
            data.longitude == null ||
            !data.address?.trim() ||
            !data.city?.trim() ||
            !data.country?.trim()
          ) {
            newErrors.address =
              "Please search and select your address from the suggestions";
          } else if (!data.postcode?.trim()) {
            newErrors.address =
              "Selected address is missing a postcode. Please choose a more specific address.";
          }
          break;
      }

      setErrors(newErrors);
      return newErrors;
    },
    [signUpData],
  );

  const showValidationFeedback = useCallback(
    (stepErrors: SignUpFieldErrors) => {
      const firstError = Object.values(stepErrors).find(Boolean);
      if (firstError) {
        showSnackbarWithConfig({
          message: firstError,
          type: "error",
          duration: 3000,
        });
      }
    },
    [showSnackbarWithConfig],
  );

  /**
   * Submit validated signup data and navigate to pending approval on success.
   */
  const handleSubmit = useCallback(async () => {
    const stepErrors = validateStep(3);
    if (Object.keys(stepErrors).length > 0 || !signUpData) {
      showValidationFeedback(
        Object.keys(stepErrors).length
          ? stepErrors
          : { address: "Please complete all location fields" },
      );
      return;
    }

    dispatch(setIsLoading(true));
    try {
      const response = await register(signUpData).unwrap();
      if (response && response.user) {
        dispatch(clearSignUpData());
        router.push("/onboarding/PendingApprovalScreen");
      }
    } catch (error: any) {
      let errorMessage = "Registration failed. Please try again.";
      let errorTitle = "Registration Failed";

      let rawErrorMessage = "";
      if (error?.data?.error) {
        rawErrorMessage = error.data.error;
      } else if (error?.response?.data?.error) {
        rawErrorMessage = error.response.data.error;
      } else if (error?.response?.data?.detail) {
        rawErrorMessage = error.response.data.detail;
      } else if (error?.message) {
        rawErrorMessage = error.message;
      }

      if (rawErrorMessage) {
        errorMessage = parseUserFriendlyError(rawErrorMessage);
      }

      if (error?.status >= 400 && error?.status < 500) {
        if (
          rawErrorMessage?.toLowerCase().includes("duplicate") ||
          rawErrorMessage?.toLowerCase().includes("already exists") ||
          rawErrorMessage?.toLowerCase().includes("username") ||
          rawErrorMessage?.toLowerCase().includes("email")
        ) {
          errorTitle = "Account Already Exists";
        } else {
          errorTitle = "Registration Issue";
        }
      } else if (error?.status >= 500) {
        errorTitle = "Server Error";
        errorMessage =
          "Something went wrong on our end. Please try again later.";
      }

      setAlertConfig({
        title: errorTitle,
        message: errorMessage,
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
    } finally {
      dispatch(setIsLoading(false));
    }
  }, [
    validateStep,
    signUpData,
    showValidationFeedback,
    dispatch,
    register,
    setAlertConfig,
    setIsVisible,
  ]);

  /** Advance to the next step or submit on the final step when terms are accepted. */
  const handleNext = useCallback(() => {
    const stepErrors = validateStep(currentStep);
    if (Object.keys(stepErrors).length > 0) {
      showValidationFeedback(stepErrors);
      return;
    }

    if (currentStep < 3) {
      setCurrentStep((step) => step + 1);
      return;
    }

    if (termsAccepted) {
      void handleSubmit();
    } else {
      setShowTermsModal(true);
    }
  }, [
    currentStep,
    termsAccepted,
    validateStep,
    showValidationFeedback,
    handleSubmit,
  ]);

  /** Validate step 2 including confirm-password match, then go to step 3. */
  const handleNextStep2 = useCallback(() => {
    const stepErrors = validateStep(2);
    if (Object.keys(stepErrors).length > 0) {
      showValidationFeedback(stepErrors);
      return;
    }
    if (signUpData?.password && confirmPassword !== signUpData.password) {
      showSnackbarWithConfig({
        message: "Please ensure both passwords are identical to proceed",
        type: "error",
        duration: 3000,
      });
      return;
    }
    setCurrentStep(3);
  }, [
    validateStep,
    signUpData?.password,
    confirmPassword,
    showSnackbarWithConfig,
    showValidationFeedback,
  ]);

  /** Go back one wizard step when not on the first step. */
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((step) => step - 1);
    }
  }, [currentStep]);

  /**
   * Update a signup form field in Redux and clear its field error.
   */
  const updateFormData = useCallback(
    (field: keyof SignUpScreenProps, value: string | number | null) => {
      const currentData = signUpData || EMPTY_SIGNUP;
      dispatch(setSignUpData({ ...currentData, [field]: value }));
      setErrors((prev) =>
        prev[field] ? { ...prev, [field]: undefined } : prev,
      );
    },
    [dispatch, signUpData],
  );

  /** Apply a Google Places selection to signup location fields (requires lat/lng). */
  const applyPlacesAddress = useCallback(
    (result: AddressSearchResult) => {
      const currentData = signUpData || EMPTY_SIGNUP;
      dispatch(
        setSignUpData({
          ...currentData,
          address: result.address,
          city: result.city,
          postcode: result.post_code,
          country: result.country,
          latitude: result.latitude,
          longitude: result.longitude,
        }),
      );
      setErrors((prev) =>
        prev.address ? { ...prev, address: undefined } : prev,
      );
    },
    [dispatch, signUpData],
  );

  /** Clear Places-selected location fields when the user hits Change. */
  const clearPlacesAddress = useCallback(() => {
    const currentData = signUpData || EMPTY_SIGNUP;
    dispatch(
      setSignUpData({
        ...currentData,
        address: "",
        city: "",
        postcode: "",
        country: "",
        latitude: null,
        longitude: null,
      }),
    );
  }, [dispatch, signUpData]);

  const updateConfirmPassword = useCallback(
    (value: string) => {
      dispatch(setConfirmPassword(value));
    },
    [dispatch],
  );

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleAcceptTerms = useCallback(() => {
    setTermsAccepted(true);
    setShowTermsModal(false);
  }, []);

  const handleShowTerms = useCallback(() => {
    setShowTermsModal(true);
  }, []);

  return {
    currentStep,
    errors,
    showPassword,
    steps,
    formData: signUpData,
    termsAccepted,
    showTermsModal,
    handleNext,
    handleBack,
    handleSubmit,
    updateFormData,
    applyPlacesAddress,
    clearPlacesAddress,
    togglePasswordVisibility,
    setCurrentStep,
    handleAcceptTerms,
    handleShowTerms,
    setShowTermsModal,
    handleNextStep2,
    updateConfirmPassword,
    confirmPassword,
  };
}

/** Provides shared signup wizard state to SignUpScreen and step components. */
export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useOnboardingState();
  return React.createElement(
    OnboardingContext.Provider,
    { value },
    children,
  );
}

/**
 * Access shared onboarding wizard state.
 * Must be used under OnboardingProvider.
 */
export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
