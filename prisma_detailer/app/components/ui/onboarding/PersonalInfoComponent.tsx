import React from "react";
import { View, StyleSheet } from "react-native";
import StyledText from "@/app/components/helpers/StyledText";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useOnboarding } from "@/app/app-hooks/useOnboarding";

const PersonalInfoComponent = () => {
  const { formData: signUpData, updateFormData, errors } = useOnboarding();

  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const errorColor = useThemeColor({}, "error");

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <StyledTextInput
                label="First Name"
                placeholder="Enter your first name"
                value={signUpData?.first_name || ""}
                onChangeText={(text) => updateFormData("first_name", text)}
                keyboardType="default"
                autoCapitalize="words"
                style={styles.textInput}
                placeholderTextColor={
                  textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                }
              />
              {errors.first_name ? (
                <StyledText style={[styles.errorText, { color: errorColor }]}>
                  {errors.first_name}
                </StyledText>
              ) : null}
            </View>

            <View style={styles.inputContainer}>
              <StyledTextInput
                label="Last Name"
                placeholder="Enter your last name"
                value={signUpData?.last_name || ""}
                onChangeText={(text) => updateFormData("last_name", text)}
                keyboardType="default"
                autoCapitalize="words"
                style={styles.textInput}
                placeholderTextColor={
                  textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                }
              />
              {errors.last_name ? (
                <StyledText style={[styles.errorText, { color: errorColor }]}>
                  {errors.last_name}
                </StyledText>
              ) : null}
            </View>

            <View style={styles.inputContainer}>
              <StyledTextInput
                label="Email"
                placeholder="Enter your email"
                value={signUpData?.email || ""}
                onChangeText={(text) => updateFormData("email", text)}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.textInput}
                placeholderTextColor={
                  textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                }
              />
              {errors.email ? (
                <StyledText style={[styles.errorText, { color: errorColor }]}>
                  {errors.email}
                </StyledText>
              ) : null}
            </View>

            <View style={styles.inputContainer}>
              <StyledTextInput
                label="Phone"
                placeholder="Enter your mobile number"
                value={signUpData?.phone || ""}
                onChangeText={(text) => updateFormData("phone", text)}
                keyboardType="phone-pad"
                maxLength={20}
                autoCapitalize="none"
                style={styles.textInput}
                placeholderTextColor={
                  textColor === "#FFFFFF" ? "#B0B0B0" : "#999999"
                }
              />
              {errors.phone ? (
                <StyledText style={[styles.errorText, { color: errorColor }]}>
                  {errors.phone}
                </StyledText>
              ) : null}
            </View>
          </View>
        </View>
      </View>
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
    paddingTop: 24,
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
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default PersonalInfoComponent;
