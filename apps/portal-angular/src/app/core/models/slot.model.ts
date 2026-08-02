export interface Slot {
  id: string;
  providerId: string;
  startsAt: string;
  endsAt: string;
  isBooked: boolean;
}

export interface SlotQuery {
  providerId?: string;
  from?: string;
  to?: string;
  includeBooked?: boolean;
}
