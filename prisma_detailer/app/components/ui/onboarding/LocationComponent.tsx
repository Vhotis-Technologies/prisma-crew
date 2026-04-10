import React from "react";
import { View, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StyledText from "@/app/components/helpers/StyledText";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useOnboarding } from "@/app/app-hooks/useOnboarding";

const LocationComponent = () => {
  const { formData, updateFormData, termsAccepted } = useOnboarding();

  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borders");
  const iconColor = useThemeColor({}, "icons");

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
              {/* Street Address Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Street Address"
                  placeholder="Enter your street address"
                  value={formData?.address || ""}
                  onChangeText={(text) => updateFormData("address", text)}
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                  importantForAutofill="yes"
                  autoComplete="street-address"
                />
              </View>

              {/* City and Postcode Row */}
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <StyledTextInput
                    label="City"
                    placeholder="Enter your city"
                    value={formData?.city || ""}
                    onChangeText={(text) => updateFormData("city", text)}
                    style={styles.textInput}
                    placeholderTextColor={
                      textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                    }
                    importantForAutofill="yes"
                    autoComplete="address-line1"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <StyledTextInput
                    label="Postcode"
                    placeholder="Enter postcode"
                    value={formData?.postcode || ""}
                    onChangeText={(text) => updateFormData("postcode", text)}
                    style={styles.textInput}
                    placeholderTextColor={
                      textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                    }
                    importantForAutofill="yes"
                    autoComplete="postal-code"
                  />
                </View>
              </View>

              {/* Country Input */}
              <View style={styles.inputContainer}>
                <StyledTextInput
                  label="Country"
                  placeholder="Enter your country"
                  value={formData?.country || ""}
                  onChangeText={(text) => updateFormData("country", text)}
                  style={styles.textInput}
                  placeholderTextColor={
                    textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                  }
                />
              </View>
            </View>

            {/* Terms Checkbox */}
            <View style={styles.termsContainer}>
              <View style={styles.checkboxContainer}>
                <View style={[styles.checkbox, { borderColor }]}>
                  {termsAccepted && (
                    <Ionicons name="checkmark" size={16} color={textColor} />
                  )}
                </View>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.termsText, { color: textColor }]}
                >
                  Please read and agree to our terms of service to proceed
                </StyledText>
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
  row: {
    flexDirection: "row",
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  termsContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});

export default LocationComponent;
