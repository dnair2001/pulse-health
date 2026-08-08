import { ProviderSummary } from './provider.model';

export type PrescriptionStatus = 'active' | 'completed' | 'cancelled';

export interface Prescription {
  id: string;
  providerId: string;
  provider: ProviderSummary;
  medicationName: string;
  dosage: string;
  frequency: string;
  instructions: string;
  status: PrescriptionStatus;
  refillsRemaining: number;
  lastFilledAt: string;
  createdAt: string;
  updatedAt: string;
}
