export type ReminderRuleInterval = 'monthly_first' | 'one_month_before' | 'one_week_before' | 'on_expiry';

export interface RenewalHistoryEntry {
  oldExpiryDate: string;
  newExpiryDate: string;
  renewedBy: string;
  renewedOn: string; // YYYY-MM-DD
}

export interface Reminder {
  id: string;
  itemName: string;
  category: string;
  responsibleName: string;
  responsibleEmail: string;
  expiryDate: string; // YYYY-MM-DD
  renewalDate: string; // YYYY-MM-DD or empty
  status: 'Active' | 'Renewed' | 'Expired';
  notes: string;
  rulesOverride?: ReminderRuleInterval[]; // if undefined, use global rules
  renewalHistory?: RenewalHistoryEntry[]; // logs of renewals
  renewalPeriodOverride?: string; // override standard category renewal duration
  acknowledged?: boolean;
  acknowledged_at?: string;
  customerName?: string;
  customerEmail?: string;
}

export interface GlobalConfig {
  defaultRules: ReminderRuleInterval[];
  categories: string[];
  categoryRenewalPeriods?: Record<string, string>; // Category -> Period mapping
}

export interface NotificationLog {
  id: string;
  reminderId: string;
  reminderName: string;
  recipientName: string;
  recipientEmail: string;
  triggerType: ReminderRuleInterval | string;
  triggerDate: string; // YYYY-MM-DD
  sentAt: string; // ISO string
  status: 'success' | 'failure';
  errorDetail?: string;
  emailSubject: string;
  emailBody: string;
  recipientType?: 'responsible' | 'customer';
}

export const RULE_LABELS: Record<ReminderRuleInterval, string> = {
  monthly_first: '1st of every month',
  one_month_before: '1 month before expiry',
  one_week_before: '1 week before expiry',
  on_expiry: 'On the expiry date',
};

export const DEFAULT_CATEGORIES = [
  'Payment Due',
  'Insurance',
  'Company Asset',
  'Employee Visa',
  'Software License',
  'AMC',
  'Compliance Certificate',
  'Vehicle Insurance',
  'Equipment Servicing',
  'Subscription'
];

export const DEFAULT_RENEWAL_PERIODS: Record<string, string> = {
  'Insurance': '1 year',
  'EMI / Loan Repayment': '1 month',
  'Software License': '1 year',
  'AMC': '1 year',
  'AMC (Annual Maintenance Contract)': '1 year',
  'Employee Visa': '1 year',
  'Compliance Certificate': '1 year',
  'Vehicle Insurance': '1 year',
  'Vehicle Insurance & Registration': '1 year',
  'Equipment Servicing': '6 months',
  'Subscription': '1 month',
  'Payment Due': '1 month',
  'Company Asset': '1 year'
};
