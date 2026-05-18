export interface BankAccountProps {
  id?: string;
  account_name: string;
  iban: string;
  is_default?: boolean;
}

export default interface BankingState {
  newBankAccount: BankAccountProps | null;
}
