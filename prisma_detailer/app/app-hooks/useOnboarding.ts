import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useAppDispatch, useAppSelector } from "@/app/store/my_store";
import {
  setSignUpData,
  clearSignUpData,
  setUser,
  setAccessToken,
  setRefreshToken,
  setIsAuthenticated,
  setIsLoading,
  setConfirmPassword,
} from "@/app/store/slices/authSlice";
import { SignUpScreenProps } from "@/app/interfaces/AuthInterface";
import { RootState } from "@/app/store/my_store";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { useRegisterMutation } from "@/app/store/api/authApi";
import { UserProfileProps } from "@/app/interfaces/ProfileInterfaces";
import * as SecureStore from "expo-secure-store";
import { useSnackbar } from "@/app/contexts/SnackbarContext";

/**
 * Parse technical error messages into user-friendly messages
 */
const parseUserFriendlyError = (errorMessage: string): string => {
  const message = errorMessage.toLowerCase();

  // Handle duplicate username/email errors
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

  // Handle constraint violations
  if (message.includes("violates unique constraint")) {
    return "This information is already in use. Please check your details and try again.";
  }

  // Handle foreign key constraint errors
  if (message.includes("foreign key constraint")) {
    return "There was an issue with your registration data. Please try again.";
  }

  // Handle validation errors
  if (
    message.includes("validation error") ||
    message.includes("invalid input")
  ) {
    return "Please check your information and make sure all fields are filled correctly.";
  }

  // Handle network/connection errors
  if (
    message.includes("network error") ||
    message.includes("connection refused")
  ) {
    return "Unable to connect to our servers. Please check your internet connection and try again.";
  }

  // Handle timeout errors
  if (message.includes("timeout") || message.includes("request timeout")) {
    return "The request took too long to process. Please try again.";
  }

  // Handle authentication/authorization errors
  if (message.includes("unauthorized") || message.includes("forbidden")) {
    return "Access denied. Please try again or contact support.";
  }

  // Handle server errors
  if (message.includes("internal server error") || message.includes("500")) {
    return "Something went wrong on our end. Please try again later or contact support if the problem persists.";
  }

  // Handle missing fields
  if (
    message.includes("missing required fields") ||
    message.includes("required field")
  ) {
    return "Please fill in all required fields and try again.";
  }

  // Handle email format errors
  if (message.includes("invalid email") || message.includes("email format")) {
    return "Please enter a valid email address.";
  }

  // Handle password errors
  if (
    message.includes("password") &&
    (message.includes("short") || message.includes("weak"))
  ) {
    return "Password must be at least 8 characters long.";
  }

  // Handle phone number errors
  if (
    message.includes("phone") &&
    (message.includes("invalid") || message.includes("format"))
  ) {
    return "Please enter a valid phone number.";
  }

  // If no specific pattern matches, return a generic user-friendly message
  return "Registration failed. Please check your information and try again.";
};

