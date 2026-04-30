export type AppPhase = "phase-0-skeleton";

export type SafetyDecision = "GO" | "HOLD" | "STOP";

export type Role = "owner" | "admin" | "operator" | "viewer";

export type StoreScopedResource = {
  organizationId: string;
  storeId: string;
};
