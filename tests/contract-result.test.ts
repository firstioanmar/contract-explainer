import assert from "node:assert/strict";
import test from "node:test";
import { toContractResult } from "../lib/contract-result";
import type { ContractAnalysis } from "../lib/contract-schema";

const analysis: ContractAnalysis = {
  jenisDokumen: "kontrak",
  isValidDocument: true,
  alasanPenolakan: null,
  judulDokumen: "Perjanjian Uji",
  tingkatPerhatian: "Sedang",
  ringkasan: "Perjanjian ini mengatur layanan dan pembayaran para pihak.",
  pihak: [
    { nama: "PT Contoh", peran: "Klien", sumber: "Pembukaan" },
    { nama: "CV Uji", peran: "Penyedia", sumber: "Pembukaan" },
  ],
  nilaiKontrak: { nilai: 10_000_000, mataUang: "IDR", tampilan: "Rp10.000.000", sumber: "Pasal 3" },
  tanggalMulai: null,
  tanggalJatuhTempo: null,
  durasi: null,
  temuanUtama: [],
  penalti: [{ pemicu: "Terlambat", konsekuensi: "Denda 1%", sumber: "Pasal 4" }],
  klausulWaspada: [],
  tindakanDisarankan: [{ tindakan: "Periksa jadwal pembayaran.", sumber: "Pasal 3" }],
};

test("hasil UI memakai sumber nyata dan mempertahankan peringatan operasional", () => {
  const warning = "Bagian 2 tidak berhasil dianalisis.";
  const result = toContractResult(analysis, { warnings: [warning] });

  assert.deepEqual(result.sourceReferences, ["Pembukaan", "Pasal 3", "Pasal 4"]);
  assert.deepEqual(result.warnings, [warning]);
  assert.equal(result.sourceReferences?.includes("Pasal 2–8"), false);
});
