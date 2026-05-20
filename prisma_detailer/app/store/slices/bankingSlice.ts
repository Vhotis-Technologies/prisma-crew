/**
 * Banking slice: draft bank account data during add/edit flows.
 */
import { createSlice } from "@reduxjs/toolkit";
import BankingState from "@/app/interfaces/BankingInterface";

const initialState: BankingState = {
  newBankAccount: null,
};

const bankingSlice = createSlice({
  name: "banking",
  initialState,
  reducers: {
    /** Store in-progress bank account form data. */
    setNewBankAccount: (state, action) => {
      state.newBankAccount = action.payload;
      },
    /** Clear draft bank account after save or cancel. */
    clearNewBankAccount: (state) => {
      state.newBankAccount = null;
    },
  },
});

export const { setNewBankAccount, clearNewBankAccount } = bankingSlice.actions;
export default bankingSlice.reducer;
