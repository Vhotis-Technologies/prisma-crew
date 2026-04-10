import { ScrollView, StyleSheet, Text, View } from "react-native";
import React from "react";
import { EarningItemProps } from "@/app/interfaces/EarningInterface";
import StyledText from "../../helpers/StyledText";
import RecentEarningItem from "./RecentEarningItem";

const RecentEarnings = ({ earnings }: { earnings?: EarningItemProps[] }) => {
  return (
    <View>
      <View>
        {earnings?.map((earning, index) => (
          <RecentEarningItem earning={earning} key={index} />
        ))}
      </View>
    </View>
  );
};

export default RecentEarnings;

const styles = StyleSheet.create({});
