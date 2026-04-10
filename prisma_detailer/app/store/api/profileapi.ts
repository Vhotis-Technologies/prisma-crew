import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./baseQuery";
import { DetailerStatisticsInterface } from "@/app/interfaces/ProfileInterfaces";

const profileApi = createApi({
  reducerPath: "profileApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /* Get the statistics of the detailer profile */
    getProfileStatistics: builder.query<DetailerStatisticsInterface, void>({
      query: () => ({
        url: "/api/v1/profile/get_profile_statistics/",
        method: "GET",
      }),
      transformResponse: (response: DetailerStatisticsInterface) => response,
    }),

    /**
     * Update the push notification token of the user.
     * on the server side, we will simply update the push notification token of the user.
     */
    updatePushNotificationToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_push_notification_token/",
        method: "PATCH",
        data: { update },
      }),
    }),

    /**
     * Update the email notification token of the user.
     * on the server side, we will simply update the email notification token of the user.
     */
    updateEmailNotificationToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_email_notification_token/",
        method: "PATCH",
        data: { update },
      }),
    }),

    /**
     * Update the marketing email token of the user.
     * on the server side, we will simply update the marketing email token of the user.
     */
    updateMarketingEmailToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_marketing_email_token/",
        method: "PATCH",
        data: { update },
      }),
    }),

    /**
     * Update the detailer's current location (for Redis GEO and DB).
     * Called after login and optionally when app comes to foreground (throttled).
     */
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
