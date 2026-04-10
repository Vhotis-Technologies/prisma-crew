export interface BankAccountProps {
  id?: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  iban: string;
  bic: string;
  sort_code: string;
  is_default?: boolean;
}

export default interface BankingState {
  newBankAccount: BankAccountProps | null;
}