import { StyleSheet, View } from "react-native";
import React from "react";
import { ReviewProps } from "@/app/interfaces/ProfileInterfaces";
import StyledText from "../../helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";

const ReviewItems = ({ review }: { review: ReviewProps }) => {
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const warningColor = useThemeColor({}, "warning");

  return (
    <View
      style={[styles.reviewCard, { backgroundColor: cardColor, borderColor }]}
    >
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <StyledText variant="labelLarge" style={styles.reviewerName}>
            {review.created_by}
          </StyledText>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= review.rating ? "star" : "star-outline"}
                size={16}
                color={star <= review.rating ? warningColor : borderColor}
              />
            ))}
          </View>
        </View>
        <StyledText variant="bodySmall" style={styles.reviewDate}>
          {new Date(review.created_at).toLocaleDateString()}
        </StyledText>
      </View>
      <StyledText variant="bodyMedium" style={styles.reviewComment}>
        {review.comment}
      </StyledText>
    </View>
  );
};

export default ReviewItems;

const styles = StyleSheet.create({
  reviewCard: {
    padding: 8,
    borderRadius: 2,
    borderWidth: 1,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    marginBottom: 4,
    fontWeight: "600",
  },
  ratingContainer: {
    flexDirection: "row",
    gap: 2,
  },
  reviewDate: {
    opacity: 0.6,
  },
  reviewComment: {
    lineHeight: 20,
  },
});
