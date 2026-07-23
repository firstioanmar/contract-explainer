import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { CONTRACT_SYSTEM_PROMPT, buildContractPrompt, normalizeDocumentText } from "@/lib/ai/contract-prompt";
import { splitDocument, type DocumentChunk } from "@/lib/ai/document-chunks";
import { mergeAnalyses } from "@/lib/ai/merge-analysis";
import { ANALYSIS_TIME_BUDGET_MS, MAX_OUTPUT_TOKENS, modelRotation } from "@/lib/ai/models";
import { contractAnalysisSchema, type ContractAnalysis } from "@/lib/contract-schema";

/** Berapa bagian dokumen yang dianalisis bersamaan. Ditahan rendah agar tidak menabrak batas model gratis. */
const CONCURRENCY = 2;

/**
 * Dilempar ketika anggaran waktu habis sebelum seluruh bagian dokumen selesai.
 * Dipakai route untuk membedakan "kehabisan waktu" dari "semua model gagal",
 * sehingga pesan ke pengguna bisa jujur dan spesifik.
 */
export class AnalysisTimeoutError extends Error {
  readonly completedChunks: number;
  readonly totalChunks: number;

  constructor(completedChunks: number, totalChunks: number) {
    super(`Analisis kehabisan waktu: ${completedChunks} dari ${totalChunks} bagian selesai.`);
    this.name = "AnalysisTimeoutError";
    this.completedChunks = completedChunks;
    this.totalChunks = totalChunks;
  }
}

export type ChunkAttempt = {
  chunk: number;
  model: string;
  ok: boolean;
  reason?: string;
};

export type DocumentAnalysis = {
  analysis: ContractAnalysis;
  chunks: number;
  /** Bagian yang gagal dianalisis oleh seluruh model. */
  failedChunks: number[];
  attempts: ChunkAttempt[];
};

function describeError(error: unknown) {
  if (NoObjectGeneratedError.isInstance(error)) return "keluaran tidak sesuai schema";
  if (error instanceof Error) return error.message.slice(0, 120);
  return "galat tidak dikenal";
}

/**
 * Menganalisis satu bagian dokumen, mencoba setiap model bergiliran sampai ada
 * yang berhasil. Titik awal giliran digeser per bagian supaya seluruh model
 * terpakai dan beban tidak menumpuk di satu model saja.
 *
 * Saat sinyal batas waktu aktif, fungsi berhenti tanpa mencatat percobaan baru;
 * bagian yang belum sempat diproses akan dilaporkan sebagai belum selesai.
 */
async function analyzeChunk(
  openrouter: OpenRouterProvider,
  chunk: DocumentChunk,
  attempts: ChunkAttempt[],
  signal: AbortSignal,
): Promise<ContractAnalysis | null> {
  for (const model of modelRotation(chunk.index - 1)) {
    if (signal.aborted) return null;

    try {
      const { output } = await generateText({
        model: openrouter(model.id),
        providerOptions: {
          openrouter: { plugins: [{ id: "response-healing" }] },
        },
        system: CONTRACT_SYSTEM_PROMPT,
        prompt: buildContractPrompt(chunk.text, chunk),
        output: Output.object({ schema: contractAnalysisSchema }),
        temperature: 0.1,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRetries: 1,
        abortSignal: signal,
      });

      attempts.push({ chunk: chunk.index, model: model.label, ok: true });
      return output;
    } catch (error) {
      // Kegagalan akibat waktu habis tidak dicatat sebagai kegagalan model dan
      // tidak memicu percobaan model berikutnya.
      if (signal.aborted) return null;
      attempts.push({ chunk: chunk.index, model: model.label, ok: false, reason: describeError(error) });
    }
  }

  return null;
}

/** Menjalankan tugas dengan batas jumlah tugas yang berjalan bersamaan. */
async function mapWithConcurrency<Item, Result>(
  items: Item[],
  limit: number,
  worker: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/**
 * Memutuskan hasil akhir dari hasil tiap bagian. Dipisah agar dapat diuji tanpa
 * memanggil model.
 *
 * Perbedaan penting antara dua jenis ketidaklengkapan:
 * - Kehabisan waktu: bagian yang tersisa mungkin masih bisa dianalisis bila
 *   diberi waktu, jadi menyajikan hasil sebagian sebagai hasil utuh itu
 *   menyesatkan. Lempar AnalysisTimeoutError agar pengguna diberi tahu jujur.
 * - Model gagal: seluruh model sudah dicoba dan menyerah pada bagian itu, jadi
 *   hasil sebagian dari bagian lain tetap disajikan dengan mencatat bagian yang
 *   gagal.
 */
export function resolveAnalysisOutcome(
  chunks: DocumentChunk[],
  results: (ContractAnalysis | null)[],
  aborted: boolean,
): { analysis: ContractAnalysis; failedChunks: number[] } {
  const succeeded = results.filter((result): result is ContractAnalysis => result !== null);
  const failedChunks = chunks.filter((_, index) => results[index] === null).map((chunk) => chunk.index);

  if (aborted && succeeded.length < chunks.length) {
    throw new AnalysisTimeoutError(succeeded.length, chunks.length);
  }

  if (succeeded.length === 0) {
    throw new Error("Seluruh model gratis gagal menganalisis dokumen ini.");
  }

  return { analysis: mergeAnalyses(succeeded), failedChunks };
}

/**
 * Menganalisis dokumen panjang secara utuh: dokumen dipecah, setiap bagian
 * dianalisis oleh model yang berbeda dengan cadangan berlapis, lalu seluruh
 * hasil digabungkan menjadi satu analisis.
 *
 * Seluruh proses dibatasi anggaran waktu. Ketika anggaran habis, permintaan
 * yang masih berjalan dibatalkan dan fungsi melempar AnalysisTimeoutError,
 * bukan menyajikan hasil yang diam-diam tidak lengkap.
 */
export async function analyzeLongDocument(
  openrouter: OpenRouterProvider,
  text: string,
  budgetMs = ANALYSIS_TIME_BUDGET_MS,
): Promise<DocumentAnalysis> {
  const chunks = splitDocument(normalizeDocumentText(text));
  const attempts: ChunkAttempt[] = [];

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), budgetMs);

  let results: (ContractAnalysis | null)[];
  try {
    results = await mapWithConcurrency(chunks, CONCURRENCY, (chunk) =>
      analyzeChunk(openrouter, chunk, attempts, controller.signal));
  } finally {
    clearTimeout(deadline);
  }

  const { analysis, failedChunks } = resolveAnalysisOutcome(chunks, results, controller.signal.aborted);

  return { analysis, chunks: chunks.length, failedChunks, attempts };
}
