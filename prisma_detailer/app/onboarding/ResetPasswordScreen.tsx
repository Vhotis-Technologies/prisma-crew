import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import StyledText from "../components/helpers/StyledText";
import StyledTextInput from "../components/helpers/StyledTextInput";
import StyledButton from "../components/helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import LinearGradientComponent from "../components/helpers/LinearGradientComponent";
import {
  useResetPasswordMutation,
  useValidateResetTokenMutation,
} from "@/app/store/api/authApi";
import { useAlertContext } from "@/app/contexts/AlertContext";

const ResetPasswordScreen = () => {
  const { token } = useLocalSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const { setAlertConfig } = useAlertContext();

  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const cardColor = useThemeColor({}, "cards");

  // API mutations
  const [validateResetToken] = useValidateResetTokenMutation();
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setAlertConfig({
          isVisible: true,
          title: "Invalid Link",
          message: "This password reset link is invalid.",
          type: "error",
          onConfirm: () => router.replace("/onboarding/SigninScreen"),
        });
        return;
      }

      try {
        const response = await validateResetToken({
          token: token as string,
        }).unwrap();

        if (response.valid) {
          setTokenValid(true);
          setUserEmail(response.user_email);
        } else {
          throw new Error("Invalid token");
        }
      } catch (error: any) {
        console.error("Token validation error:", error);

        let errorMessage = "This password reset link is invalid or expired.";
        if (error.data?.error) {
          errorMessage = error.data.error;
        }

        setAlertConfig({
          isVisible: true,
          title: "Invalid Link",
          message: errorMessage,
          type: "error",
          onConfirm: () => router.replace("/onboarding/SigninScreen"),
        });
      } finally {
        setIsValidatingToken(false);
      }
    };

    validateToken();
  }, [token, validateResetToken]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/(?=.*\d)/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const handleResetPassword = async () => {
    if (!password.trim()) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Please enter a new password",
        type: "error",
        onConfirm: () => {},
      });
      return;
    }

    if (!confirmPassword.trim()) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Please confirm your password",
        type: "error",
        onConfirm: () => {},
      });
      return;
    }

    if (password !== confirmPassword) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: "Passwords do not match",
        type: "error",
        onConfirm: () => {},
      });
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: passwordError,
        type: "error",
        onConfirm: () => {},
      });
      return;
    }

    try {
      const response = await resetPassword({
        token: token as string,
        password: password.trim(),
      }).unwrap();

      setAlertConfig({
        isVisible: true,
        title: "Success",
        message:
          "Your password has been reset successfully. You are now logged in.",
        type: "success",
        onConfirm: () => {
          router.replace("/main/dashboard/DashboardScreen");
        },
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      setAlertConfig({
        isVisible: true,
        title: "Error",
        message: error.data?.error || "Failed to reset password",
        type: "error",
        onConfirm: () => {},
      });
    }
  };

  // Show loading screen while validating token
  if (isValidatingToken) {
    return (
      <LinearGradientComponent
        color1={backgroundColor}
        color2={primaryColor}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 4, y: 1 }}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <StyledText
            variant="bodyMedium"
            style={[styles.loadingText, { color: textColor }]}
          >
            Validating reset link...
          </StyledText>
        </View>
      </LinearGradientComponent>
    );
  }

  // Don't render the form if token is invalid
  if (!tokenValid) {
    return null;
  }

  return (
    <LinearGradientComponent
      color1={backgroundColor}
      color2={primaryColor}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 4, y: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <StyledText
            variant="headlineSmall"
            style={[styles.title, { color: textColor }]}
          >
            Reset Password
          </StyledText>
          <StyledText
            variant="bodyMedium"
            style={[styles.subtitle, { color: textColor }]}
          >
            Enter your new password for {userEmail}
          </StyledText>
        </View>

        <View
          style={[
            styles.formContainer,
            { backgroundColor: cardColor, borderColor },
          ]}
        >
          <View style={styles.passwordContainer}>
            <StyledTextInput
              label="New Password"
              placeholder="Enter your new password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.passwordInput]}
            />
            <TouchableOpacity
              style={[styles.eyeIcon, { borderColor }]}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={textColor}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.passwordContainer}>
            <StyledTextInput
              label="Confirm Password"
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.passwordInput]}
            />
            <TouchableOpacity
              style={[styles.eyeIcon, { borderColor }]}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off" : "eye"}
                size={20}
                color={textColor}
              />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.requirementsCard,
              { backgroundColor: backgroundColor, borderColor },
            ]}
          >
            <StyledText
              variant="bodySmall"
              style={[styles.requirementsTitle, { color: textColor }]}
            >
              Password Requirements:
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={[styles.requirement, { color: textColor }]}
            >
              • At least 8 characters long
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={[styles.requirement, { color: textColor }]}
            >
              • Contains uppercase and lowercase letters
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={[styles.requirement, { color: textColor }]}
            >
              • Contains at least one number
            </StyledText>
          </View>

          <StyledButton
            variant="small"
            onPress={handleResetPassword}
            disabled={isLoading}
            style={styles.resetButton}
            title={isLoading ? "Resetting..." : "Reset Password"}
          />
        </View>
      </ScrollView>
    </LinearGradientComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  formContainer: {
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  input: {
    marginBottom: 20,
  },
  passwordContainer: {
    position: "relative",
    marginBottom: 20,
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: "absolute",
    right: 10,
    top: 25,
    padding: 8,
  },
  requirementsCard: {
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontWeight: "600",
    marginBottom: 8,
  },
  requirement: {
    marginBottom: 4,
    opacity: 0.8,
  },
  resetButton: {
    width: "100%",
  },
});

export default ResetPasswordScreen;
