import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  TouchableOpacity,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import StyledButton from "@/app/components/helpers/StyledButton";
import StyledText from "@/app/components/helpers/StyledText";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import TermsAcceptanceModal from "@/app/components/helpers/TermsAcceptanceModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useOnboarding } from "@/app/app-hooks/useOnboarding";
import { useAlertContext } from "@/app/contexts/AlertContext";

const { width, height } = Dimensions.get("window");

const PersonalInfoComponent = () => {
  const {
    formData: signUpData,
    updateFormData: handleSignUpData,
    handleSubmit: registerUser,
    termsAccepted,
    showTermsModal,
    handleAcceptTerms,
    handleShowTerms,
    setShowTermsModal,
  } = useOnboarding();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borders");
  const buttonColor = useThemeColor({}, "button");
  const errorColor = useThemeColor({}, "error");
  const cardColor = useThemeColor({}, "cards");
  const iconColor = useThemeColor({}, "icons");

  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleSubmit = async () => {
    if (!signUpData) return;
    try {
      if (
        !signUpData.first_name ||
        !signUpData.last_name ||
        !signUpData.email ||
        !signUpData.password
      ) {
        setAlertConfig({
          title: "Missing Fields",
          message: "Please fill in all required fields",
          type: "error",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
          },
        });
        return;
      }
      if (signUpData.password !== confirmPassword) {
        setPasswordError("Passwords do not match");
        return;
      }
      setPasswordError("");
      await registerUser();
    } catch (error) {
      console.error("Registration failed:", error);
    }
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
              {/* First Name Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="First Name"
                  placeholder="Enter your first name"
                  value={signUpData?.first_name || ""}
                  onChangeText={(text) => handleSignUpData("first_name", text)}
                  keyboardType="default"
                  autoCapitalize="words"
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
              </View>

              {/* Last Name Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Last Name"
                  placeholder="Enter your last name"
                  value={signUpData?.last_name || ""}
                  onChangeText={(text) => handleSignUpData("last_name", text)}
                  keyboardType="default"
                  autoCapitalize="words"
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Email"
                  placeholder="Enter your email"
                  value={signUpData?.email || ""}
                  onChangeText={(text) => handleSignUpData("email", text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
              </View>

              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Phone"
                  placeholder="Enter your mobile number"
                  value={signUpData?.phone || ""}
                  onChangeText={(text) => handleSignUpData("phone", text)}
                  keyboardType="phone-pad"
                  maxLength={12}
                  autoCapitalize="none"
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
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
});

export default PersonalInfoComponent;
