import assert from "node:assert/strict";
import test from "node:test";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { MockLanguageModelV4 } from "ai/test";
import { AnalysisTimeoutError, analyzeLongDocument } from "../lib/ai/analyze-document";
import { contractFixtures } from "./fixtures/contracts";

// Dokumen cukup panjang agar terpecah menjadi beberapa bagian.
const longDocument = contractFixtures.map((fixture) => fixture.text).join("\n\n").repeat(20);

/** Provider palsu yang setiap panggilannya menggantung sampai sinyal batas waktu aktif. */
function hangingProvider(): OpenRouterProvider {
  const model = new MockLanguageModelV4({
    doGenerate: ({ abortSignal }) =>
      new Promise((_resolve, reject) => {
        if (abortSignal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        abortSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
  });

  return (() => model) as unknown as OpenRouterProvider;
}

test("model yang menggantung memicu galat kehabisan waktu yang jujur, bukan menunggu tanpa batas", async () => {
  const started = Date.now();

  await assert.rejects(
    analyzeLongDocument(hangingProvider(), longDocument, 300),
    (error: unknown) => {
      assert.ok(error instanceof AnalysisTimeoutError, "harus melempar AnalysisTimeoutError");
      assert.equal(error.completedChunks, 0);
      assert.ok(error.totalChunks > 1, "dokumen harus terpecah lebih dari satu bagian");
      return true;
    },
  );

  // Membuktikan permintaan yang menggantung benar-benar dibatalkan, bukan
  // menunggu sampai batas waktu platform.
  assert.ok(Date.now() - started < 3_000, "harus berhenti segera setelah anggaran waktu habis");
});
