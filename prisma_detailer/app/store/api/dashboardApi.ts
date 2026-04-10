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
    /**
     * Get the users quick stats.
     * ARGs: void
     * RESPONSE: QuickStatsProps{
     *  weeklyEarnings: number;
     *  monthlyEarnings: number;
     *  completedJobsThisWeek: number;
     *  completedJobsThisMonth: number;
     *  pendingJobsCount: number;
     *  averageRating: number;
     *  totalReviews: number;
     * }
     */
    getQuickStats: builder.query<QuickStatsProps, void>({
      query: () => ({
        url: "/api/v1/dashboard/get_quick_stats/",
        method: "GET",
      }),
      transformResponse: (response: QuickStatsProps) => response,
    }),

    /**
     * Get all the users recent jobs in the last 7 days.
     * ARGs: void
     * RESPONSE: RecentJobProps[]
     */
    getRecentJobs: builder.query<RecentJobProps[], void>({
      query: () => ({
        url: "/api/v1/dashboard/get_recent_jobs/",
        method: "GET",
      }),
      transformResponse: (response: { recentJobs: RecentJobProps[] }) =>
        response.recentJobs,
    }),

    /**
     * Get the users today overview.
     * ARGs: void
     * RESPONSE: TodayOverviewProps{
     *  totalAppointments: number;
     *  completedJobs: number;
     *  pendingJobs: number;
     *  nextAppointment?: NextAppointmentProps;
     *  currentJob?: CurrentJobProps;
     * }
     */
    getTodayOverview: builder.query<TodayOverviewProps, void>({
      query: () => ({
        url: "/api/v1/dashboard/get_today_overview/",
        method: "GET",
      }),
      transformResponse: (response: TodayOverviewProps) => response,
    }),

    /**
     * Start the current job.
     * ARGs: {id: string}
     * RESPONSE: void
     */
    startCurrentJob: builder.mutation<{message:string}, { id: string }>({
      query: ({ id }) => ({
        url: `/api/v1/dashboard/start_current_job/`,
        method: "PATCH",
        data: { id },
      }),
    }),

    /**
     * Complete the current job.
     * ARGs: {id: string}
     * RESPONSE: void
     */
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
