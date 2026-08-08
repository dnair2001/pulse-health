export interface ProviderSummary {
  id: string;
  name: string;
  specialty: string;
  locationName: string;
}

export interface Provider extends ProviderSummary {
  credentials: string;
  bio: string;
}
