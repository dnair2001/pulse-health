/** `Provider` as defined in docs/api-contract.md. The API is frozen; this mirrors it exactly. */
export interface Provider {
  id: string;
  name: string;
  specialty: string;
  credentials: string;
  locationName: string;
  bio: string;
}
