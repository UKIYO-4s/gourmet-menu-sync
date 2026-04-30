export const MVP_PHASE = "phase-0-skeleton" as const;

export const SAFETY_CONSTRAINTS = {
  externalSiteConnection: "HOLD",
  chromeExtensionRealConnection: "HOLD",
  autoSave: "STOP",
  autoPublish: "STOP",
  autoDelete: "STOP",
  autoSubmitEnabled: false,
  prohibitedData: [
    "cookie",
    "session",
    "token",
    "raw_dom",
    "outer_html",
    "input_value",
  ],
} as const;
