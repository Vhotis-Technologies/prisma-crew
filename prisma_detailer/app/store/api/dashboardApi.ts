/**
 * Today overview for the crew home screen.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./baseQuery";
import { TodayOverviewProps } from "@/app/interfaces/DashboardInterface";

const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getTodayOverview: builder.query<TodayOverviewProps, void>({
      query: () => ({
        url: "/api/v1/dashboard/get_today_overview/",
        method: "GET",
      }),
      transformResponse: (response: TodayOverviewProps) => response,
    }),
  }),
});

export const { useGetTodayOverviewQuery } = dashboardApi;
export default dashboardApi;
