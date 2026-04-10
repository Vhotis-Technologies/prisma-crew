import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./baseQuery";
import type { AvailabilityStateFromServer } from "@/app/app-hooks/useAvailability";

/** Payload for create_availability: selected dates with time slot strings per date */
export interface CreateAvailabilityPayload {
  selectedDates: Array<{ date: string; timeSlots: string[] }>;
}

const availabilityApi = createApi({
  reducerPath: "availabilityApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /* Get an array of all the detailers availability for a year */
    getAvailability: builder.query<AvailabilityStateFromServer, void>({
      query: () => ({
        url: "/api/v1/availability/get_availability/",
        method: "GET",
      }),
    }),

    /* Create/update availability for a detailer */
    createAvailability: builder.mutation<
      AvailabilityStateFromServer,
      CreateAvailabilityPayload
    >({
      query: (payload) => ({
        url: "/api/v1/availability/create_availability/",
        method: "POST",
        data: payload,
      }),
    }),

    /* Get busy (job) time slots for a single date for the current detailer */
    getBusyTimes: builder.query<
      { date: string; busySlots: string[] },
      string | null
    >({
      query: (date) => ({
        url: "/api/v1/availability/get_busy_times/",
        method: "GET",
        params: date ? { date } : undefined,
      }),
    }),
  }),
});

export const {
  useGetAvailabilityQuery,
  useCreateAvailabilityMutation,
  useGetBusyTimesQuery,
  useLazyGetBusyTimesQuery,
} = availabilityApi;
export default availabilityApi;
