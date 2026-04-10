// Bank Account Management
export interface BankAccountProps {
  id?: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  iban: string;
  bic: string;
  sort_code: string;
  is_primary?: boolean;
  is_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Individual Earning Item - Detailer sees their hourly earnings
export interface EarningItemProps {
  id?: string;
  hourly_earnings: number;
  total_active_hours?: number;
  total_inactive_hours?: number;
  total_earned: number;
  job_id: string;
  job_reference?: string;
  client_name?: string;
  service_type?: string;
  completed_date?: string;
  payout_id?: string;
} 

// Payout History
export interface PayoutHistoryProps {
  id: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  payout_date: string;
  bank_account: BankAccountProps;
  transaction_id?: string;
  earnings_count: number;
  period_start: string;
  period_end: string;
  notes?: string;
}

// Earnings Analytics
export interface EarningsAnalyticsProps {
  total_lifetime_earnings: number;
  average_weekly_earnings: number;
  average_monthly_earnings: number;
  total_jobs_completed: number;
  best_earning_day: string;
  best_earning_month: string;
  earnings_trend: "increasing" | "decreasing" | "stable";
  trend_percentage: number;
}

// Earnings by Time Period
export interface EarningsByPeriodProps {
  period: string;
  total_hourly_earnings: number;
  total_earned: number;
  total_jobs: number;
  average_per_job: number;
  start_date: string;
  end_date: string;
}

// Earnings Filter Options - Removed payment method filter
export interface EarningsFiltersProps {
  timeRange: "today" | "week" | "month" | "quarter" | "year" | "custom";
  status: "all" | "pending" | "paid" | "processing" | "failed";
  sortBy: "date" | "amount" | "client" | "service";
  sortOrder: "asc" | "desc";
  customStartDate?: string;
  customEndDate?: string;
}

// Earnings Summary Stats
export interface EarningsSummaryProps {
  current_period: EarningsByPeriodProps;
  previous_period: EarningsByPeriodProps;
  percentage_change: number;
  is_positive_change: boolean;
  pending_payouts: number;
  next_payout_date?: string;
  bank_accounts: BankAccountProps[];
}

// Earnings State Management
export interface EarningsStateProps {
  summary: EarningsSummaryProps;
  analytics: EarningsAnalyticsProps;
  currentEarnings: EarningItemProps;
  payoutHistory: PayoutHistoryProps[];
  bankAccounts: BankAccountProps[];
  filters: EarningsFiltersProps;
  isLoading: boolean;
  isRefreshing: boolean;
  error?: string;
  lastUpdated: string;
}

// Earnings Data for Components
export interface EarningsDataProps {
  summary: EarningsSummaryProps;
  analytics: EarningsAnalyticsProps;
  currentEarnings: EarningItemProps;
  payoutHistory: PayoutHistoryProps[];
  bankAccounts: BankAccountProps[];
  isLoading: boolean;
  lastUpdated: string;
}

// Component Props Interfaces
export interface EarningCardProps {
  earning: EarningItemProps;
  onPress?: (earningId: string) => void;
}

export interface PayoutCardProps {
  payout: PayoutHistoryProps;
  onPress?: (payoutId: string) => void;
}

export interface BankAccountCardProps {
  account: BankAccountProps;
  onPress?: (accountId: string) => void;
  onSetPrimary?: (accountId: string) => void;
  onDelete?: (accountId: string) => void;
}

export interface EarningsChartProps {
  data: EarningsByPeriodProps[];
  period: "week" | "month" | "year";
  onPeriodChange?: (period: "week" | "month" | "year") => void;
}

export interface EarningsStatsProps {
  analytics: EarningsAnalyticsProps;
  summary: EarningsSummaryProps;
}

export interface EarningsFiltersComponentProps {
  filters: EarningsFiltersProps;
  onFilterChange: (filters: Partial<EarningsFiltersProps>) => void;
  onResetFilters: () => void;
}

export interface PayoutItemProps {
  id: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  period_start: string;
  period_end: string;
  notes?: string;
  payout_date: string;
  bank_account: BankAccountProps;
  transaction_id?: string;
  earnings_count: number;
}

export interface EarningsSummaryCardProps {
  total_earned: number;
  total_jobs: number;
  average_per_job: number;
  percentage_change: number;
  is_positive_change: boolean;
  pending_payouts: number;
  next_payout_date?: string;
  bank_accounts_count: number;
}
