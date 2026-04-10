import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useThemeColor } from "../../../../hooks/useThemeColor";
import StyledText from "../../../components/helpers/StyledText";
import PayoutCardItem from "./PayoutItems";
import { PayoutItemProps } from "@/app/interfaces/EarningInterface";


const PayoutHistoryCard = ({
  payments,
  onViewAllPress,
}: {
  payments?: PayoutItemProps[];
  onViewAllPress: () => void;
}) => {
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const backgroundColor = useThemeColor({}, "background");

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            Payout History
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {payments?.length} payouts
          </StyledText>
        </View>

        {payments && payments.length > 0 && (
          <Pressable
            onPress={onViewAllPress}
            style={[styles.viewAllButton, { backgroundColor }]}
          >
            <StyledText variant="bodySmall" style={{ color: textColor }}>
              View All
            </StyledText>
          </Pressable>
        )}
      </View>

      {/* Payouts List */}
      <ScrollView
        style={[
          styles.payoutsList,
          { minHeight: payments?.length === 0 ? 120 : 200 },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        {payments?.length === 0 ? (
          <View style={styles.emptyState}>
            <StyledText
              variant="titleLarge"
              style={{ color: textColor, marginBottom: 12, fontSize: 32 }}
            >
              🏦
            </StyledText>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, textAlign: "center", marginBottom: 8 }}
            >
              You have not made any payout request yet.
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7, textAlign: "center" }}
            >
              No payments has been delivered to your account. Come back again.
            </StyledText>
          </View>
        ) : (
          payments?.map((payout) => (
            <PayoutCardItem
              key={payout.id}
              payout={payout}
              onPress={() => {}}
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
  header: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payoutsList: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
    minHeight: 50,
    justifyContent: "center",
  },
  viewAllButton: {
    padding: 5,
    borderRadius: 5,
  },
});

export default PayoutHistoryCard;
