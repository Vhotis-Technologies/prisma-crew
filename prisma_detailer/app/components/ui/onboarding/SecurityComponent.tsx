import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StyledText from "@/app/components/helpers/StyledText";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useOnboarding } from "@/app/app-hooks/useOnboarding";
import { useAlertContext } from "@/app/contexts/AlertContext";

const SecurityComponent = () => {
  const {
    formData,
    updateFormData,
    handleNextStep2,
    updateConfirmPassword,
    confirmPassword,
  } = useOnboarding();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borders");
  const errorColor = useThemeColor({}, "error");
  const iconColor = useThemeColor({}, "icons");

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  // Password validation function
  const validatePassword = (password: string) => {
    const errors = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    return errors;
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.scrollContent}>
          {/* Main Content */}
          <View style={styles.content}>
            {/* Form Section */}
            <View style={styles.formSection}>
              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.passwordInputWrapper}>
                  <StyledTextInput
                    label="Password"
                    placeholder="Enter your password"
                    value={formData?.password || ""}
                    onChangeText={(text) => updateFormData("password", text)}
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    style={styles.textInput}
                    placeholderTextColor={
                      textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                    }
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  >
                    <Ionicons
                      name={isPasswordVisible ? "eye-off" : "eye"}
                      size={20}
                      color={iconColor}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.passwordInputWrapper}>
                  <StyledTextInput
                    label="Confirm Password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChangeText={(text) => updateConfirmPassword(text)}
                    secureTextEntry={!isConfirmPasswordVisible}
                    autoCapitalize="none"
                    style={styles.textInput}
                    placeholderTextColor={
                      textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                    }
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() =>
                      setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                    }
                  >
                    <Ionicons
                      name={isConfirmPasswordVisible ? "eye-off" : "eye"}
                      size={20}
                      color={iconColor}
                    />
                  </TouchableOpacity>
                </View>
                {confirmPassword !== formData?.password ? (
                  <StyledText style={[styles.errorText, { color: errorColor }]}>
                    Passwords do not match
                  </StyledText>
                ) : null}
              </View>

              {/* Password Requirements */}
              <View style={styles.requirementsContainer}>
                <StyledText
                  style={[styles.requirementsTitle, { color: textColor }]}
                >
                  Password Requirements:
                </StyledText>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      formData?.password && formData.password.length >= 8
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={16}
                    color={
                      formData?.password && formData.password.length >= 8
                        ? "#4CAF50"
                        : iconColor
                    }
                  />
                  <StyledText
                    style={[styles.requirementText, { color: textColor }]}
                  >
                    At least 8 characters
                  </StyledText>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      formData?.password && /[A-Z]/.test(formData.password)
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={16}
                    color={
                      formData?.password && /[A-Z]/.test(formData.password)
                        ? "#4CAF50"
                        : iconColor
                    }
                  />
                  <StyledText
                    style={[styles.requirementText, { color: textColor }]}
                  >
                    At least one uppercase letter
                  </StyledText>
                </View>
                <View style={styles.requirementItem}>
                  <Ionicons
                    name={
                      formData?.password && /[a-z]/.test(formData.password)
                        ? "checkmark-circle"
                        : "ellipse-outline"
                    }
                    size={16}
                    color={
                      formData?.password && /[a-z]/.test(formData.password)
                        ? "#4CAF50"
                        : iconColor
                    }
                  />
                  <StyledText
                    style={[styles.requirementText, { color: textColor }]}
                  >
                    At least one lowercase letter
                  </StyledText>
                </View>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
    paddingTop: 50,
  },
  formSection: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
    borderRadius: 20,
  },
  textInput: {
    borderRadius: 20,
    fontSize: 16,
  },
  passwordInputWrapper: {
    position: "relative",
  },
  eyeIcon: {
    position: "absolute",
    right: 12,
    top: 30,
    zIndex: 1,
    padding: 5,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  requirementsContainer: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 12,
    marginLeft: 8,
    opacity: 0.8,
  },
});

export default SecurityComponent;
