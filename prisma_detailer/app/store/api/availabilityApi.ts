/**
 * Availability API: get schedule, create/update slots, busy times per date.
 */
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
    /** Fetch detailer availability for the current year. */
    getAvailability: builder.query<AvailabilityStateFromServer, void>({
      query: () => ({
        url: "/api/v1/availability/get_availability/",
        method: "GET",
      }),
    }),

    /** Create or update availability for selected dates and time slots. */
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

    /** Get busy (booked) time slots for a single date. */
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
