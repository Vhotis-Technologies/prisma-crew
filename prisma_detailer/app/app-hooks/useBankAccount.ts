/**
 * Bank account hook: fetch, add, delete, set default, and form state via RTK Query.
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

/**
 * Manages bank account CRUD, default selection, and add-account form state.
 * @returns Bank accounts, loading flags, and account action handlers
 */
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

  /**
   * Validate and submit a new bank account, then navigate back on success.
   */
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
   * Remove a bank account; blocks deletion of the primary account.
   * @param accountId - Bank account ID to delete
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
   * Set a bank account as default; no-op if already default.
   * @param accountId - Bank account ID to promote
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

  /** @returns User full name for default account holder field */
  const getUserFullName = useCallback(() => {
    if (!user) return "";
    return `${user.first_name} ${user.last_name}`.trim();
  }, [user]);

  /**
   * Normalize IBAN input: strip non-alphanumerics, uppercase, max 34 chars.
   * @param iban - Raw IBAN string from form input
   */
  const cleanIban = useCallback((iban: string): string => {
    if (!iban) return "";

    const cleaned = iban.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return cleaned.substring(0, 34);
  }, []);

  /**
   * Update a single field on the in-progress bank account form in Redux.
   * @param fields - Bank account field key to update
   * @param values - New field value
   */
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
