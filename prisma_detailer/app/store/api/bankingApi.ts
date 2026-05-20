/**
 * Banking API: list accounts, set default, add, delete.
 */
import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "./baseQuery";
import { BankAccountProps } from "@/app/interfaces/BankingInterface";

const bankingApi = createApi({
  reducerPath: "bankingApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /** List all bank accounts for the authenticated detailer. */
    getBankAccounts: builder.query<BankAccountProps[], void>({
      query: () => ({
        url: "/api/v1/banking/get_bank_accounts/",
        method: "GET",
      }),
      transformResponse: (response: BankAccountProps[]) => response,
    }),

    /** Set a bank account as the default payout destination. */
    setDefaultBankAccount: builder.mutation<
      { message: string },
      { accountId: string }
    >({
      query: ({ accountId }) => ({
        url: "/api/v1/banking/set_default_bank_account/",
        method: "PATCH",
        data: { accountId },
      }),
      transformResponse: (response: { message: string }) => response,
    }),

    /** Create a new bank account record. */
    addBankAccount: builder.mutation<
      { message: string; account_name: string },
      BankAccountProps
    >({
      query: (bankAccount) => ({
        url: "/api/v1/banking/create_bank_account/",
        method: "POST",
        data: { bankAccountData: bankAccount },
      }),
      transformResponse: (response: {
        message: string;
        account_name: string;
      }) => response,
    }),

    /** Delete a bank account by id. */
    deleteBankAccount: builder.mutation<
      { message: string },
      { accountId: string }
    >({
      query: ({ accountId }) => ({
        url: "/api/v1/banking/delete_bank_account/",
        method: "DELETE",
        data: { accountId },
      }),
      transformResponse: (response: { message: string }) => response,
    }),
  }),
});

export const {
  useGetBankAccountsQuery,
  useSetDefaultBankAccountMutation,
  useAddBankAccountMutation,
  useDeleteBankAccountMutation,
} = bankingApi;
export default bankingApi;
