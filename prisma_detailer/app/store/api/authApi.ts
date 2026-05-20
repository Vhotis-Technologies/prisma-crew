/**
 * Auth API: login, register, refresh, terms, password reset.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "@/app/store/api/baseQuery";
import { SignUpScreenProps } from "@/app/interfaces/AuthInterface";
import { UserProfileProps } from "@/app/interfaces/ProfileInterfaces";

const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /** Authenticate detailer with email and password; returns user and tokens. */
    login: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/authentication/login/",
        method: "POST",
        data: credentials,
      }),
    }),

    /** Create a new detailer account from onboarding sign-up data. */
    register: builder.mutation<
      { message: string; user: UserProfileProps },
      SignUpScreenProps
    >({
      query: (credentials) => ({
        url: "/api/v1/onboard/create_new_user/",
        method: "POST",
        data: { credentials: credentials },
      }),
    }),

    /** Exchange refresh token for new access and refresh tokens. */
    refreshToken: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/authentication/refresh/",
        method: "POST",
        data: credentials,
      }),
    }),

    /** Fetch current terms and conditions document. */
    getTermsAndConditions: builder.query<
      { version: string; content: string; last_updated: string },
      void
    >({
      query: () => ({
        url: "/api/v1/terms/get_terms/",
        method: "GET",
      }),
    }),

    /** Send password reset email to the given address. */
    requestPasswordReset: builder.mutation<
      { message: string },
      { email: string }
    >({
      query: ({ email }) => ({
        url: "/api/v1/auth/password-reset/",
        method: "POST",
        data: { email },
      }),
    }),

    /** Validate a password-reset token before showing the reset form. */
    validateResetToken: builder.mutation<
      {
        valid: boolean;
        message: string;
        expires_at: string;
        user_email: string;
      },
      { token: string }
    >({
      query: ({ token }) => ({
        url: "/api/v1/auth/validate-reset-token/",
        method: "POST",
        data: { token },
      }),
    }),

    /** Set a new password using a valid reset token; returns session tokens. */
    resetPassword: builder.mutation<
      {
        message: string;
        access: string;
        refresh: string;
        user: UserProfileProps;
      },
      { token: string; password: string }
    >({
      query: ({ token, password }) => ({
        url: "/api/v1/auth/reset-password/",
        method: "POST",
        data: { token, password },
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useGetTermsAndConditionsQuery,
  useRequestPasswordResetMutation,
  useValidateResetTokenMutation,
  useResetPasswordMutation,
} = authApi;
export default authApi;
