import { StyleSheet, Text, View } from "react-native";
import React from "react";
import PayoutCardItem from "./PayoutItems";
import { PayoutItemProps } from "@/app/interfaces/EarningInterface";

const PaymentHistory = ({ payments }: { payments?: PayoutItemProps[] }) => {
  return (
    <View>
      <View>
        {payments?.map((payment) => (
          <PayoutCardItem key={payment.id} payout={payment} />
        ))}
      </View>
    </View>
  );
};

export default PaymentHistory;

const styles = StyleSheet.create({});
