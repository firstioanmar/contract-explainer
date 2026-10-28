import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisTimeoutError, resolveAnalysisOutcome } from "../lib/ai/analyze-document";
import { buildContractPrompt } from "../lib/ai/contract-prompt";
import { splitDocument, type DocumentChunk } from "../lib/ai/document-chunks";
import { mergeAnalyses } from "../lib/ai/merge-analysis";
import {
  ANALYSIS_MODELS,
  FALLBACK_ANALYSIS_MODELS,
  FREE_MODELS,
  MAX_FREE_ATTEMPTS_PER_CHUNK,
  OPENROUTER_MAX_FALLBACK_MODELS,
  PAID_MODELS,
  PRIMARY_ANALYSIS_MODEL,
  STREAMING_MODELS,
  modelRotation,
} from "../lib/ai/models";
import type { ContractAnalysis } from "../lib/contract-schema";

function chunkStubs(count: number): DocumentChunk[] {
  return Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    total: count,
    startLine: index * 10 + 1,
    endLine: index * 10 + 10,
    text: `bagian ${index + 1}`,
  }));
}

function makeDocument(lines: number) {
  return Array.from({ length: lines }, (_, index) => `Pasal ${index + 1} berisi ketentuan pelaksanaan pekerjaan.`)
    .join("\n");
}

function baseAnalysis(overrides: Partial<ContractAnalysis> = {}): ContractAnalysis {
  return {
    jenisDokumen: "kontrak",
    isValidDocument: true,
    alasanPenolakan: null,
    judulDokumen: "Perjanjian Uji",
    tingkatPerhatian: "Rendah",
    ringkasan: "Ringkasan bagian dokumen yang cukup panjang untuk lolos validasi schema.",
    pihak: [],
    nilaiKontrak: null,
    tanggalMulai: null,
    tanggalJatuhTempo: null,
    durasi: null,
    temuanUtama: [],
    penalti: [],
    klausulWaspada: [],
    tindakanDisarankan: [],
    ...overrides,
  };
}

test("dokumen pendek tetap satu bagian", () => {
  const chunks = splitDocument("Isi kontrak pendek.", 1_000);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].startLine, 1);
});

test("dokumen panjang dipecah dan menutup seluruh baris tanpa celah", () => {
  const document = makeDocument(400);
  const chunks = splitDocument(document, 2_000, 4);

  assert.ok(chunks.length > 1, "dokumen panjang harus terpecah");
  assert.equal(chunks[0].startLine, 1);
  assert.equal(chunks.at(-1)!.endLine, 400);

  // Bagian berikutnya tidak boleh melewati baris yang belum terbaca.
  for (let index = 1; index < chunks.length; index += 1) {
    assert.ok(
      chunks[index].startLine <= chunks[index - 1].endLine + 1,
      `ada celah antara bagian ${index} dan ${index + 1}`,
    );
  }
});

test("setiap bagian tetap di bawah anggaran karakter", () => {
  for (const chunk of splitDocument(makeDocument(400), 2_000, 4)) {
    assert.ok(chunk.text.length <= 2_000, `bagian ${chunk.index} melebihi anggaran`);
  }
});

test("baris tunggal yang sangat panjang tetap dipecah", () => {
  const chunks = splitDocument("x".repeat(5_000), 1_000, 2);
  for (const chunk of chunks) {
    assert.ok(chunk.text.length <= 1_000);
  }
});

test("nomor baris pada prompt memakai penomoran global dokumen", () => {
  const chunks = splitDocument(makeDocument(400), 2_000, 4);
  const second = chunks[1];
  const prompt = buildContractPrompt(second.text, second);

  assert.ok(prompt.includes(`L${second.startLine}|`), "bagian kedua harus mulai dari nomor baris globalnya");
  assert.ok(!prompt.includes("\nL1| "), "bagian kedua tidak boleh menomori ulang dari 1");
  assert.ok(prompt.includes(`BAGIAN ${second.index} DARI ${second.total}`));
});

test("giliran model berputar dan tidak pernah mengulang model yang sama", () => {
  const expected = (PAID_MODELS.length === 0 ? FREE_MODELS.length : MAX_FREE_ATTEMPTS_PER_CHUNK) + PAID_MODELS.length;

  for (let offset = 0; offset < ANALYSIS_MODELS.length + 2; offset += 1) {
    const rotation = modelRotation(offset);
    assert.equal(rotation.length, expected);
    assert.equal(new Set(rotation.map((model) => model.id)).size, expected, `giliran ${offset} memuat model kembar`);
  }

  assert.notEqual(modelRotation(0)[0].id, modelRotation(1)[0].id);
});

test("rotasi tetap memakai seluruh model gratis lintas bagian dokumen", () => {
  const seen = new Set<string>();
  for (let offset = 0; offset < FREE_MODELS.length; offset += 1) {
    for (const model of modelRotation(offset)) {
      if (model.tier === "gratis") seen.add(model.id);
    }
  }

  // Inti permintaan "bagi beban": tiap bagian hanya mencoba sebagian model
  // gratis, tetapi lintas bagian seluruhnya tetap kebagian giliran.
  assert.equal(seen.size, FREE_MODELS.length, "ada model gratis yang tidak pernah kebagian giliran");
});

