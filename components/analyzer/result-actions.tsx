"use client";

import { useState } from "react";
import { Check, Download, Save } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useSavedAnalyses } from "@/components/providers/saved-analyses-provider";
import { Button } from "@/components/ui/button";
import type { ContractResult } from "@/lib/contract-types";
import { downloadAnalysisPdf } from "@/lib/export-analysis-pdf";

export function ResultActions({ result }: { result: ContractResult }) {
  const { user } = useAuth();
  const { save } = useSavedAnalyses();
  const [saved, setSaved] = useState(false);

  function saveResult() {
    if (!user) return;
    save(result);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  if (!user) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={saveResult} title="Simpan hasil di perangkat ini">
        {saved ? <Check /> : <Save />} {saved ? "Tersimpan" : "Simpan"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadAnalysisPdf(result)} title="Unduh laporan PDF">
        <Download /> PDF
      </Button>
    </div>
  );
}
