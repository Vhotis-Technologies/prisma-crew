import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
  StatusBar,
} from "react-native";
import { Link, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import StyledButton from "./components/helpers/StyledButton";
import StyledText from "./components/helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";

const { width, height } = Dimensions.get("window");

export default function LandingPage() {
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");

  const benefits = [
    {
      icon: "people-outline",
      title: "We Source Clients",
      description:
        "No need to find customers - we handle all client acquisition and bookings for you",
    },
    {
      icon: "construct-outline",
      title: "Professional Tools",
      description:
        "We provide all the equipment and supplies you need to deliver exceptional results",
    },
    {
      icon: "school-outline",
      title: "Comprehensive Training",
      description:
        "Get trained on our proven methods and techniques to ensure consistent quality",
    },
    {
      icon: "trending-up-outline",
      title: "Structured Growth",
      description:
        "Follow our proven workflow and watch your earnings grow with our support",
    },
    {
      icon: "cash-outline",
      title: "Earnings",
      description:
        "Earnings are paid out to your bank account every week. You can request a payout at any time.",
    },
    {
      icon: "wallet-outline",
      title: "Payouts",
      description:
        "You keep 100% of all your tips. You are paid hourly based on your work activity.",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[borderColor, backgroundColor]}
            style={styles.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroContent}>
              <Image
                source={require("../assets/images/logo.png")}
                style={[styles.logo, {shadowColor:"red"}]}
                resizeMode="contain"
              />

              <StyledText variant="headlineSmall" style={styles.heroTitle}>
                Join Prisma Crew
              </StyledText>

              <StyledText variant="bodyLarge" style={styles.heroSubtitle}>
                Become a Professional Car Detailer with Us
              </StyledText>

              <StyledText variant="bodyLarge" style={styles.heroDescription}>
                We provide everything you need: clients, tools, training, and a
                proven system. You focus on what you do best - detail cars.
              </StyledText>

              <View style={styles.heroButtons}>
                <StyledButton
                  variant="small"
                  onPress={() => router.push("/onboarding/SignUpScreen")}
                  style={styles.primaryButton}
                >
                  Apply Now
                </StyledButton>
                {/* Sign in button */}
                <StyledButton
                  variant="small"
                  onPress={() => router.push("/onboarding/SigninScreen")}
                  style={styles.secondaryButton}
                >
                  Sign In
                </StyledButton>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Benefits Section */}
        <View style={styles.featuresSection}>
          <StyledText
            variant="headlineSmall"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            Why Work With Prisma Crew?
          </StyledText>

          <StyledText
            variant="bodyLarge"
            style={[styles.sectionSubtitle, { color: textColor }]}
          >
            We take care of everything so you can focus on your craft
          </StyledText>

          <View style={styles.featuresGrid}>
            {benefits.map((benefit, index) => (
              <View
                key={index}
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: cardColor,
                    borderColor: borderColor,
                  },
                ]}
              >
                <View style={styles.featureIcon}>
                  <Ionicons
                    name={benefit.icon as any}
                    size={32}
                    color="#8B5CF6"
                  />
                </View>

                <StyledText
                  variant="titleMedium"
                  style={[styles.featureTitle, { color: textColor }]}
                >
                  {benefit.title}
                </StyledText>

                <StyledText
                  variant="bodyMedium"
                  style={[styles.featureDescription, { color: textColor }]}
                >
                  {benefit.description}
                </StyledText>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works Section */}
        <View style={styles.howItWorksSection}>
          <StyledText
            variant="headlineMedium"
            style={[styles.sectionTitle, { color: textColor }]}
          >
            How It Works
          </StyledText>

          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: "#8B5CF6" }]}>
                <StyledText variant="titleLarge" style={styles.stepNumberText}>
                  1
                </StyledText>
              </View>
              <View style={styles.stepContent}>
                <StyledText
                  variant="titleMedium"
                  style={[styles.stepTitle, { color: textColor }]}
                >
                  Apply & Get Trained
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.stepDescription, { color: textColor }]}
                >
                  Complete our application and receive comprehensive training on
                  our methods
                </StyledText>
              </View>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: "#8B5CF6" }]}>
                <StyledText variant="titleLarge" style={styles.stepNumberText}>
                  2
                </StyledText>
              </View>
              <View style={styles.stepContent}>
                <StyledText
                  variant="titleMedium"
                  style={[styles.stepTitle, { color: textColor }]}
                >
                  Get Equipped
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.stepDescription, { color: textColor }]}
                >
                  Receive professional tools and supplies to deliver outstanding
                  results
                </StyledText>
              </View>
            </View>

            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: "#8B5CF6" }]}>
                <StyledText variant="titleLarge" style={styles.stepNumberText}>
                  3
                </StyledText>
              </View>
              <View style={styles.stepContent}>
                <StyledText
                  variant="titleMedium"
                  style={[styles.stepTitle, { color: textColor }]}
                >
                  Start Working
                </StyledText>
                <StyledText
                  variant="bodyMedium"
                  style={[styles.stepDescription, { color: textColor }]}
                >
                  Follow our structured workflow and earn money doing what you
                  love
                </StyledText>
              </View>
            </View>
          </View>
        </View>

        {/* CTA Section */}
        <View
          style={[
            styles.ctaSection,
            { backgroundColor: cardColor, borderColor: borderColor },
          ]}
        >
          <StyledText
            variant="headlineMedium"
            style={[styles.ctaTitle, { color: textColor }]}
          >
            Ready to Start Your Career?
          </StyledText>

          <StyledText
            variant="bodyLarge"
            style={[styles.ctaDescription, { color: textColor }]}
          >
            Join our team of professional detailers and start earning with our
            complete support system.
          </StyledText>

          <StyledButton
            variant="large"
            onPress={() => router.push("/onboarding/SignUpScreen")}
            style={styles.ctaButton}
          >
            Apply to Join Our Team
          </StyledButton>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <StyledText
            variant="bodyMedium"
            style={[styles.footerText, { color: textColor }]}
          >
            © 2025 vhotis technologies
            <Link href="https://technologies.vhotis.com">vhotistechnologies.com</Link>
          </StyledText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    height: height * 0.7,
    position: "relative",
  },
  heroGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  heroContent: {
    alignItems: "center",
    maxWidth: 400,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 24,
    borderRadius:50, 
    shadowOffset: {width:0, height:2},
    elevation:5, 
    shadowRadius:4,
    shadowOpacity:0.25,
  },
  heroTitle: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "bold",
  },
  heroSubtitle: {
    textAlign: "center",
    marginBottom: 16,
    opacity: 0.9,
  },
  heroDescription: {
    textAlign: "center",
    marginBottom: 32,
    opacity: 0.8,
    lineHeight: 24,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  primaryButton: {
    minWidth: 140,
  },
  secondaryButton: {
    minWidth: 140,
  },
  featuresSection: {
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  sectionTitle: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "bold",
  },
  sectionSubtitle: {
    textAlign: "center",
    marginBottom: 48,
    opacity: 0.7,
  },
  featuresGrid: {
    gap: 24,
  },
  featureCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    textAlign: "center",
  },
  featureIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  featureTitle: {
    marginBottom: 8,
    fontWeight: "600",
    textAlign: "center",
  },
  featureDescription: {
    textAlign: "center",
    opacity: 0.7,
    lineHeight: 20,
  },
  howItWorksSection: {
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  stepsContainer: {
    gap: 32,
    marginTop: 32,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  stepNumber: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    marginBottom: 8,
    fontWeight: "600",
  },
  stepDescription: {
    opacity: 0.7,
    lineHeight: 20,
  },
  ctaSection: {
    margin: 24,
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  ctaTitle: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "bold",
  },
  ctaDescription: {
    textAlign: "center",
    marginBottom: 32,
    opacity: 0.7,
    lineHeight: 24,
  },
  ctaButton: {
    minWidth: 200,
  },
  footer: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  footerText: {
    opacity: 0.6,
  },
});
