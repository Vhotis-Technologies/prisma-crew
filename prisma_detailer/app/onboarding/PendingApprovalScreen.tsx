import React from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import StyledText from "../components/helpers/StyledText";
import StyledButton from "../components/helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

const PendingApprovalScreen = () => {
  // Theme colors
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");

  /**
   * Navigate back to login screen
   */
  const handleBackToLogin = () => {
    router.push("/onboarding/SigninScreen");
  };

  return (
    <View style={[styles.container, { backgroundColor: backgroundColor }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={textColor} />
        </TouchableOpacity>

        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="time-outline" size={64} color={primaryColor} />
          </View>
          <StyledText
            variant="headlineSmall"
            style={[styles.title, { color: textColor }]}
          >
            Account Pending Approval
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={[styles.subtitle, { color: textColor }]}
          >
            Your account is being reviewed
          </StyledText>
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          <StyledText
            variant="bodyLarge"
            style={[styles.message, { color: textColor }]}
          >
            Your account is pending approval. An admin will review your
            application and approve your account. You'll be able to log in once
            approved.
          </StyledText>

          <StyledText
            variant="bodyMedium"
            style={[styles.additionalInfo, { color: textColor }]}
          >
            We'll notify you once your account has been reviewed and approved.
            Thank you for your patience!
          </StyledText>
        </View>

        {/* Back to Login Button */}
        <View style={styles.buttonContainer}>
          <StyledButton
            variant="tonal"
            onPress={handleBackToLogin}
            style={styles.backToLoginButton}
          >
            Back to Login
          </StyledButton>
        </View>
      </ScrollView>
    </View>
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
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 40,
    marginTop: 50,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 32,
    width: "100%",
    alignSelf: "center",
  },
  message: {
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  additionalInfo: {
    textAlign: "center",
    opacity: 0.8,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    width: "100%",
    alignSelf: "center",
  },
  backToLoginButton: {
    width: "100%",
  },
});

export default PendingApprovalScreen;
