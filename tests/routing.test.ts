import assert from "node:assert/strict";
import test from "node:test";
import { buildContractPrompt } from "../lib/ai/contract-prompt";
import { splitDocument } from "../lib/ai/document-chunks";
import { mergeAnalyses } from "../lib/ai/merge-analysis";
import { ANALYSIS_MODELS, modelRotation } from "../lib/ai/models";
import type { ContractAnalysis } from "../lib/contract-schema";

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

test("giliran model berputar dan selalu memuat seluruh model", () => {
  for (let offset = 0; offset < ANALYSIS_MODELS.length + 2; offset += 1) {
    const rotation = modelRotation(offset);
    assert.equal(rotation.length, ANALYSIS_MODELS.length);
    assert.equal(new Set(rotation.map((model) => model.id)).size, ANALYSIS_MODELS.length);
  }

  assert.notEqual(modelRotation(0)[0].id, modelRotation(1)[0].id);
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
