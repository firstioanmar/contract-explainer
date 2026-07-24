"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  FileCheck2,
  FileText,
  LockKeyhole,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
} from "lucide-react";
import { AnalysisProgress } from "@/components/analyzer/analysis-progress";
import { LegalModal } from "@/components/legal/legal-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalysisState } from "@/lib/contract-types";
import { MAX_DOCUMENT_BYTES, MAX_EXTRACTED_CHARACTERS, SUPPORTED_DOCUMENT_TYPES, validateDocumentFile } from "@/lib/document-file";
import { cn } from "@/lib/utils";

const MAX_CHARACTERS = MAX_EXTRACTED_CHARACTERS;

interface InputPanelProps {
  text: string;
  onTextChange: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  state: AnalysisState;
  analysisStep: number;
  feedback: string;
  onAnalyze: (mode: "text" | "upload") => void | Promise<void>;
  onUseSample: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function InputPanel({
  text,
  onTextChange,
  file,
  onFileChange,
  consent,
  onConsentChange,
  state,
  analysisStep,
  feedback,
  onAnalyze,
  onUseSample,
}: InputPanelProps) {
  const [mode, setMode] = useState<"text" | "upload">("text");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = state === "analyzing";

  function acceptFile(nextFile?: File) {
    if (!nextFile) return;
    const validation = validateDocumentFile(nextFile);
    if (!validation.valid) {
      setFileError(validation.reason);
      onFileChange(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFileError("");
    onFileChange(nextFile);
  }

  return (
    <Card className="glass overflow-hidden border-white/90 shadow-[0_20px_65px_-35px_rgba(15,23,42,.35)]">
      <div className="border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary/[.08] text-primary"><FileText className="size-3.5" /></span><h2 className="text-sm font-bold">Masukkan dokumen</h2></div>
            <p className="mt-1.5 text-xs text-muted-foreground">Teks Anda diproses secara aman dan privat.</p>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><LockKeyhole className="size-3" /> Privat</span>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {busy ? (
          <AnalysisProgress step={analysisStep} />
        ) : (
          <>
            <Tabs value={mode} onValueChange={(value) => setMode(value as "text" | "upload")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text"><FileText /> Tempel Teks</TabsTrigger>
                <TabsTrigger value="upload"><UploadCloud /> Unggah Dokumen</TabsTrigger>
              </TabsList>

              <TabsContent value="text">
                <label htmlFor="contract-text" className="sr-only">Teks kontrak atau invoice</label>
                <div className={cn("overflow-hidden rounded-xl border bg-white transition focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/[.08]", state === "invalid" && "border-amber-300 focus-within:border-amber-400 focus-within:ring-amber-100")}>
                  <textarea
                    id="contract-text"
                    value={text}
                    maxLength={MAX_CHARACTERS}
                    onChange={(event) => onTextChange(event.target.value)}
                    placeholder={'Contoh: “Pada tanggal 10 Juni 2026, PT Langit Digital dan CV Rasa Karya sepakat...”'}
                    className="min-h-64 w-full resize-y bg-transparent px-4 py-4 text-sm leading-6 outline-none placeholder:text-muted-foreground/55"
                  />
                  <div className="flex items-center justify-between border-t border-border/60 bg-muted/35 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Sparkles className="size-3 text-primary" /> AI mendukung kontrak & invoice</span>
                    <span className={cn("text-[10px] tabular-nums text-muted-foreground", text.length > MAX_CHARACTERS * 0.9 && "text-amber-600")}>{text.length.toLocaleString("id-ID")} / {MAX_CHARACTERS.toLocaleString("id-ID")}</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="upload">
                <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-describedby="upload-help upload-error" onChange={(event) => acceptFile(event.target.files?.[0])} />
                {file ? (
                  <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
                    <span className="grid size-12 place-items-center rounded-2xl bg-white text-emerald-600 shadow-sm"><FileCheck2 className="size-6" /></span>
                    <p className="mt-4 max-w-full truncate text-sm font-bold">{file.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatBytes(file.size)} · Siap dianalisis</p>
                    <Button variant="ghost" size="sm" className="mt-4 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => { onFileChange(null); setFileError(""); if (fileRef.current) fileRef.current.value = ""; }}><Trash2 /> Hapus file</Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}
                    className={cn("group flex min-h-64 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 p-6 text-center outline-none transition hover:border-primary/40 hover:bg-primary/[.03] focus-visible:ring-4 focus-visible:ring-primary/15", dragging && "scale-[.99] border-primary bg-primary/[.06]")}
                  >
                    <span className="grid size-12 place-items-center rounded-2xl bg-white text-primary shadow-sm transition-transform group-hover:-translate-y-1"><UploadCloud className="size-6" /></span>
                    <p className="mt-4 text-sm font-bold">Tarik dokumen ke sini</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">atau klik untuk memilih file</p>
                    <span className="mt-4 rounded-full border bg-white px-3 py-1 text-[10px] font-semibold text-muted-foreground">PDF teks atau DOCX · Maks. {MAX_DOCUMENT_BYTES / 1024 / 1024} MB</span>
                  </button>
                )}
                <div id="upload-help" className="mt-3 rounded-xl border border-primary/10 bg-primary/[.035] px-3.5 py-3 text-[10px] leading-5 text-muted-foreground">
                  <p><strong className="text-foreground">Jenis dokumen:</strong> {SUPPORTED_DOCUMENT_TYPES.join(", ")}.</p>
                  <p className="mt-1"><strong className="text-foreground">Format:</strong> PDF berbasis teks dan DOCX. Untuk PDF scan/foto atau DOC lama, salin isinya lalu tempel di tab <strong className="text-foreground">Tempel Teks</strong>.</p>
                </div>
                {fileError && <p id="upload-error" role="alert" className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-rose-600"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{fileError}</p>}
              </TabsContent>
            </Tabs>

            {(state === "invalid" || state === "error") && (
              <div className={cn("mt-4 flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-5", state === "invalid" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-700")} role="alert">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div><p className="font-bold">{state === "invalid" ? "Dokumen belum dapat dianalisis" : "Analisis gagal"}</p><p className="mt-0.5 opacity-85">{feedback}</p></div>
              </div>
            )}

            <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-lg text-xs leading-5 text-muted-foreground">
              <Checkbox checked={consent} onCheckedChange={(checked) => onConsentChange(checked === true)} className="mt-0.5" />
              <span>Saya setuju dokumen ini diproses untuk menghasilkan analisis. <LegalModal type="privacy" triggerLabel="Pelajari privasi" triggerClassName="font-semibold text-primary underline-offset-2 hover:underline" />.</span>
            </label>

            <div className="mt-5 grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2">
              <Button size="lg" disabled={!consent} onClick={() => onAnalyze(mode)} className="group w-full min-w-0">
                <WandSparkles /> Jelaskan Kontrak <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button variant="outline" size="lg" className="w-full min-w-0" onClick={() => { onUseSample(); setMode("text"); setFileError(""); }}>Gunakan Contoh</Button>
            </div>
            {!consent && <p className="mt-2 text-center text-[10px] text-muted-foreground">Centang persetujuan untuk mulai menganalisis.</p>}
          </>
        )}
      </div>
    </Card>
  );
}
