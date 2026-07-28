import assert from "node:assert/strict";
import test from "node:test";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { MockLanguageModelV4 } from "ai/test";
import { AnalysisTimeoutError, analyzeLongDocument } from "../lib/ai/analyze-document";
import { modelRotation } from "../lib/ai/models";
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

test("model yang menggantung hanya kehilangan gilirannya, model berikutnya tetap dicoba", async () => {
  const attempted: string[] = [];

  // Setiap model menggantung sampai batas waktunya sendiri lewat. Bila batas per
  // model tidak bekerja, model pertama akan menghabiskan seluruh anggaran waktu
  // sendirian dan model berikutnya tidak pernah tersentuh.
  const provider = ((id: string) => {
    attempted.push(id);
    return new MockLanguageModelV4({
      doGenerate: ({ abortSignal }) =>
        new Promise((_resolve, reject) => {
          abortSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    });
  }) as unknown as OpenRouterProvider;

  await assert.rejects(
    // Anggaran dokumen longgar, batas per model sangat ketat: kegagalan di sini
    // hanya bisa datang dari batas per model.
    analyzeLongDocument(provider, longDocument, 60_000, 40),
    (error: unknown) => {
      assert.ok(error instanceof Error, "harus melempar galat");
      assert.ok(
        !(error instanceof AnalysisTimeoutError),
        "anggaran dokumen belum habis, jadi ini kegagalan model biasa, bukan kehabisan waktu",
      );
      return true;
    },
  );

  // Rantai bagian pertama harus habis dicoba seluruhnya. Bila batas per model
  // tidak bekerja, hanya model pertama yang tercatat.
  const firstChunkChain = modelRotation(0).map((model) => model.id);
  const attemptedIds = new Set(attempted);

  for (const id of firstChunkChain) {
    assert.ok(attemptedIds.has(id), `${id} tidak pernah dicoba, rantai berhenti di model sebelumnya`);
  }
  assert.ok(firstChunkChain.length > 1, "rantai harus memuat lebih dari satu model agar uji ini bermakna");
});
