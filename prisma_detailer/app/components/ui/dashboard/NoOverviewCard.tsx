import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";

const NoOverviewCard: React.FC = () => {
  const backgroundColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");

  return (
    <View style={[styles.container, { backgroundColor, borderColor }]}>
      <View style={styles.content}>
        <View
          style={[styles.iconContainer, { backgroundColor: textColor + "20" }]}
        >
          <StyledText style={[styles.icon, { color: textColor }]}>
            📅
          </StyledText>
        </View>
        <StyledText
          variant="titleMedium"
          style={[styles.title, { color: textColor }]}
        >
          No Assignments Today
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={[styles.subtitle, { color: textColor, opacity: 0.7 }]}
        >
          You don't have any jobs scheduled for today. Check back later for new
          assignments!
        </StyledText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
  },
});

export default NoOverviewCard;
