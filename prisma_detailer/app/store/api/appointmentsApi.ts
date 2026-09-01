/**
 * Appointments API: list, details, start/complete, images, fleet maintenance.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./baseQuery";
import {
  JobCardProps,
  JobDetailsProps,
} from "@/app/interfaces/AppointmentInterface";

const appointmentsApi = createApi({
  reducerPath: "appointmentsApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /** List appointments for a given date. */
    getAllAppointments: builder.query<JobCardProps[], { date: string }>({
      query: ({ date }) => ({
        url: `/api/v1/appointments/get_all_appointments/`,
        method: "GET",
        params: { date },
      }),
      transformResponse: (response: JobCardProps[] | { error?: string }) =>
        Array.isArray(response) ? response : [],
    }),

    /** Completed and past jobs for the signed-in crew member. */
    getJobHistory: builder.query<
      { jobs: JobCardProps[]; has_more: boolean },
      { limit?: number; offset?: number }
    >({
      query: ({ limit = 30, offset = 0 }) => ({
        url: `/api/v1/appointments/get_job_history/`,
        method: "GET",
        params: { limit, offset },
      }),
    }),

    /** Fetch full details for one appointment by id. */
    getAppointmentDetails: builder.query<
      JobDetailsProps,
      { id: string | null }
    >({
      query: ({ id }) => ({
        url: `/api/v1/appointments/get_appointment_details/`,
        method: "GET",
        params: { id },
      }),
      transformResponse: (response: JobDetailsProps) => response,
    }),

    /** Mark an appointment as completed. */
    completeAppointment: builder.mutation<{ message: string }, { id: string }>({
      query: ({ id }) => ({
        url: `/api/v1/appointments/complete_appointment/`,
        method: "PATCH",
        data: { id },
      }),
    }),

    /** Mark an appointment as started. */
    startAppointment: builder.mutation<{ message: string }, { id: string }>({
      query: ({ id }) => ({
        url: `/api/v1/appointments/start_appointment/`,
        method: "PATCH",
        data: { id },
      }),
    }),

    /** Upload before-service images (multipart FormData). */
    uploadBeforeImages: builder.mutation<
      {
        message: string;
        images: Array<{
          id: number;
          image_url: string;
          uploaded_at: string;
          segment: string;
        }>;
      },
      FormData
    >({
      query: (formData) => ({
        url: `/api/v1/appointments/upload_before_images/`,
        method: "POST",
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    }),

    /** Upload after-service images (multipart FormData). */
    uploadAfterImages: builder.mutation<
      {
        message: string;
        images: Array<{
          id: number;
          image_url: string;
          uploaded_at: string;
          segment: string;
        }>;
      },
      FormData
    >({
      query: (formData) => ({
        url: `/api/v1/appointments/upload_after_images/`,
        method: "POST",
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    }),

    /** Submit fleet maintenance checklist data for a job. */
    submitFleetMaintenance: builder.mutation<
      {
        message: string;
        fleet_maintenance: any;
      },
      { job_id: string; [key: string]: any }
    >({
      query: (data) => ({
        url: `/api/v1/appointments/submit_fleet_maintenance/`,
        method: "POST",
        data,
      }),
    }),
  }),
});

export const {
  useGetAllAppointmentsQuery,
  useGetJobHistoryQuery,
  useLazyGetJobHistoryQuery,
  useCompleteAppointmentMutation,
  useGetAppointmentDetailsQuery,
  useStartAppointmentMutation,
  useUploadBeforeImagesMutation,
  useUploadAfterImagesMutation,
  useSubmitFleetMaintenanceMutation,
} = appointmentsApi;
export default appointmentsApi;
