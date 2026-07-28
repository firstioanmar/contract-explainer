export type AnalysisState = "empty" | "analyzing" | "complete" | "invalid" | "error";

export interface ImportantDatum {
  label: string;
  value: string;
  source: string;
  icon: "users" | "wallet" | "calendar" | "clock" | "timer";
}

export interface Penalty {
  trigger: string;
  consequence: string;
  source: string;
}

export interface RiskClause {
  title: string;
  severity: "Tinggi" | "Sedang" | "Rendah";
  reason: string;
  quote: string;
  source: string;
}

export interface ContractResult {
  title: string;
  analyzedAt: string;
  attention: "Rendah" | "Sedang" | "Tinggi";
  summary: string;
  insights: string[];
  data: ImportantDatum[];
  penalties: Penalty[];
  risks: RiskClause[];
  actions: { text: string; source?: string }[];
  /** Peringatan operasional, misalnya dokumen terpotong atau sebagian bagian gagal. */
  warnings?: string[];
  /** Referensi nyata yang dikembalikan model; tidak pernah diisi dengan sumber hardcoded. */
  sourceReferences?: string[];
}
