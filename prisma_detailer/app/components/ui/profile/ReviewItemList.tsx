import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { ReviewProps } from "@/app/interfaces/ProfileInterfaces";
import ReviewItems from "./ReviewItems";

const ReviewItemList = ({ reviews }: { reviews: ReviewProps[] }) => {
  return (
    <View>
      {reviews.map((review) => (
        <ReviewItems key={review.id} review={review} />
      ))}
    </View>
  );
};

export default ReviewItemList;

const styles = StyleSheet.create({});
