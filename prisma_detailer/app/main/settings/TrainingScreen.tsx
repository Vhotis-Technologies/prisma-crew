import { StyleSheet, View, ScrollView, Dimensions } from "react-native";
import React from "react";
import StyledText from "@/app/components/helpers/StyledText";
import StyledButton from "@/app/components/helpers/StyledButton";
import { useThemeColor } from "@/hooks/useThemeColor";

const { width } = Dimensions.get("window");

const TrainingScreen = () => {
  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        <StyledText variant="titleLarge" style={styles.title}>
          Training Center
        </StyledText>
        <StyledText variant="bodyMedium" style={styles.subtitle}>
          Enhance your skills and stay ahead
        </StyledText>
      </View>

      <View
        style={[styles.mainCard, { backgroundColor: cardColor, borderColor }]}
      >
        <View style={styles.iconContainer}>
          <View
            style={[styles.iconBackground, { backgroundColor: primaryColor }]}
          >
            <StyledText variant="displaySmall" style={styles.iconText}>
              🎓
            </StyledText>
          </View>
        </View>

        <View style={styles.messageContainer}>
          <StyledText variant="titleLarge" style={styles.comingSoonTitle}>
            Coming Soon
          </StyledText>
          <StyledText variant="bodyMedium" style={styles.comingSoonMessage}>
            We're working hard to bring you comprehensive training modules,
            skill assessments, and professional development resources.
          </StyledText>
        </View>

        <View style={styles.featuresContainer}>
          <StyledText variant="titleMedium" style={styles.featuresTitle}>
            What to expect:
          </StyledText>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <View
                style={[styles.featureIcon, { backgroundColor: primaryColor }]}
              >
                <StyledText variant="titleSmall" style={styles.featureIconText}>
                  📚
                </StyledText>
              </View>
              <StyledText variant="bodySmall" style={styles.featureText}>
                Interactive learning modules
              </StyledText>
            </View>

            <View style={styles.featureItem}>
              <View
                style={[styles.featureIcon, { backgroundColor: primaryColor }]}
              >
                <StyledText variant="titleSmall" style={styles.featureIconText}>
                  🎯
                </StyledText>
              </View>
              <StyledText variant="bodySmall" style={styles.featureText}>
                Skill assessments & certifications
              </StyledText>
            </View>

            <View style={styles.featureItem}>
              <View
                style={[styles.featureIcon, { backgroundColor: primaryColor }]}
              >
                <StyledText variant="titleSmall" style={styles.featureIconText}>
                  📊
                </StyledText>
              </View>
              <StyledText variant="bodySmall" style={styles.featureText}>
                Progress tracking & analytics
              </StyledText>
            </View>

            <View style={styles.featureItem}>
              <View
                style={[styles.featureIcon, { backgroundColor: primaryColor }]}
              >
                <StyledText variant="titleSmall" style={styles.featureIconText}>
                  🏆
                </StyledText>
              </View>
              <StyledText variant="bodySmall" style={styles.featureText}>
                Achievement badges & rewards
              </StyledText>
            </View>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <StyledButton
            variant="tonal"
            onPress={() => {}}
            style={styles.notifyButton}
          >
            Notify Me When Available
          </StyledButton>
        </View>
      </View>

      <View
        style={[styles.infoCard, { backgroundColor: cardColor, borderColor }]}
      >
        <StyledText variant="titleSmall" style={styles.infoTitle}>
          Stay Updated
        </StyledText>
        <StyledText variant="bodySmall" style={styles.infoText}>
          We'll notify you as soon as our training platform is ready. In the
          meantime, focus on delivering exceptional service to your customers!
        </StyledText>
      </View>
    </ScrollView>
  );
};

export default TrainingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 5,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  mainCard: {
    borderRadius: 2,
    padding: 10,
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  iconText: {
    fontSize: 40,
  },
  messageContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  comingSoonTitle: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "bold",
  },
  comingSoonMessage: {
    textAlign: "center",
    lineHeight: 24,
    opacity: 0.8,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "600",
  },
  featureList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  featureIconText: {
    fontSize: 16,
  },
  featureText: {
    flex: 1,
    fontWeight: "500",
  },
  buttonContainer: {
    alignItems: "center",
  },
  notifyButton: {
    minWidth: width * 0.7,
  },
  infoCard: {
    borderRadius: 2,
    padding: 10,
    borderWidth: 1,
  },
  infoTitle: {
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "600",
  },
  infoText: {
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.7,
  },
});
