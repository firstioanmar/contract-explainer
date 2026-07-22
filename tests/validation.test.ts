import assert from "node:assert/strict";
import test from "node:test";
import { contractAnalysisSchema } from "../lib/contract-schema";
import { validateDocumentInput } from "../lib/document-validation";
import { contractFixtures, nonContractFixture } from "./fixtures/contracts";

test("tiga format kontrak/invoice lolos validasi lokal", () => {
  for (const fixture of contractFixtures) {
    assert.deepEqual(validateDocumentInput(fixture.text), { valid: true }, fixture.name);
  }
});

test("input non-kontrak ditolak sebelum memakai token model", () => {
  const result = validateDocumentInput(nonContractFixture);
  assert.equal(result.valid, false);
});

test("schema menerima representasi penolakan model yang aman", () => {
  const result = contractAnalysisSchema.parse({
    jenisDokumen: "bukan_dokumen",
    isValidDocument: false,
    alasanPenolakan: "Teks tidak memuat hubungan komersial atau kewajiban para pihak.",
    judulDokumen: "Dokumen tidak dikenali",
    tingkatPerhatian: "Rendah",
    ringkasan: "Input bukan kontrak atau invoice yang dapat dianalisis.",
    pihak: [],
    nilaiKontrak: null,
    tanggalMulai: null,
    tanggalJatuhTempo: null,
    durasi: null,
    temuanUtama: [],
    penalti: [],
    klausulWaspada: [],
    tindakanDisarankan: [],
  });

  assert.equal(result.isValidDocument, false);
  assert.equal(result.pihak.length, 0);
});

test("schema menolak severity di luar nilai yang disepakati", () => {
  const invalid = contractAnalysisSchema.safeParse({
    jenisDokumen: "kontrak",
    isValidDocument: true,
    alasanPenolakan: null,
    judulDokumen: "Kontrak Uji",
    tingkatPerhatian: "Ekstrem",
    ringkasan: "Ringkasan kontrak uji yang cukup panjang untuk validasi.",
    pihak: [],
    nilaiKontrak: null,
    tanggalMulai: null,
    tanggalJatuhTempo: null,
    durasi: null,
    temuanUtama: [],
    penalti: [],
    klausulWaspada: [],
    tindakanDisarankan: [],
  });

  assert.equal(invalid.success, false);
});
