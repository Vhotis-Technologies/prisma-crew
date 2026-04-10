import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useThemeColor } from "../../../../hooks/useThemeColor";
import StyledText from "../../helpers/StyledText";
import RecentEarningItem from "./RecentEarningItem";
import { EarningItemProps } from "@/app/interfaces/EarningInterface";

interface RecentEarningCardProps {
  earnings?: EarningItemProps[];
  onViewAllPress: () => void;
}

const RecentEarningCard: React.FC<RecentEarningCardProps> = ({
  earnings,
  onViewAllPress,
}) => {
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const backgroundColor = useThemeColor({}, "background");

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            Recent Earnings
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {earnings?.length} earnings
          </StyledText>
        </View>
        {earnings && earnings.length > 0 && (
          <TouchableOpacity
            onPress={onViewAllPress}
            style={[styles.viewAllButton, { backgroundColor }]}
          >
            <StyledText variant="bodySmall" style={{ color: textColor }}>
              View All
            </StyledText>
          </TouchableOpacity>
        )}
      </View>

      {/* Earnings List */}
      <ScrollView
        style={[
          styles.earningsList,
          { minHeight: earnings?.length === 0 ? 120 : 200 },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {earnings?.length === 0 ? (
          <View style={styles.emptyState}>
            <StyledText
              variant="titleLarge"
              style={{ color: textColor, marginBottom: 12, fontSize: 32 }}
            >
              💰
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, textAlign: "center", marginBottom: 8 }}
            >
              You have not earned any hourly pay with us yet.
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7, textAlign: "center" }}
            >
              Come back when you have completed a few appointments to see your
              earnings.
            </StyledText>
          </View>
        ) : (
          earnings?.map((earning, index) => (
            <RecentEarningItem
              key={earning.id || `earning-${index}`}
              earning={earning}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    flex: 1,
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: {
    marginBottom: 16,
  },
  earningsList: {
    flex: 1,
    maxHeight: 400,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: "center",
    minHeight: 120,
    justifyContent: "center",
  },
  viewAllButton: {
    padding: 5,
    borderRadius: 5,
  },
});

export default RecentEarningCard;
