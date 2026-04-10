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
    /**
     * Get all appointments a user has for aspecifix date
     * @param date - The date to get appointments for
     * @returns {JobCardProps} The appointments for the date
     */
    getAllAppointments: builder.query<JobCardProps[], { date: string }>({
      query: ({ date }) => ({
        url: `/api/v1/appointments/get_all_appointments/`,
        method: "GET",
        params: { date },
      }),
      transformResponse: (response: JobCardProps[]) => response,
    }),

    /**
     * Get the details of a specific appointment by the id
     * @param id - The id of the appointment
     * @returns {JobDetailsProps} The appointment details
     */
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

    /**
     * Complete the appointment when the job is done
     * @param id - The id of the appointment
     * @returns {message: string} The message from the server
     */
    completeAppointment: builder.mutation<{ message: string }, { id: string }>({
      query: ({ id }) => ({
        url: `/api/v1/appointments/complete_appointment/`,
        method: "PATCH",
        data: { id },
      }),
    }),

    /**
     * Start the appointment
     * @param id - The id of the appointment
     * @returns {message: string} The message from the server
     */
    startAppointment: builder.mutation<{ message: string }, { id: string }>({
      query: ({ id }) => ({
        url: `/api/v1/appointments/start_appointment/`,
        method: "PATCH",
        data: { id },
      }),
    }),

    /**
     * Upload before images for a job
     * @param formData - FormData containing job_id, segment (interior/exterior), and image files
     * @returns {message: string, images: Array} The upload response with image details
     */
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

    /**
     * Upload after images for a job
     * @param formData - FormData containing job_id, segment (interior/exterior), and image files
     * @returns {message: string, images: Array} The upload response with image details
     */
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

    /**
     * Submit fleet maintenance data for a job
     * @param data - Object containing job_id and fleet maintenance fields
     * @returns {message: string, fleet_maintenance: FleetMaintenanceProps} The submission response
     */
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
  useCompleteAppointmentMutation,
  useGetAppointmentDetailsQuery,
  useStartAppointmentMutation,
  useUploadBeforeImagesMutation,
  useUploadAfterImagesMutation,
  useSubmitFleetMaintenanceMutation,
} = appointmentsApi;
export default appointmentsApi;
