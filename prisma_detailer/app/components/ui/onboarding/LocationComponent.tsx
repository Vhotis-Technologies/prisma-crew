import React, { useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StyledText from "@/app/components/helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useOnboarding } from "@/app/app-hooks/useOnboarding";
import AddressSearchInput, {
  AddressSearchResult,
} from "@/app/components/shared/AddressSearchInput";

const LocationComponent = () => {
  const { formData, applyPlacesAddress, clearPlacesAddress, termsAccepted, errors } =
    useOnboarding();

  const textColor = useThemeColor({}, "text");
  const backgroundColor = useThemeColor({}, "background");
  const borderColor = useThemeColor({}, "borders");
  const errorColor = useThemeColor({}, "error");

  const initialSelectedAddress = useMemo((): AddressSearchResult | null => {
    if (
      !formData?.address ||
      formData.latitude == null ||
      formData.longitude == null
    ) {
      return null;
    }
    return {
      address: formData.address,
      post_code: formData.postcode || "",
      city: formData.city || "",
      country: formData.country || "",
      latitude: formData.latitude,
      longitude: formData.longitude,
    };
  }, [formData]);

  const handleSelect = useCallback(
    (result: AddressSearchResult) => {
      applyPlacesAddress(result);
    },
    [applyPlacesAddress],
  );

  const handleChange = useCallback(() => {
    clearPlacesAddress();
  }, [clearPlacesAddress]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.formSection}>
            <StyledText
              variant="bodyMedium"
              style={[styles.helperText, { color: textColor }]}
            >
              Search and select your home base address. Coordinates are required
              so we can assign nearby jobs accurately.
            </StyledText>

            <AddressSearchInput
              label="Home address"
              placeholder="Search for your address..."
              onSelect={handleSelect}
              onClear={handleChange}
              initialSelectedAddress={initialSelectedAddress}
            />

            {errors.address ? (
              <StyledText style={[styles.errorText, { color: errorColor }]}>
                {errors.address}
              </StyledText>
            ) : null}

            {initialSelectedAddress ? (
              <View style={[styles.confirmBox, { borderColor }]}>
                <StyledText variant="labelMedium" style={{ color: textColor }}>
                  Selected location
                </StyledText>
                <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.85 }}>
                  {[
                    formData?.address,
                    formData?.city,
                    formData?.postcode,
                    formData?.country,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </StyledText>
              </View>
            ) : null}
          </View>

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
  helperText: {
    marginBottom: 16,
    opacity: 0.85,
    lineHeight: 20,
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    gap: 4,
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
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    marginBottom: 8,
  },
});

export default LocationComponent;
