import { z } from "zod";

/**
 * Deskripsi setiap field ikut dikirim ke model sebagai JSON Schema, sehingga
 * aturan yang ditulis di sini berada tepat di sebelah tempat model menulis
 * jawabannya. Untuk model gratis berukuran kecil, penempatan ini lebih efektif
 * daripada menaruh semua aturan di system prompt.
 */

const sumberField = z.string().min(1)
  .describe("Penanda yang bisa dicek di dokumen. Pakai 'Pasal N' hanya jika dokumen menuliskan nomor pasal itu, selain itu pakai 'Baris N' sesuai penanda L. Jangan mengarang nomor.");

export const contractAnalysisSchema = z.object({
  jenisDokumen: z.enum(["kontrak", "invoice", "bukan_dokumen"])
    .describe("kontrak untuk perjanjian, SPK, purchase order, MoU, addendum. invoice untuk faktur atau tagihan. bukan_dokumen untuk teks yang bukan dokumen komersial."),
  isValidDocument: z.boolean()
    .describe("True hanya jika input merupakan kontrak, perjanjian, invoice, atau dokumen komersial serupa. False jika jenisDokumen bukan_dokumen."),
  alasanPenolakan: z.string().nullable()
    .describe("Satu kalimat bahasa Indonesia yang menjelaskan mengapa input ditolak. Wajib null jika dokumen valid."),
  judulDokumen: z.string().min(1)
    .describe("Judul dokumen apa adanya, ringkas. Gunakan persis 'Dokumen tidak dikenali' untuk input tidak valid."),
  tingkatPerhatian: z.enum(["Rendah", "Sedang", "Tinggi"])
    .describe("Tinggi jika ada risiko dana besar atau kewajiban sepihak. Sedang jika ada denda material atau klausul tidak jelas. Rendah jika syarat seimbang."),
  ringkasan: z.string().min(10)
    .describe("2-4 kalimat bahasa Indonesia awam: tujuan dokumen, kewajiban utama, nilai dan waktu bila ada, lalu risiko terpenting. Faktual, bukan nasihat hukum."),
  pihak: z.array(z.object({
    nama: z.string().min(1).describe("Nama pihak persis seperti tertulis di dokumen."),
    peran: z.string().min(1).describe("Peran memakai istilah dokumen, misalnya Klien, Penyedia, Penjual, Pembeli, Pemberi Kerja, Pekerja, Penerbit Invoice."),
    sumber: sumberField,
  })).describe("Setiap pihak muncul tepat satu kali. Kosongkan jika dokumen tidak valid."),
  nilaiKontrak: z.object({
    nilai: z.number().nonnegative().describe("Angka murni tanpa titik, koma ribuan, atau simbol mata uang. Contoh: 13875000."),
    mataUang: z.string().length(3).describe("Kode ISO tiga huruf, misalnya IDR atau USD."),
    tampilan: z.string().min(1).describe("Format terbaca seperti tertulis di dokumen, misalnya 'Rp13.875.000'."),
    sumber: sumberField,
  }).nullable()
    .describe("Total nilai transaksi. Jika ada baris TOTAL, pakai angka itu. Jangan memakai subtotal, cicilan, persentase, pajak, atau denda. Null jika dokumen tidak menyebut nilai."),
  tanggalMulai: z.object({
    iso: z.string().describe("YYYY-MM-DD bila tanggal lengkap. Jika tidak lengkap, salin teks asli dari dokumen."),
    tampilan: z.string().min(1).describe("Tanggal seperti tertulis di dokumen, misalnya '5 Januari 2026'."),
    sumber: sumberField,
  }).nullable()
    .describe("Tanggal pekerjaan atau masa berlaku dimulai. Bukan tanggal dokumen dibuat, kecuali dokumen menyatakan keduanya sama. Null jika tidak disebut."),
  tanggalJatuhTempo: z.object({
    iso: z.string().describe("YYYY-MM-DD bila tanggal lengkap. Jika tidak lengkap, salin teks asli seperti '30 hari setelah invoice'."),
    tampilan: z.string().min(1).describe("Tanggal seperti tertulis di dokumen."),
    sumber: sumberField,
  }).nullable()
    .describe("Batas pembayaran atau batas penyelesaian pekerjaan yang paling relevan. Untuk invoice, pakai jatuh tempo pembayaran. Null jika tidak disebut."),
  durasi: z.object({
    tampilan: z.string().min(1).describe("Jangka waktu yang tertulis, misalnya '12 bulan' atau '5 Januari sampai 30 April 2026'."),
    sumber: sumberField,
  }).nullable()
    .describe("Null jika dokumen tidak menyebut jangka waktu."),
  temuanUtama: z.array(z.string().min(1)).max(5)
    .describe("Maksimal 5 kalimat pendek berisi fakta penting dari dokumen. Bukan opini, bukan saran."),
  penalti: z.array(z.object({
    pemicu: z.string().min(1).describe("Kondisi yang memicu penalti, misalnya 'Pembayaran melewati tanggal jatuh tempo'."),
    konsekuensi: z.string().min(1).describe("Akibat yang tertulis, misalnya 'Denda 0,25% per hari, maksimal 5% dari nilai kontrak'."),
    sumber: sumberField,
  })).describe("Hanya konsekuensi yang benar-benar tertulis di dokumen. Kosongkan jika tidak ada."),
  klausulWaspada: z.array(z.object({
    judul: z.string().min(1).describe("Nama singkat klausul dalam bahasa awam."),
    tingkat: z.enum(["Rendah", "Sedang", "Tinggi"]),
    alasan: z.string().min(1).describe("Satu sampai dua kalimat: kenapa klausul ini berisiko bagi pembaca."),
    kutipan: z.string().min(1).describe("Disalin persis dari dokumen, maksimal satu kalimat. Jangan diparafrase dan jangan sertakan penanda L."),
    sumber: sumberField,
  })).describe("Hanya klausul yang benar-benar merugikan, sepihak, atau tidak jelas. Klausul yang wajar tidak dimasukkan."),
  tindakanDisarankan: z.array(z.object({
    tindakan: z.string().min(1).describe("Langkah konkret dan proporsional yang bisa dilakukan pembaca."),
    sumber: z.string().nullable().describe("Sumber terkait bila ada, selain itu null."),
  })).max(8)
    .describe("Maksimal 8 tindakan. Kosongkan jika dokumen tidak valid."),
});

export type ContractAnalysis = z.infer<typeof contractAnalysisSchema>;

export type DeepPartial<T> = T extends Array<infer Item>
  ? Array<DeepPartial<Item> | undefined>
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export type PartialContractAnalysis = DeepPartial<ContractAnalysis>;

export const analyzeRequestSchema = z.object({
  text: z.string().trim().min(80).max(60_000),
});
