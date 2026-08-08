import { ProviderSummary } from './provider.model';

export type InvoiceStatus = 'open' | 'paid';

export interface Invoice {
  id: string;
  providerId: string;
  provider: ProviderSummary;
  serviceDescription: string;
  billedAmountCents: number;
  insurancePaidCents: number;
  patientResponsibilityCents: number;
  amountPaidCents: number;
  balanceCents: number;
  status: InvoiceStatus;
  overdue: boolean;
  dueDate: string;
  issuedAt: string;
  updatedAt: string;
}
