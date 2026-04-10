import { createSlice } from "@reduxjs/toolkit";
import BankingState from "@/app/interfaces/BankingInterface";

const initialState: BankingState = {
  newBankAccount: null,
};

const bankingSlice = createSlice({
  name: "banking",
  initialState,
  reducers: {
    setNewBankAccount: (state, action) => {
      state.newBankAccount = action.payload;
      },
    clearNewBankAccount: (state) => {
      state.newBankAccount = null;
    },
  },
});

export const { setNewBankAccount, clearNewBankAccount } = bankingSlice.actions;
export default bankingSlice.reducer;
