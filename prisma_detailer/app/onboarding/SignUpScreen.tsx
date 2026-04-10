import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import StyledButton from "../components/helpers/StyledButton";
import StyledText from "../components/helpers/StyledText";
import TermsAcceptanceModal from "../components/helpers/TermsAcceptanceModal";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useOnboarding } from "@/app/app-hooks/useOnboarding";
import PersonalInfoComponent from "../components/ui/onboarding/PersonalInfoComponent";
import SecurityComponent from "../components/ui/onboarding/SecurityComponent";
import LocationComponent from "../components/ui/onboarding/LocationComponent";

const { width, height } = Dimensions.get("window");

const SignUpScreen = () => {
  const {
    currentStep,
    steps,
    handleNext,
    handleNextStep2,
    handleBack,
    termsAccepted,
    showTermsModal,
    handleAcceptTerms,
    handleShowTerms,
    setShowTermsModal,
  } = useOnboarding();

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={step.id} style={styles.stepContainer}>
          <View
            style={[
              styles.stepCircle,
              {
                backgroundColor:
                  currentStep >= step.id ? backgroundColor : backgroundColor,
                borderColor: currentStep >= step.id ? borderColor : borderColor,
              },
            ]}
          >
            {currentStep > step.id ? (
              <Ionicons name="checkmark" size={20} color={textColor} />
            ) : (
              <StyledText
                variant="labelLarge"
                style={[
                  styles.stepNumber,
                  {
                    color: currentStep >= step.id ? textColor : textColor,
                  },
                ]}
              >
                {step.id}
              </StyledText>
            )}
          </View>
          <StyledText
            variant="labelMedium"
            style={[
              styles.stepTitle,
              {
                color: currentStep >= step.id ? textColor : textColor,
              },
            ]}
          >
            {step.title}
          </StyledText>
          {index < steps.length - 1 && (
            <View
              style={[
                styles.stepLine,
                {
                  backgroundColor:
                    currentStep > step.id ? textColor : backgroundColor,
                },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <PersonalInfoComponent />;

      case 2:
        return <SecurityComponent />;

      case 3:
        return <LocationComponent />;

      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      >
        {renderStepIndicator()}
        {renderStepContent()}

        <View style={styles.buttonContainer}>
          {currentStep > 1 && (
            <StyledButton
              variant="tonal"
              onPress={handleBack}
              style={styles.backButtonLarge}
            >
              Back
            </StyledButton>
          )}

          <StyledButton
            variant="tonal"
            onPress={
              currentStep === 2
                ? handleNextStep2
                : currentStep === 3 && !termsAccepted
                ? handleShowTerms
                : handleNext
            }
            style={[
              styles.nextButton,
              currentStep === 3 && !termsAccepted  && styles.disabledButton,
            ]}
          >
            {currentStep === 3
              ? termsAccepted
                ? "Submit Application"
                : "Accept Terms to Continue"
              : "Continue"}
          </StyledButton>
        </View>
      </ScrollView>

      {/* Terms and Conditions Modal */}
      <TermsAcceptanceModal
        visible={showTermsModal}
        onAccept={handleAcceptTerms}
        onClose={() => setShowTermsModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 5,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 12,
    zIndex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 4,
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  stepIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  stepContainer: {
    alignItems: "center",
    flex: 1,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  stepNumber: {
    fontWeight: "bold",
  },
  stepTitle: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 12,
  },
  stepLine: {
    position: "absolute",
    top: 20,
    left: "50%",
    width: "100%",
    height: 2,
    zIndex: -1,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 16,
    marginTop: 20,
  },
  backButtonLarge: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default SignUpScreen;
