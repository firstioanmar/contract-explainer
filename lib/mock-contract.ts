import type { ContractResult } from "@/lib/contract-types";
import { contractAnalysisSchema } from "@/lib/contract-schema";

export const sampleContract = `PERJANJIAN JASA PEMBUATAN WEBSITE

Pada tanggal 10 Juni 2026, PT Langit Digital Nusantara ("Penyedia") dan CV Rasa Karya ("Klien") sepakat mengadakan perjanjian jasa pembuatan website dengan nilai kontrak Rp48.000.000.

Pasal 2 — Jangka Waktu
Pekerjaan dimulai 15 Juni 2026 dan harus diselesaikan paling lambat 15 September 2026. Perpanjangan hanya dapat dilakukan dengan persetujuan tertulis kedua pihak.

Pasal 3 — Pembayaran
Pembayaran dilakukan dalam 3 tahap: 30% setelah penandatanganan, 40% setelah persetujuan desain, dan 30% setelah serah terima. Invoice wajib dibayar maksimal 14 hari kalender.

Pasal 4 — Keterlambatan
Keterlambatan pembayaran dikenakan denda 0,5% per hari dari jumlah tertunggak, maksimal 10%. Penyedia dapat menghentikan pekerjaan sementara jika keterlambatan melebihi 7 hari.

Pasal 6 — Pengakhiran
Klien dapat mengakhiri perjanjian dengan pemberitahuan 7 hari, namun seluruh pembayaran yang telah dilakukan tidak dapat dikembalikan. Penyedia dapat mengakhiri perjanjian secara sepihak jika Klien melanggar kewajiban material.

Pasal 8 — Hak Kekayaan Intelektual
Hak atas hasil pekerjaan beralih kepada Klien setelah seluruh pembayaran diterima.`;

const structuredMockPayload = contractAnalysisSchema.parse({
  jenisDokumen: "kontrak",
  isValidDocument: true,
  alasanPenolakan: null,
  judulDokumen: "Perjanjian Jasa Pembuatan Website",
  tingkatPerhatian: "Sedang",
  ringkasan: "Ini adalah perjanjian pembuatan website senilai Rp48 juta antara PT Langit Digital Nusantara dan CV Rasa Karya. Pekerjaan berlangsung selama 3 bulan dengan pembayaran bertahap. Bagian yang perlu Anda perhatikan terutama adalah denda keterlambatan harian dan ketentuan bahwa pembayaran yang sudah masuk tidak dapat dikembalikan jika kontrak diakhiri oleh klien.",
  pihak: [
    { nama: "PT Langit Digital Nusantara", peran: "Penyedia", sumber: "Pembukaan" },
    { nama: "CV Rasa Karya", peran: "Klien", sumber: "Pembukaan" },
  ],
  nilaiKontrak: { nilai: 48_000_000, mataUang: "IDR", tampilan: "Rp48.000.000", sumber: "Pembukaan" },
  tanggalMulai: { iso: "2026-06-15", tampilan: "15 Juni 2026", sumber: "Pasal 2" },
  tanggalJatuhTempo: { iso: "2026-09-15", tampilan: "15 September 2026", sumber: "Pasal 2" },
  durasi: { tampilan: "3 bulan", sumber: "Pasal 2" },
  temuanUtama: [
    "Hak atas website baru berpindah setelah pembayaran lunas.",
    "Perubahan tenggat harus disetujui secara tertulis oleh kedua pihak.",
    "Penyedia dapat menghentikan pekerjaan setelah pembayaran terlambat 7 hari.",
  ],
  penalti: [
    { pemicu: "Pembayaran terlambat", konsekuensi: "Denda 0,5% per hari, maksimal 10%", sumber: "Pasal 4.1" },
    { pemicu: "Terlambat lebih dari 7 hari", konsekuensi: "Pekerjaan dapat dihentikan sementara", sumber: "Pasal 4.2" },
  ],
  klausulWaspada: [
    { judul: "Pembayaran tidak dapat dikembalikan", tingkat: "Tinggi", alasan: "Anda tetap kehilangan seluruh pembayaran sebelumnya meski hasil pekerjaan belum selesai.", kutipan: "...seluruh pembayaran yang telah dilakukan tidak dapat dikembalikan.", sumber: "Pasal 6.1" },
    { judul: "Denda keterlambatan dihitung harian", tingkat: "Sedang", alasan: "Akumulasi 0,5% per hari cukup agresif dan dapat mencapai batas 10% dalam 20 hari.", kutipan: "...dikenakan denda 0,5% per hari dari jumlah tertunggak...", sumber: "Pasal 4.1" },
    { judul: "Pengakhiran sepihak oleh penyedia", tingkat: "Sedang", alasan: "Istilah ‘kewajiban material’ tidak didefinisikan secara rinci, sehingga dapat menimbulkan perbedaan tafsir.", kutipan: "...dapat mengakhiri perjanjian secara sepihak...", sumber: "Pasal 6.2" },
  ],
  tindakanDisarankan: [
    { tindakan: "Minta batas waktu perbaikan sebelum pengakhiran sepihak.", sumber: "Pasal 6.2" },
    { tindakan: "Negosiasikan pengembalian dana secara proporsional untuk pekerjaan yang belum dilakukan.", sumber: "Pasal 6.1" },
  ],
});

export const mockResult: ContractResult = {
  title: "Perjanjian Jasa Pembuatan Website",
  analyzedAt: "Baru saja",
  attention: "Sedang",
  summary: structuredMockPayload.ringkasan,
  insights: [
    "Hak atas website baru berpindah setelah pembayaran lunas.",
    "Perubahan tenggat harus disetujui secara tertulis oleh kedua pihak.",
    "Penyedia dapat menghentikan pekerjaan setelah pembayaran terlambat 7 hari.",
  ],
  data: [
    { label: "Para Pihak", value: structuredMockPayload.pihak.map((item) => item.nama).join(" ↔ "), source: "Pembukaan", icon: "users" },
    { label: "Nilai Kontrak", value: structuredMockPayload.nilaiKontrak?.tampilan ?? "Tidak ditemukan", source: "Pembukaan", icon: "wallet" },
    { label: "Tanggal Mulai", value: "15 Juni 2026", source: "Pasal 2", icon: "calendar" },
    { label: "Jatuh Tempo", value: "15 September 2026", source: "Pasal 2", icon: "clock" },
    { label: "Durasi", value: "3 bulan", source: "Pasal 2", icon: "timer" },
  ],
  penalties: structuredMockPayload.penalti.map((item) => ({ trigger: item.pemicu, consequence: item.konsekuensi, source: item.sumber })),
  risks: structuredMockPayload.klausulWaspada.map((item) => ({ title: item.judul, severity: item.tingkat, reason: item.alasan, quote: item.kutipan, source: item.sumber })),
  actions: [
    { text: "Minta batas waktu perbaikan sebelum pengakhiran sepihak.", source: "Pasal 6.2" },
    { text: "Negosiasikan pengembalian dana secara proporsional untuk pekerjaan yang belum dilakukan.", source: "Pasal 6.1" },
    { text: "Pastikan kriteria persetujuan desain ditulis secara objektif.", source: "Pasal 3" },
    { text: "Simpan semua persetujuan perubahan tenggat dalam bentuk tertulis.", source: "Pasal 2" },
  ],
  warnings: [],
  sourceReferences: ["Pembukaan", "Pasal 2", "Pasal 3", "Pasal 4.1", "Pasal 4.2", "Pasal 6.1", "Pasal 6.2", "Pasal 8"],
};
