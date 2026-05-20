/**
 * Dashboard API: quick stats, recent jobs, today overview, start/complete job.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "./baseQuery";
import {
  QuickStatsProps,
  RecentJobProps,
  TodayOverviewProps,
} from "@/app/interfaces/DashboardInterface";

const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /** Fetch weekly/monthly earnings, job counts, and rating summary. */
    getQuickStats: builder.query<QuickStatsProps, void>({
      query: () => ({
        url: "/api/v1/dashboard/get_quick_stats/",
        method: "GET",
      }),
      transformResponse: (response: QuickStatsProps) => response,
    }),

    /** List recent jobs from the last 7 days. */
    getRecentJobs: builder.query<RecentJobProps[], void>({
      query: () => ({
        url: "/api/v1/dashboard/get_recent_jobs/",
        method: "GET",
      }),
      transformResponse: (response: { recentJobs: RecentJobProps[] }) =>
        response.recentJobs,
    }),

    /** Fetch today's appointment counts and current/next job. */
    getTodayOverview: builder.query<TodayOverviewProps, void>({
      query: () => ({
        url: "/api/v1/dashboard/get_today_overview/",
        method: "GET",
      }),
      transformResponse: (response: TodayOverviewProps) => response,
    }),

    /** Mark the dashboard current job as started. */
    startCurrentJob: builder.mutation<{message:string}, { id: string }>({
      query: ({ id }) => ({
        url: `/api/v1/dashboard/start_current_job/`,
        method: "PATCH",
        data: { id },
      }),
    }),

    /** Mark the dashboard current job as completed. */
    completeCurrentJob: builder.mutation<{message:string}, { id: string }>({
      query: ({ id }) => ({
        url: `/api/v1/dashboard/complete_current_job/`,
        method: "PATCH",
        data: { id },
      }),
    }),
  }),
});

export const {
  useGetQuickStatsQuery,
  useGetRecentJobsQuery,
  useGetTodayOverviewQuery,
  useStartCurrentJobMutation,
  useCompleteCurrentJobMutation,
} = dashboardApi;
export default dashboardApi;
