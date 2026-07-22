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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={saveResult} disabled={!user} title={user ? "Simpan hasil di perangkat ini" : "Masuk dengan Google untuk menyimpan"}>
        {saved ? <Check /> : <Save />} {saved ? "Tersimpan" : "Simpan"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => user && downloadAnalysisPdf(result)} disabled={!user} title={user ? "Unduh laporan PDF" : "Masuk dengan Google untuk mengunduh PDF"}>
        <Download /> PDF
      </Button>
      {!user && <span className="w-full text-[9px] text-muted-foreground">Masuk dengan Google untuk menyimpan dan mengunduh.</span>}
    </div>
  );
}
