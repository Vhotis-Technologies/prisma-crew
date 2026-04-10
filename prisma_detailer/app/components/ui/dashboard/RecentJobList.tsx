import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { RecentJobProps } from "@/app/interfaces/DashboardInterface";
import RecentJobItem from "./RecentJobItem";

const RecentJobList = ({ jobs }: { jobs: RecentJobProps[] }) => {
  return (
    <View>
      {jobs?.map((job) => (
        <RecentJobItem key={job.id} job={job} />
      ))}
    </View>
  );
};

export default RecentJobList;

const styles = StyleSheet.create({});
