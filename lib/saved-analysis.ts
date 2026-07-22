import type { ContractResult } from "@/lib/contract-types";

export interface SavedAnalysis {
  id: string;
  savedAt: string;
  result: ContractResult;
}