export const useOnboarding = () => {
  const dispatch = useAppDispatch();
  const { showSnackbar, showSnackbarWithConfig } = useSnackbar();
  const signUpData = useAppSelector(
    (state: RootState) => state.auth.signUpData
  );
  const confirmPassword = useAppSelector(
    (state: RootState) => state.auth.confirmPassword
  );

  /* Import the alert context */
  const { setAlertConfig, setIsVisible } = useAlertContext();

  /* Import the auth api register mutation to be used to register a new user */
  const [register, { isLoading: isRegisterLoading }] = useRegisterMutation();

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Partial<SignUpScreenProps>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const steps = [
    { id: 1, title: "Personal Info", icon: "person-outline" },
    { id: 2, title: "Contact Details", icon: "mail-outline" },
    { id: 3, title: "Location", icon: "location-outline" },
  ];

  const validateStep = (step: number): boolean => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:148',message:'validateStep entry',data:{step,hasSignUpData:!!signUpData,signUpDataKeys:signUpData?Object.keys(signUpData):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const newErrors: Partial<SignUpScreenProps> = {};

    if (!signUpData) return false;

    switch (step) {
      case 1:
        if (!signUpData.first_name?.trim())
          newErrors.first_name = "First name is required";
        if (!signUpData.last_name?.trim())
          newErrors.last_name = "Last name is required";
        if (!signUpData.email?.trim()) {
          newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(signUpData.email)) {
          newErrors.email = "Please enter a valid email";
        }
        if (!signUpData.phone?.trim()) {
          newErrors.phone = "Phone number is required";
        } else {
          // Remove all non-digit characters to check length
          const phoneDigits = signUpData.phone.replace(/\D/g, "");
          if (phoneDigits.length > 12) {
            newErrors.phone = "Phone number cannot exceed 12 digits";
          } else if (!/^\+?[\d\s\-\(\)]{10,12}$/.test(signUpData.phone)) {
            newErrors.phone =
              "Please enter a valid phone number (10-12 digits)";
          }
        }
        break;
      case 2:
        if (!signUpData.password?.trim()) {
          newErrors.password = "Password is required";
        } else if (signUpData.password && signUpData.password.length < 8) {
          newErrors.password = "Password must be at least 8 characters";
        } else if (signUpData.password && !/[A-Z]/.test(signUpData.password)) {
          newErrors.password =
            "Password must contain at least one uppercase letter";
        } else if (signUpData.password && !/[a-z]/.test(signUpData.password)) {
          newErrors.password =
            "Password must contain at least one lowercase letter";
        }
        // Note: Confirm password validation would need to be handled in the component
        // since it's not stored in the main formData
        break;
      case 3:
        if (!signUpData.address?.trim())
          newErrors.address = "Address is required";
        if (!signUpData.city?.trim()) newErrors.city = "City is required";
        if (!signUpData.postcode?.trim())
          newErrors.postcode = "Postcode is required";
        if (!signUpData.country?.trim())
          newErrors.country = "Country is required";
        break;
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:204',message:'validateStep exit',data:{step,isValid,errors:Object.keys(newErrors),newErrors},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return isValid;
  };

  const handleNext = () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:207',message:'handleNext entry',data:{currentStep,termsAccepted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (currentStep === 2) {
      // For step 2, we need to use the custom validation that includes confirm password
      // This will be handled by the SecurityComponent calling handleNextStep2
      // For now, just use the standard validation
      if (validateStep(currentStep)) {
        setCurrentStep(currentStep + 1);
      }
    } else if (validateStep(currentStep)) {
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      } else {
        // On the final step, check if terms are accepted before submitting
        if (termsAccepted) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:220',message:'handleNext calling handleSubmit',data:{currentStep,termsAccepted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          handleSubmit();
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:223',message:'handleNext showing terms modal',data:{currentStep,termsAccepted},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
          // #endregion
          setShowTermsModal(true);
        }
      }
    }
  };

  // Custom handleNext for step 2 that includes confirm password validation
  const handleNextStep2 = () => {
    // Validate confirm password
    // Validate sign up data password
    if (!validateStep(2)) {
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
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Submit the form to the server if the current step is the last step, and the form is valid.
   * The method will show an alert after successfully registering the user,
   * returning the user to the dashboard screen.
   * @returns {token: string, refresh: string, user: UserProfileProps}
   * Save these in the redux store and the local storage.
   */
  const handleSubmit = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:260',message:'handleSubmit entry',data:{currentStep,hasSignUpData:!!signUpData,signUpDataKeys:signUpData?Object.keys(signUpData):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const validationResult = validateStep(currentStep);
    const hasSignUpData = !!signUpData;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:263',message:'handleSubmit validation check',data:{validationResult,hasSignUpData,currentStep,willProceed:validationResult&&hasSignUpData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (validationResult && hasSignUpData) {
      // Submit signup data
      dispatch(setIsLoading(true));
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:268',message:'handleSubmit before register call',data:{signUpDataKeys:Object.keys(signUpData||{})},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        const response = await register(signUpData).unwrap();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:270',message:'handleSubmit register success',data:{hasResponse:!!response},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        // Process registration response - account created successfully, navigate to pending approval screen
        if (response && response.user) {
          // Clear signup data and navigate to pending approval screen
          dispatch(clearSignUpData());
          router.push("/onboarding/PendingApprovalScreen");
        }
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:299',message:'handleSubmit catch block',data:{errorType:typeof error,errorMessage:error?.message,errorData:error?.data,errorResponse:error?.response?.data,errorStatus:error?.response?.status,fullError:JSON.stringify(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        let errorMessage = "Registration failed. Please try again.";
        let errorTitle = "Registration Failed";

        // Extract error message from different response structures
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

        // Convert technical error messages to user-friendly messages
        if (rawErrorMessage) {
          errorMessage = parseUserFriendlyError(rawErrorMessage);
        }

        // Determine if this is a validation error or server error
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          // Check if it's a duplicate account error
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
        } else if (error?.response?.status >= 500) {
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
        return;
      } finally {
        dispatch(setIsLoading(false));
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/73479b8f-cd94-42e8-a518-8d8ec29914be',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useOnboarding.ts:352',message:'handleSubmit early return',data:{validationResult,hasSignUpData,currentStep},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  }, [currentStep, signUpData, dispatch, setAlertConfig, register]);

  const updateFormData = (field: keyof SignUpScreenProps, value: string) => {
    const currentData = signUpData || {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      password: "",
      address: "",
      city: "",
      postcode: "",
      country: "",
    };
    dispatch(setSignUpData({ ...currentData, [field]: value }));
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined });
    }
  };

  const updateConfirmPassword = (value: string) => {
    dispatch(setConfirmPassword(value));
  };

  /**
   * Save the user data to the async storage after login.
   * This is used when the user tries to relogin,
   * @param user The returned user data which is of interface {User | Seller}
   * @param access The access token returned from the server
   * @param refresh The refresh token returned from the server
   */
  const saveDataToStorage = async (
    user: UserProfileProps | null,
    access: string,
    refresh: string
  ) => {
    try {
      await SecureStore.setItemAsync("user", JSON.stringify(user));
      await SecureStore.setItemAsync("access", access);
      await SecureStore.setItemAsync("refresh", refresh);
      // Data saved to storage
    } catch (error) {
      console.error("Error saving data to storage:", error);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  const handleShowTerms = () => {
    setShowTermsModal(true);
  };

  return {
    // State
    currentStep,
    errors,
    showPassword,
    steps,
    formData: signUpData,
    termsAccepted,
    showTermsModal,

    // Actions
    handleNext,
    handleBack,
    handleSubmit,
    updateFormData,
    togglePasswordVisibility,
    setCurrentStep,
    handleAcceptTerms,
    handleShowTerms,
    setShowTermsModal,
    handleNextStep2,
    updateConfirmPassword,
    confirmPassword,
  };
};
