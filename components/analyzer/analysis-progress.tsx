import { Check, LoaderCircle, ScanText } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = ["Membaca dokumen", "Mengidentifikasi data penting", "Menilai klausul", "Menyusun penjelasan"];

export function AnalysisProgress({ step }: { step: number }) {
  const progress = ((step + 0.5) / steps.length) * 100;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[.07] to-teal-400/[.05] p-5" role="status" aria-live="polite">
      <div className="shimmer pointer-events-none absolute inset-0" />
      <div className="relative flex items-center gap-3">
        <span className="animate-pulse-soft grid size-10 place-items-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20"><ScanText className="size-5" /></span>
        <div><p className="text-sm font-bold">AI sedang menganalisis</p><p className="mt-0.5 text-xs text-muted-foreground">Biasanya selesai kurang dari satu menit</p></div>
      </div>
      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all duration-700" style={{ width: `${progress}%` }} /></div>
      <ol className="relative mt-5 space-y-3">
        {steps.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={label} className={cn("flex items-center gap-3 text-xs transition-colors", done || active ? "text-foreground" : "text-muted-foreground/55")}>
              <span className={cn("grid size-5 place-items-center rounded-full border text-[10px] font-bold transition-all", done && "border-emerald-500 bg-emerald-500 text-white", active && "border-primary bg-white text-primary", !done && !active && "border-border bg-white")}>
                {done ? <Check className="size-3" strokeWidth={3} /> : active ? <LoaderCircle className="size-3 animate-spin" /> : index + 1}
              </span>
              <span className={cn(active && "font-bold")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
