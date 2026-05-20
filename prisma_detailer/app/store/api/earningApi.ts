/**
 * Earnings API: summary, recent earnings, analytics, payouts, bank accounts.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./baseQuery";
import {
  BankAccountProps,
  PayoutHistoryProps,
  EarningsAnalyticsProps,
  PayoutItemProps,
  EarningsSummaryCardProps,
  EarningItemProps,
} from "@/app/interfaces/EarningInterface";

const earningApi = createApi({
  reducerPath: "earningApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /** Fetch earnings summary for the current period. */
    getEarningsSummary: builder.query<EarningsSummaryCardProps, void>({
      query: () => ({
        url: "/api/v1/earnings/get_earnings_summary/",
        method: "GET",
      }),
      transformResponse: (response: EarningsSummaryCardProps) => response,
    }),

    /** List recent earning line items. */
    getRecentEarnings: builder.query<EarningItemProps[], void>({
      query: () => ({
        url: "/api/v1/earnings/get_recent_earnings/",
        method: "GET",
      }),
      transformResponse: (response: EarningItemProps[]) => response,
    }),

    /** Fetch earnings analytics for charts and trends. */
    getEarningsAnalytics: builder.query<EarningsAnalyticsProps, void>({
      query: () => ({
        url: "/api/v1/earnings/get_earnings_analytics/",
        method: "GET",
      }),
      transformResponse: (response: EarningsAnalyticsProps) => response,
    }),

    /** List payout history records. */
    getPayoutHistory: builder.query<PayoutItemProps[], void>({
      query: () => ({
        url: "/api/v1/earnings/get_payout_history/",
        method: "GET",
      }),
      transformResponse: (response: PayoutItemProps[]) => response,
    }),

    /** List bank accounts linked for payouts. */
    getBankAccounts: builder.query<BankAccountProps[], void>({
      query: () => ({
        url: "/api/v1/earnings/get_bank_accounts/",
        method: "GET",
      }),
      transformResponse: (response: BankAccountProps[]) => response,
    }),

    /** Add a bank account for receiving payouts. */
    addBankAccount: builder.mutation<BankAccountProps, BankAccountProps>({
      query: (bankAccount) => ({
        url: "/api/v1/earnings/add_bank_account/",
        method: "POST",
        data: bankAccount,
      }),
      transformResponse: (response: BankAccountProps) => response,
    }),
  }),
});

export const {
  useGetEarningsSummaryQuery,
  useGetEarningsAnalyticsQuery,
  useGetPayoutHistoryQuery,
  useGetRecentEarningsQuery,
  useGetBankAccountsQuery,
  useAddBankAccountMutation,
} = earningApi;
export default earningApi;
