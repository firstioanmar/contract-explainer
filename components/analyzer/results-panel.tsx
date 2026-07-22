"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  FileSearch,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Timer,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ResultActions } from "@/components/analyzer/result-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PartialContractAnalysis } from "@/lib/contract-schema";
import type { AnalysisState, ContractResult, RiskClause } from "@/lib/contract-types";
import { cn } from "@/lib/utils";

const datumIcons = {
  users: Users,
  wallet: WalletCards,
  calendar: CalendarDays,
  clock: Clock3,
  timer: Timer,
};

const severityVariants = { Tinggi: "danger", Sedang: "warning", Rendah: "success" } as const;

function SourceTag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">{children}</span>;
}

function RiskCard({ risk }: { risk: RiskClause }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={cn("rounded-xl border p-4 transition hover:shadow-sm", risk.severity === "Tinggi" ? "border-rose-200/80 bg-rose-50/40" : "border-amber-200/70 bg-amber-50/30")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", risk.severity === "Tinggi" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600")}><AlertTriangle className="size-4" /></span>
          <div><h4 className="text-sm font-bold leading-5">{risk.title}</h4><div className="mt-1.5 flex items-center gap-2"><Badge variant={severityVariants[risk.severity]}>{risk.severity}</Badge><SourceTag>{risk.source}</SourceTag></div></div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{risk.reason}</p>
      {expanded && <blockquote className="mt-3 rounded-lg border-l-2 border-primary/40 bg-white/70 px-3 py-2 text-[11px] italic leading-5 text-muted-foreground">“{risk.quote}”</blockquote>}
      <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 inline-flex items-center gap-1 rounded-md text-[11px] font-bold text-primary outline-none hover:underline focus-visible:ring-4 focus-visible:ring-primary/15">
        {expanded ? "Tutup konteks" : "Lihat konteks"} <ArrowRight className={cn("size-3 transition-transform", expanded && "rotate-90")} />
      </button>
    </article>
  );
}

function EmptyResult({ state }: { state: AnalysisState }) {
  const analyzing = state === "analyzing";
  return (
    <div className="relative flex min-h-[580px] flex-col items-center justify-center overflow-hidden p-8 text-center sm:min-h-[640px]">
      <div className="absolute inset-x-16 top-24 h-48 rounded-full bg-gradient-to-r from-violet-100 to-teal-100 blur-3xl" />
      <div className="relative">
        <div className={cn("grid size-20 place-items-center rounded-[1.75rem] border border-white bg-white text-primary shadow-[0_22px_45px_-22px_rgba(91,67,210,.5)]", analyzing && "animate-pulse-soft")}>
          {analyzing ? <FileSearch className="size-8 animate-pulse" /> : <ClipboardCheck className="size-8" />}
        </div>
        <span className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-full border-4 border-white bg-teal-400 text-white"><Sparkles className="size-3" /></span>
      </div>
      <h2 className="relative mt-6 text-lg font-extrabold tracking-tight">{analyzing ? "Sedang mencari hal penting..." : "Hasil analisis muncul di sini"}</h2>
      <p className="relative mt-2 max-w-sm text-xs leading-6 text-muted-foreground">{analyzing ? "Struktur dokumen, tanggal, nilai, penalti, dan klausul sedang diperiksa." : "Masukkan kontrak atau invoice di panel sebelah kiri. Kami akan menyusunnya menjadi informasi yang mudah dipahami."}</p>
      <div className="relative mt-7 grid w-full max-w-sm grid-cols-3 gap-2">
        {["Ringkasan", "Data penting", "Klausul"].map((item, index) => <div key={item} className={cn("rounded-xl border bg-white/70 p-3 text-[10px] font-semibold text-muted-foreground shadow-sm", analyzing && index === 0 && "border-primary/30 text-primary")}>{item}</div>)}
      </div>
    </div>
  );
}

