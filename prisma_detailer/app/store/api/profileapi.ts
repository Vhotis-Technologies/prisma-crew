/**
 * Profile API: statistics, notification prefs, location update.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./baseQuery";
import { DetailerStatisticsInterface } from "@/app/interfaces/ProfileInterfaces";

const profileApi = createApi({
  reducerPath: "profileApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /** Fetch detailer profile statistics (jobs, ratings, etc.). */
    getProfileStatistics: builder.query<DetailerStatisticsInterface, void>({
      query: () => ({
        url: "/api/v1/profile/get_profile_statistics/",
        method: "GET",
      }),
      transformResponse: (response: DetailerStatisticsInterface) => response,
    }),

    /** Enable or disable push notification preference. */
    updatePushNotificationToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_push_notification_token/",
        method: "PATCH",
        data: { update },
      }),
    }),

    /** Enable or disable email notification preference. */
    updateEmailNotificationToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_email_notification_token/",
        method: "PATCH",
        data: { update },
      }),
    }),

    /** Enable or disable marketing email preference. */
    updateMarketingEmailToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_marketing_email_token/",
        method: "PATCH",
        data: { update },
      }),
    }),

    /** Report current GPS coordinates for matching and Redis GEO index. */
    updateLocation: builder.mutation<
      { success: boolean; message: string },
      { latitude: number; longitude: number }
    >({
      query: ({ latitude, longitude }) => ({
        url: "/api/v1/profile/update_location/",
        method: "POST",
        data: { latitude, longitude },
      }),
    }),
  }),
});

export const {
  useGetProfileStatisticsQuery,
  useUpdatePushNotificationTokenMutation,
  useUpdateEmailNotificationTokenMutation,
  useUpdateMarketingEmailTokenMutation,
  useUpdateLocationMutation,
} = profileApi;
export default profileApi;
