import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { CONTRACT_SYSTEM_PROMPT, buildContractPrompt, normalizeDocumentText } from "@/lib/ai/contract-prompt";
import { splitDocument, type DocumentChunk } from "@/lib/ai/document-chunks";
import { mergeAnalyses } from "@/lib/ai/merge-analysis";
import { MAX_OUTPUT_TOKENS, modelRotation } from "@/lib/ai/models";
import { contractAnalysisSchema, type ContractAnalysis } from "@/lib/contract-schema";

/** Berapa bagian dokumen yang dianalisis bersamaan. Ditahan rendah agar tidak menabrak batas model gratis. */
const CONCURRENCY = 2;

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
 */
async function analyzeChunk(
  openrouter: OpenRouterProvider,
  chunk: DocumentChunk,
  attempts: ChunkAttempt[],
): Promise<ContractAnalysis | null> {
  for (const model of modelRotation(chunk.index - 1)) {
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
      });

      attempts.push({ chunk: chunk.index, model: model.label, ok: true });
      return output;
    } catch (error) {
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
 * Menganalisis dokumen panjang secara utuh: dokumen dipecah, setiap bagian
 * dianalisis oleh model yang berbeda dengan cadangan berlapis, lalu seluruh
 * hasil digabungkan menjadi satu analisis.
 */
export async function analyzeLongDocument(
  openrouter: OpenRouterProvider,
  text: string,
): Promise<DocumentAnalysis> {
  const chunks = splitDocument(normalizeDocumentText(text));
  const attempts: ChunkAttempt[] = [];

  const results = await mapWithConcurrency(chunks, CONCURRENCY, (chunk) =>
    analyzeChunk(openrouter, chunk, attempts));

  const succeeded = results.filter((result): result is ContractAnalysis => result !== null);
  const failedChunks = chunks.filter((_, index) => results[index] === null).map((chunk) => chunk.index);

  if (succeeded.length === 0) {
    throw new Error("Seluruh model gratis gagal menganalisis dokumen ini.");
  }

  const analysis = mergeAnalyses(succeeded);

  return { analysis, chunks: chunks.length, failedChunks, attempts };
}
