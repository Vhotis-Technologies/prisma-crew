/**
 * @fileoverview Custom React hook for managing bank account operations
 *
 * This hook provides a comprehensive solution for bank account management including:
 * - Fetching user's bank accounts
 * - Adding new bank accounts with validation
 * - Deleting existing bank accounts (with business rule protection)
 * - Setting default bank accounts
 * - Form data collection and state management
 *
 * @author Prisma Detailer Team
 * @version 1.0.0
 * @since 2024
 */

import { useState, useCallback } from "react";
import { BankAccountProps } from "@/app/interfaces/BankingInterface";
import {
  useAppDispatch,
  useAppSelector,
  RootState,
} from "@/app/store/my_store";
import {
  useGetBankAccountsQuery,
  useSetDefaultBankAccountMutation,
  useAddBankAccountMutation,
  useDeleteBankAccountMutation,
} from "@/app/store/api/bankingApi";
import {
  setNewBankAccount,
  clearNewBankAccount,
} from "@/app/store/slices/bankingSlice";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { useSnackbar } from "../contexts/SnackbarContext";
import { router } from "expo-router";

export const useBankAccount = () => {
  // Redux state management
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.auth.user);
  const newBankAccount = useAppSelector(
    (state: RootState) => state.banking.newBankAccount as BankAccountProps
  );

  /* RTK Query hooks for API operations */
  const {
    data: bankAccounts = [],
    isLoading: isLoadingBankAccounts,
    error: errorBankAccounts,
    refetch: refetchBankAccounts,
  } = useGetBankAccountsQuery();

  const [addBankAccount, { isLoading: isLoadingAddBankAccount }] =
    useAddBankAccountMutation();
  const [deleteBankAccount, { isLoading: isLoadingDeleteBankAccount }] =
    useDeleteBankAccountMutation();
  const [setDefaultBankAccount, { isLoading: isLoadingSetDefaultBankAccount }] =
    useSetDefaultBankAccountMutation();

  /* Alert context for user notifications */
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const { showSnackbarWithConfig } = useSnackbar();

  /* Validate the  */

  const handleAddBankAccount = useCallback(async () => {
    if (!newBankAccount?.account_name?.trim() || !newBankAccount?.iban?.trim()) {
      showSnackbarWithConfig({
        message: "Account holder name and IBAN are required",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      const response = await addBankAccount(newBankAccount).unwrap();
      if (response) {
        let message =
          response.message ||
          response.account_name ||
          "Bank account created successfully";
        showSnackbarWithConfig({
          message: message,
          type: "success",
          duration: 3000,
        });
        refetchBankAccounts();
        dispatch(clearNewBankAccount());
        router.back();
      }
    } catch (error: any) {
      // Extract error message from various response formats
      let errorMessage = "";
      errorMessage =
        error?.data?.message ||
        error?.data?.error ||
        error?.message ||
        "Failed to add bank account";
      showSnackbarWithConfig({
        message: errorMessage,
        type: "error",
        duration: 3000,
      });
    }
  }, [
    newBankAccount,
    dispatch,
    setAlertConfig,
    setIsVisible,
    addBankAccount,
    showSnackbarWithConfig,
    refetchBankAccounts,
  ]);

  /**
   * Removes a bank account from the user's account list
   *
   * This function includes business logic to prevent deletion of the primary
   * bank account and provides appropriate user feedback.
   *
   * @async
   * @function handleRemoveBankAccount
   * @param {string} accountId - The unique identifier of the bank account to remove
   * @returns {Promise<void>} Promise that resolves when the operation completes
   *
   * @description
   * **Business Rules:**
   * - Cannot delete the primary/default bank account
   * - Shows error alert if user attempts to delete default account
   *
   * **Flow:**
   * 1. Find bank account by ID
   * 2. Check if it's the default account
   * 3. If default: Show error and return
   * 4. If not default: Call delete API
   * 5. On success: Show success alert and refetch data
   * 6. On error: Show error alert
   *
   * @throws {Error} When API call fails or account is primary
   */
  const handleRemoveBankAccount = useCallback(
    async (accountId: string) => {
      try {
        // Find the bank account to check if it's the default
        const bankAccount = bankAccounts.find(
          (bankAccount: BankAccountProps) => bankAccount.id === accountId
        );

        // Prevent deletion of primary bank account
        if (bankAccount && bankAccount.is_default) {
          setAlertConfig({
            title: "Error",
            message: "Sorry but you can not delete the primary bank account",
            type: "error",
            isVisible: true,
            onConfirm: () => setIsVisible(false),
          });
          return;
        }

        // Delete the bank account
        const response = await deleteBankAccount({ accountId }).unwrap();
        if (response && response.message) {
          setAlertConfig({
            title: "Success",
            message: response.message,
            type: "success",
            isVisible: true,
            onConfirm: async () => {
              await refetchBankAccounts();
              setIsVisible(false);
            },
          });
        }
      } catch (error: any) {
        // Extract and display error message
        let errorMessage = "";
        errorMessage =
          error?.data?.message ||
          error?.data?.error ||
          error?.message ||
          "Failed to remove bank account";

        setAlertConfig({
          title: "Error",
          message: errorMessage,
          type: "error",
          isVisible: true,
          onConfirm: () => setIsVisible(false),
        });
      }
    },
    [
      bankAccounts,
      setAlertConfig,
      setIsVisible,
      deleteBankAccount,
      refetchBankAccounts,
    ]
  );

  /**
   * Sets a bank account as the default account
   *
   * This function includes logic to prevent unnecessary API calls when
   * the account is already the default account.
   *
   * @async
   * @function handleSetDefaultBankAccount
   * @param {string} accountId - The unique identifier of the bank account to set as default
   * @returns {Promise<void>} Promise that resolves when the operation completes
   *
   * @description
   * **Business Logic:**
   * - Checks if account is already default (early return)
   * - Only processes non-default accounts
   *
   * **Flow:**
   * 1. Find bank account by ID
   * 2. Check if already default (return early if so)
   * 3. Call API to set as default
   * 4. On success: Show success alert and refetch data
   * 5. On error: Show error alert
   *
   * @note There's a bug in the current implementation - line 175-176 has incomplete logic for finding the bank account
   *
   * @throws {Error} When API call fails
   */
  const handleSetDefaultBankAccount = useCallback(
    async (accountId: string) => {
      // Find the bank account to check if it's already default
      const bankaccount = bankAccounts.find(
        (bankaccount: BankAccountProps) => bankaccount.id === accountId
      );

      // Early return if already default
      if (bankaccount && bankaccount.is_default) {
        return;
      }

      /* Set the account as default */
      try {
        const response = await setDefaultBankAccount({ accountId }).unwrap();
        if (response && response.message) {
          showSnackbarWithConfig({
            message: response.message,
            type: "success",
            duration: 3000,
          });
          refetchBankAccounts();
        }
      } catch (error: any) {
        // Extract and display error message
        let errorMessage = "";
        errorMessage =
          error?.data?.message ||
          error?.data?.error ||
          error?.message ||
          "Failed to set default bank account";

        setAlertConfig({
          title: "Error",
          message: errorMessage,
          type: "error",
          isVisible: true,
          onConfirm: () => setIsVisible(false),
        });
      }
    },
    [
      bankAccounts,
      setAlertConfig,
      setIsVisible,
      setDefaultBankAccount,
      refetchBankAccounts,
    ]
  );

  /**
   * Gets the user's full name for auto-populating the account name field
   *
   * @function getUserFullName
   * @returns {string} The user's full name (first_name + last_name) or empty string if no user
   *
   * @description
   * This function concatenates the user's first and last name to create
   * a full name that can be used as the default account name when adding
   * a new bank account.
   */
  const getUserFullName = useCallback(() => {
    if (!user) return "";
    return `${user.first_name} ${user.last_name}`.trim();
  }, [user]);

  const cleanIban = useCallback((iban: string): string => {
    if (!iban) return "";

    const cleaned = iban.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return cleaned.substring(0, 34);
  }, []);

  const collectBankAccountInformation = (
    fields: keyof BankAccountProps,
    values: string
  ) => {
    const currentData = newBankAccount || {
      account_name: getUserFullName(),
      iban: "",
    };

    const cleanedValue = fields === "iban" ? cleanIban(values) : values;
    dispatch(setNewBankAccount({ ...currentData, [fields]: cleanedValue }));
  };

  return {
    bankAccounts,
    isLoadingBankAccounts,
    isLoadingAddBankAccount,
    isLoadingDeleteBankAccount,
    isLoadingSetDefaultBankAccount,
    newBankAccount,

    handleAddBankAccount,
    handleRemoveBankAccount,
    handleSetDefaultBankAccount,
    getUserFullName,
    collectBankAccountInformation,
    refetchBankAccounts,

    cleanIban,
  };
};