test("model gratis selalu dicoba lebih dulu sebelum model berbayar", () => {
  for (let offset = 0; offset < FREE_MODELS.length + 2; offset += 1) {
    const rotation = modelRotation(offset);
    const firstPaid = rotation.findIndex((model) => model.tier !== "gratis");

    if (firstPaid === -1) continue;
    assert.equal(firstPaid, MAX_FREE_ATTEMPTS_PER_CHUNK, `giliran ${offset} menyentuh lapis berbayar terlalu cepat`);
    assert.ok(
      rotation.slice(0, firstPaid).every((model) => model.tier === "gratis"),
      `giliran ${offset} menyelipkan model berbayar di antara model gratis`,
    );
  }
});

test("jalur streaming dipimpin model yang patuh schema, bukan model gratis", () => {
  // Aliran yang sudah terkirim tidak bisa ditarik kembali, jadi jalur ini tidak
  // punya kesempatan kedua dan harus dipimpin model yang paling jarang meleset.
  if (PAID_MODELS.length === 0) {
    assert.equal(STREAMING_MODELS[0].tier, "gratis", "tanpa lapis berbayar, jalur ini hanya punya model gratis");
    return;
  }

  assert.equal(STREAMING_MODELS[0].id, PAID_MODELS[0].id);
  assert.equal(
    new Set(STREAMING_MODELS.map((model) => model.id)).size,
    PAID_MODELS.length + FREE_MODELS.length,
    "seluruh model tetap tersedia sebagai cadangan aliran",
  );
});

test("daftar cadangan aliran tidak melampaui batas OpenRouter", () => {
  // OpenRouter menolak daftar lebih dari tiga model, dan penolakannya sampai ke
  // pengguna sebagai respons kosong. Batas ini harus dijaga uji, bukan ingatan.
  assert.ok(
    FALLBACK_ANALYSIS_MODELS.length <= OPENROUTER_MAX_FALLBACK_MODELS,
    `daftar cadangan ${FALLBACK_ANALYSIS_MODELS.length} model, batas ${OPENROUTER_MAX_FALLBACK_MODELS}`,
  );
  assert.ok(
    !FALLBACK_ANALYSIS_MODELS.includes(PRIMARY_ANALYSIS_MODEL),
    "model utama tidak perlu diulang di daftar cadangan",
  );
});

test("urutan lapis berbayar tetap dari yang termurah di setiap giliran", () => {
  const paidIds = PAID_MODELS.map((model) => model.id);

  for (let offset = 0; offset < FREE_MODELS.length + 2; offset += 1) {
    const tail = modelRotation(offset).filter((model) => model.tier !== "gratis").map((model) => model.id);
    assert.deepEqual(tail, paidIds, `giliran ${offset} mengubah urutan lapis berbayar`);
  }
});

