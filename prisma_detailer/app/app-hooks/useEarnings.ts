/**
 * Earnings hook: summary, analytics, payout history, and refetch helpers via RTK Query.
 */
import { useCallback } from "react";
import {
  useGetEarningsSummaryQuery,
  useGetEarningsAnalyticsQuery,
  useGetRecentEarningsQuery,
  useGetPayoutHistoryQuery,
  useGetBankAccountsQuery,
  useAddBankAccountMutation,
} from "@/app/store/api/earningApi";

/**
 * Aggregates earnings RTK Query data and exposes payout/bank-account action stubs.
 * @returns Earnings datasets, loading flags, refetch helper, and action handlers
 */
export const useEarnings = () => {
  const {
    data: earningsSummary,
    isLoading: isLoadingEarningsSummary,
    refetch: refetchEarningsSummary,
  } = useGetEarningsSummaryQuery();
  const {
    data: recentEarnings,
    isLoading: isLoadingRecentEarnings,
    refetch: refetchRecentEarnings,
  } = useGetRecentEarningsQuery();
  const {
    data: earningsAnalytics,
    isLoading: isLoadingEarningsAnalytics,
    refetch: refetchEarningsAnalytics,
  } = useGetEarningsAnalyticsQuery();
  const {
    data: payoutHistory,
    isLoading: isLoadingPayoutHistory,
    refetch: refetchPayoutHistory,
  } = useGetPayoutHistoryQuery();

  /** Refetch all earnings-related queries. */
  const handleRefetchData = useCallback(() => {
    refetchEarningsSummary();
    refetchRecentEarnings();
    refetchEarningsAnalytics();
    refetchPayoutHistory();
  }, [
    refetchEarningsSummary,
    refetchRecentEarnings,
    refetchEarningsAnalytics,
    refetchPayoutHistory,
  ]);

  const isAllDataLoading =
    isLoadingEarningsSummary ||
    isLoadingRecentEarnings ||
    isLoadingEarningsAnalytics ||
    isLoadingPayoutHistory;

  /**
   * Set bank account as primary.
   * @param accountId - Bank account ID to promote
   */
  const setPrimaryBankAccount = useCallback((accountId: string) => {
    // Set primary bank account
    // TODO: Implement set primary bank account functionality
  }, []);

  /**
   * Delete a bank account.
   * @param accountId - Bank account ID to remove
   */
  const deleteBankAccount = useCallback((accountId: string) => {
    // Delete bank account
    // TODO: Implement delete bank account functionality
  }, []);

  /**
   * Add a new bank account.
   * @param accountData - Bank account payload
   */
  const addBankAccount = useCallback((accountData: any) => {
    // Add bank account
    // TODO: Implement add bank account functionality
  }, []);

  /**
   * Request a payout to a bank account.
   * @param amount - Payout amount
   * @param bankAccountId - Destination bank account ID
   */
  const requestPayout = useCallback((amount: number, bankAccountId: string) => {
    // Request payout
    // TODO: Implement request payout functionality
  }, []);

  return {
    earningsSummary,
    recentEarnings,
    earningsAnalytics,
    payoutHistory,
    isAllDataLoading,
    isLoadingEarningsSummary,
    isLoadingRecentEarnings,
    isLoadingEarningsAnalytics,
    isLoadingPayoutHistory,
    handleRefetchData,
    setPrimaryBankAccount,
    deleteBankAccount,
    addBankAccount,
    requestPayout,
  };
};
