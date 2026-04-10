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
    /**
     * Get the earnings summary for the current period
     * @params {void}
     * @returns {EarningsSummaryCardProps} the earnings summary data
     */
    getEarningsSummary: builder.query<EarningsSummaryCardProps, void>({
      query: () => ({
        url: "/api/v1/earnings/get_earnings_summary/",
        method: "GET",
      }),
      transformResponse: (response: EarningsSummaryCardProps) => response,
    }),

    /**
     * Get the recent earnings of the user (detailer)
     * @params {void}
     * @returns {EarningItemProps[]} the recent earnings data
     */
    getRecentEarnings: builder.query<EarningItemProps[], void>({
      query: () => ({
        url: "/api/v1/earnings/get_recent_earnings/",
        method: "GET",
      }),
      transformResponse: (response: EarningItemProps[]) => response,
    }),

    /**
     * Get the analytics of the user (detailer)
     * @params {void}
     * @returns {EarningsAnalyticsProps} the user analytics data for the current period
     */
    getEarningsAnalytics: builder.query<EarningsAnalyticsProps, void>({
      query: () => ({
        url: "/api/v1/earnings/get_earnings_analytics/",
        method: "GET",
      }),
      transformResponse: (response: EarningsAnalyticsProps) => response,
    }),

    /**
     * Get the payout history of the user (detailer)
     * @params {void}
     * @returns {PayoutItemProps[]} the payout history data
     */
    getPayoutHistory: builder.query<PayoutItemProps[], void>({
      query: () => ({
        url: "/api/v1/earnings/get_payout_history/",
        method: "GET",
      }),
      transformResponse: (response: PayoutItemProps[]) => response,
    }),

    /**
     * Get the bank accounts of the user (detailer)
     * @params {void}
     * @returns {BankAccountProps[]} the bank accounts data
     */
    getBankAccounts: builder.query<BankAccountProps[], void>({
      query: () => ({
        url: "/api/v1/earnings/get_bank_accounts/",
        method: "GET",
      }),
      transformResponse: (response: BankAccountProps[]) => response,
    }),

    /**
     * Add a bank account to the detailers account
     * @params {BankAccountProps} the bank account to add
     * @returns {BankAccountProps} the bank account that was added
     */
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