test("seluruh model dalam rantai memakai id yang unik", () => {
  const ids = ANALYSIS_MODELS.map((model) => model.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("penggabungan menyatukan pihak tanpa duplikat dan mengambil perhatian tertinggi", () => {
  const merged = mergeAnalyses([
    baseAnalysis({
      pihak: [{ nama: "PT Arunika Teknologi", peran: "Klien", sumber: "Baris 3" }],
      tingkatPerhatian: "Rendah",
    }),
    baseAnalysis({
      pihak: [
        { nama: "PT ARUNIKA TEKNOLOGI", peran: "Klien", sumber: "Baris 210" },
        { nama: "Studio Bentuk", peran: "Penyedia", sumber: "Baris 212" },
      ],
      tingkatPerhatian: "Tinggi",
    }),
  ]);

  assert.equal(merged.pihak.length, 2);
  assert.equal(merged.tingkatPerhatian, "Tinggi");
});

test("penggabungan memilih nilai kontrak terbesar, bukan subtotal", () => {
  const merged = mergeAnalyses([
    baseAnalysis({
      nilaiKontrak: { nilai: 12_500_000, mataUang: "IDR", tampilan: "Rp12.500.000", sumber: "Baris 6" },
    }),
    baseAnalysis({
      nilaiKontrak: { nilai: 13_875_000, mataUang: "IDR", tampilan: "Rp13.875.000", sumber: "Baris 8" },
    }),
  ]);

  assert.equal(merged.nilaiKontrak?.nilai, 13_875_000);
  assert.equal(merged.nilaiKontrak?.sumber, "Baris 8");
});

test("penggabungan tidak membandingkan nilai dari mata uang yang berbeda", () => {
  const merged = mergeAnalyses([
    baseAnalysis({
      nilaiKontrak: { nilai: 75_000_000, mataUang: "IDR", tampilan: "Rp75.000.000", sumber: "Baris 6" },
    }),
    baseAnalysis({
      nilaiKontrak: { nilai: 250_000, mataUang: "USD", tampilan: "USD 250,000", sumber: "Baris 80" },
    }),
  ]);

  assert.equal(merged.nilaiKontrak?.mataUang, "IDR");
  assert.equal(merged.nilaiKontrak?.sumber, "Baris 6");
});

test("ringkasan gabungan mewakili lebih dari satu bagian dokumen", () => {
  const merged = mergeAnalyses([
    baseAnalysis({ ringkasan: "Bagian awal menjelaskan para pihak. Pembayaran dilakukan bertahap." }),
    baseAnalysis({ ringkasan: "Bagian akhir mengatur pengakhiran. Ada kewajiban pengembalian aset." }),
  ]);

  assert.match(merged.ringkasan, /Bagian awal/);
  assert.match(merged.ringkasan, /Bagian akhir/);
  assert.ok((merged.ringkasan.match(/[.!?]+/g) ?? []).length <= 4);
});

test("bagian yang menolak dokumen tidak membatalkan hasil bagian lain", () => {
  const merged = mergeAnalyses([
    baseAnalysis({
      jenisDokumen: "bukan_dokumen",
      isValidDocument: false,
      judulDokumen: "Dokumen tidak dikenali",
    }),
    baseAnalysis({
      judulDokumen: "Perjanjian Jasa Desain",
      penalti: [{ pemicu: "Terlambat", konsekuensi: "Denda 0,25% per hari", sumber: "Pasal 5" }],
    }),
  ]);

  assert.equal(merged.isValidDocument, true);
  assert.equal(merged.jenisDokumen, "kontrak");
  assert.equal(merged.judulDokumen, "Perjanjian Jasa Desain");
  assert.equal(merged.penalti.length, 1);
});

test("penggabungan membuang klausul dan temuan yang berulang antar bagian", () => {
  const clause = {
    judul: "Pengalihan hak",
    tingkat: "Tinggi" as const,
    alasan: "Hak beralih sebelum pembayaran lunas.",
    kutipan: "Hak kekayaan intelektual beralih setelah pembayaran lunas.",
    sumber: "Pasal 8",
  };

  const merged = mergeAnalyses([
    baseAnalysis({ klausulWaspada: [clause], temuanUtama: ["Nilai kontrak Rp75.000.000"] }),
    baseAnalysis({ klausulWaspada: [{ ...clause, sumber: "Baris 190" }], temuanUtama: ["Nilai kontrak Rp75.000.000"] }),
  ]);

  assert.equal(merged.klausulWaspada.length, 1);
  assert.equal(merged.temuanUtama.length, 1);
});

test("kehabisan waktu dengan bagian belum selesai dilaporkan jujur, bukan disajikan sebagian", () => {
  const chunks = chunkStubs(3);
  const results = [baseAnalysis(), null, null];

  assert.throws(
    () => resolveAnalysisOutcome(chunks, results, true),
    (error: unknown) => {
      assert.ok(error instanceof AnalysisTimeoutError);
      assert.equal(error.completedChunks, 1);
      assert.equal(error.totalChunks, 3);
      return true;
    },
  );
});

test("kegagalan model sebagian tetap menghasilkan analisis dengan mencatat bagian gagal", () => {
  const chunks = chunkStubs(3);
  const results = [baseAnalysis({ judulDokumen: "Bagian A" }), null, baseAnalysis({ judulDokumen: "Bagian C" })];

  const { analysis, failedChunks } = resolveAnalysisOutcome(chunks, results, false);

  assert.equal(analysis.isValidDocument, true);
  assert.deepEqual(failedChunks, [2]);
});

test("selesai tepat sebelum batas waktu tetap disajikan penuh", () => {
  const chunks = chunkStubs(2);
  const results = [baseAnalysis(), baseAnalysis()];

  const { failedChunks } = resolveAnalysisOutcome(chunks, results, true);
  assert.deepEqual(failedChunks, []);
});

test("seluruh model gagal melempar galat biasa, bukan galat kehabisan waktu", () => {
  const chunks = chunkStubs(2);

  assert.throws(
    () => resolveAnalysisOutcome(chunks, [null, null], false),
    (error: unknown) => error instanceof Error && !(error instanceof AnalysisTimeoutError),
  );
});

test("hasil gabungan tetap lolos schema dan batas maksimum", () => {
  const merged = mergeAnalyses([
    baseAnalysis({ temuanUtama: ["a", "b", "c"] }),
    baseAnalysis({ temuanUtama: ["d", "e", "f"] }),
    baseAnalysis({
      tindakanDisarankan: Array.from({ length: 6 }, (_, index) => ({ tindakan: `Tindakan ${index}`, sumber: null })),
    }),
    baseAnalysis({
      tindakanDisarankan: Array.from({ length: 6 }, (_, index) => ({ tindakan: `Lanjutan ${index}`, sumber: null })),
    }),
  ]);

  assert.ok(merged.temuanUtama.length <= 5);
  assert.ok(merged.tindakanDisarankan.length <= 8);
});
