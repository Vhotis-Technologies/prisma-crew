import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import { RecentJobProps } from "@/app/interfaces/DashboardInterface";
import RecentJobList from "./RecentJobList";
import NoActivityCard from "./NoActivityCard";

interface RecentActivityCardProps {
  data: RecentJobProps[] | undefined;
  onViewAllJobs?: () => void;
}

const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  data,
  onViewAllJobs,
}) => {
  const backgroundColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "button");

  // Check if data is null, undefined, or empty array
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <NoActivityCard />;
  }

  // Ensure arrays exist
  const recentJobs = data;

  return (
    <View style={[styles.container, { backgroundColor, borderColor }]}>
      <View style={styles.header}>
        <StyledText variant="titleMedium" style={{ color: textColor }}>
          Recent Activity
        </StyledText>

        {recentJobs.length > 0 && (
          <Pressable onPress={onViewAllJobs}>
            <StyledText variant="bodySmall" style={{ color: primaryColor }}>
              View All
            </StyledText>
          </Pressable>
        )}
      </View>

      {recentJobs.length > 0 && (
        <View style={styles.content}>
          <RecentJobList jobs={recentJobs} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    minHeight: 300,
    flex: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  content: {
    flex: 1,
    minHeight: 200,
    maxHeight: 300,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    minHeight: 150, // Added minimum height for empty state
  },
});

export default RecentActivityCard;