function StreamingResult({ analysis }: { analysis: PartialContractAnalysis }) {
  const parties = analysis.pihak?.filter((party) => party?.nama);
  const clauses = analysis.klausulWaspada?.filter((clause) => clause?.judul);

  return (
    <div className="min-h-[580px] p-5 sm:min-h-[640px] sm:p-6" role="status" aria-live="polite">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <span className="animate-pulse-soft grid size-9 place-items-center rounded-xl bg-primary text-white"><Sparkles className="size-4" /></span>
          <div><p className="text-sm font-extrabold">{analysis.judulDokumen ?? "Membaca judul dokumen..."}</p><p className="mt-1 text-[10px] text-primary">Hasil sedang dialirkan dari AI</p></div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-primary/[.07] px-2.5 py-1 text-[10px] font-bold text-primary"><span className="size-1.5 animate-pulse rounded-full bg-primary" /> LIVE</span>
      </div>

      <section className="mt-5 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[.06] to-teal-400/[.04] p-5">
        <div className="flex items-center gap-2 text-xs font-extrabold"><Sparkles className="size-4 text-primary" /> Ringkasan bahasa awam</div>
        {analysis.ringkasan ? <p className="mt-4 text-sm leading-7 text-foreground/85">{analysis.ringkasan}</p> : <div className="shimmer mt-4 h-16 rounded-xl bg-primary/[.04]" />}
      </section>

      {(parties?.length || analysis.nilaiKontrak) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {parties && parties.length > 0 && <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Para Pihak</p><p className="mt-2 text-xs font-bold leading-5">{parties.map((party) => party?.nama).join(" ↔ ")}</p></div>}
          {analysis.nilaiKontrak && <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nilai Kontrak</p><p className="mt-2 text-sm font-extrabold">{analysis.nilaiKontrak.tampilan ?? "Membaca nilai..."}</p></div>}
        </div>
      ) : null}

      {clauses && clauses.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-extrabold">Klausul yang mulai terdeteksi</p>
          {clauses.map((clause, index) => <div key={`${clause?.judul}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5"><div className="flex items-center gap-2"><AlertTriangle className="size-3.5 text-amber-600" /><p className="text-xs font-bold">{clause?.judul}</p></div>{clause?.alasan && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{clause.alasan}</p>}</div>)}
        </div>
      )}
    </div>
  );
}

interface ResultsPanelProps {
  state: AnalysisState;
  result: ContractResult;
  streamedAnalysis?: PartialContractAnalysis;
  onReset: () => void;
}

export function ResultsPanel({ state, result, streamedAnalysis, onReset }: ResultsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [checkedActions, setCheckedActions] = useState<number[]>([]);

  async function copySummary() {
    await navigator.clipboard.writeText(result.summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (state === "analyzing" && streamedAnalysis && Object.keys(streamedAnalysis).length > 0) {
    return <Card className="glass overflow-hidden border-white/90"><StreamingResult analysis={streamedAnalysis} /></Card>;
  }

  if (state !== "complete") {
    return <Card className="glass overflow-hidden border-white/90"><EmptyResult state={state} /></Card>;
  }

  return (
    <Card className="glass overflow-hidden border-white/90 shadow-[0_20px_65px_-35px_rgba(15,23,42,.35)]">
      <div className="flex flex-col gap-4 border-b border-border/70 bg-gradient-to-r from-white to-primary/[.025] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-5" /></span>
          <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-extrabold">{result.title}</h2><Badge variant="success"><Check className="size-2.5" /> Selesai</Badge></div><p className="mt-1 text-[10px] text-muted-foreground">Dianalisis {result.analyzedAt} · 6 pasal terbaca</p></div>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <ResultActions result={result} />
          <Button variant="outline" size="sm" onClick={copySummary}>{copied ? <Check /> : <Copy />} {copied ? "Tersalin" : "Salin Ringkasan"}</Button>
          <Button variant="ghost" size="icon" onClick={onReset} aria-label="Analisis dokumen baru" title="Analisis dokumen baru"><RefreshCw /></Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <div className="overflow-x-auto border-b border-border/70 px-4 sm:px-6">
          <TabsList className="h-12 min-w-max gap-1 rounded-none bg-transparent p-0">
            <TabsTrigger value="summary" className="h-12 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">Ringkasan</TabsTrigger>
            <TabsTrigger value="data" className="h-12 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">Data Penting</TabsTrigger>
            <TabsTrigger value="risks" className="h-12 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">Klausul Waspada <span className="grid size-4 place-items-center rounded-full bg-rose-100 text-[9px] text-rose-700">{result.risks.length}</span></TabsTrigger>
            <TabsTrigger value="actions" className="h-12 rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">Tindakan Berikutnya</TabsTrigger>
          </TabsList>
        </div>

        <div className="p-5 sm:p-6">
          <TabsContent value="summary" className="mt-0 space-y-5">
            <section className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[.065] via-white to-teal-400/[.04] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-extrabold"><Sparkles className="size-4 text-primary" /> Ringkasan bahasa awam</div><Badge variant="warning"><ShieldAlert className="size-3" /> Perhatian {result.attention}</Badge></div>
              <p className="mt-4 text-sm leading-7 text-foreground/85">{result.summary}</p>
              <p className="mt-4 text-[10px] text-muted-foreground">Sumber utama: <SourceTag>Pembukaan</SourceTag> <SourceTag>Pasal 2–8</SourceTag></p>
            </section>
            <div className="grid gap-3 sm:grid-cols-3">
              {result.insights.map((insight) => <div key={insight} className="rounded-xl border bg-white p-3.5"><CheckCircle2 className="size-4 text-teal-500" /><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{insight}</p></div>)}
            </div>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-5 text-amber-800"><strong>Catatan:</strong> Hasil ini membantu pemahaman awal dan bukan pengganti nasihat hukum profesional.</p>
          </TabsContent>

          <TabsContent value="data" className="mt-0 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {result.data.map((item) => {
                const Icon = datumIcons[item.icon];
                return <div key={item.label} className={cn("rounded-xl border bg-white p-4", item.label === "Para Pihak" && "sm:col-span-2 xl:col-span-2")}><div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/[.07] text-primary"><Icon className="size-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p><p className="mt-1.5 text-sm font-extrabold leading-5">{item.value}</p><div className="mt-2"><SourceTag>{item.source}</SourceTag></div></div></div></div>;
              })}
            </div>
            <div className="overflow-hidden rounded-xl border">
              <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3 text-xs font-extrabold"><AlertTriangle className="size-4 text-amber-500" /> Penalti & konsekuensi</div>
              <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5 font-semibold">Pemicu</th><th className="px-4 py-2.5 font-semibold">Konsekuensi</th><th className="px-4 py-2.5 font-semibold">Sumber</th></tr></thead><tbody className="divide-y">{result.penalties.map((penalty) => <tr key={penalty.trigger} className="bg-white"><td className="px-4 py-3 font-semibold">{penalty.trigger}</td><td className="px-4 py-3 text-muted-foreground">{penalty.consequence}</td><td className="px-4 py-3"><SourceTag>{penalty.source}</SourceTag></td></tr>)}</tbody></table></div>
            </div>
          </TabsContent>

          <TabsContent value="risks" className="mt-0 space-y-3">
            <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-extrabold">{result.risks.length} klausul memerlukan perhatian</h3><p className="mt-1 text-[11px] text-muted-foreground">Urut berdasarkan potensi dampak tertinggi.</p></div><Badge variant="danger">{result.risks.filter((risk) => risk.severity === "Tinggi").length} tinggi</Badge></div>
            {result.risks.map((risk) => <RiskCard key={risk.title} risk={risk} />)}
          </TabsContent>

          <TabsContent value="actions" className="mt-0">
            <Card className="border-primary/10 bg-gradient-to-br from-white to-primary/[.035] shadow-none">
              <CardHeader><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-primary text-white"><ListChecks className="size-4" /></span><div><CardTitle>Yang sebaiknya Anda lakukan</CardTitle><p className="mt-1 text-[11px] text-muted-foreground">Checklist sebelum menandatangani kontrak.</p></div></div></CardHeader>
              <CardContent className="space-y-2">
                {result.actions.map((action, index) => {
                  const checked = checkedActions.includes(index);
                  return <button type="button" key={action.text} onClick={() => setCheckedActions((current) => checked ? current.filter((item) => item !== index) : [...current, index])} className="flex w-full items-start gap-3 rounded-xl border bg-white p-3.5 text-left outline-none transition hover:border-primary/25 hover:shadow-sm focus-visible:ring-4 focus-visible:ring-primary/15"><span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition", checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-border")}><Check className={cn("size-3", !checked && "opacity-0")} /></span><span className="flex-1"><span className={cn("block text-xs font-semibold leading-5", checked && "text-muted-foreground line-through")}>{action.text}</span>{action.source && <span className="mt-1 block"><SourceTag>{action.source}</SourceTag></span>}</span></button>;
                })}
                <div className="pt-3"><Button variant="outline" className="w-full" onClick={onReset}><RefreshCw /> Analisis Dokumen Baru</Button></div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}
