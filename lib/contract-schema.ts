import { z } from "zod";

export const contractAnalysisSchema = z.object({
  jenisDokumen: z.enum(["kontrak", "invoice", "bukan_dokumen"])
    .describe("Klasifikasi dokumen. Gunakan bukan_dokumen untuk input yang tidak relevan."),
  isValidDocument: z.boolean()
    .describe("True hanya jika input merupakan kontrak, perjanjian, invoice, atau dokumen komersial serupa."),
  alasanPenolakan: z.string().nullable()
    .describe("Alasan singkat dalam bahasa Indonesia jika input bukan dokumen yang valid, selain itu null."),
  judulDokumen: z.string().min(1)
    .describe("Judul dokumen yang ringkas. Gunakan 'Dokumen tidak dikenali' untuk input tidak valid."),
  tingkatPerhatian: z.enum(["Rendah", "Sedang", "Tinggi"]),
  ringkasan: z.string().min(10)
    .describe("Ringkasan 2-4 kalimat dalam bahasa Indonesia awam, faktual, dan bukan nasihat hukum."),
  pihak: z.array(z.object({
    nama: z.string().min(1),
    peran: z.string().min(1),
    sumber: z.string().min(1),
  })),
  nilaiKontrak: z.object({
    nilai: z.number().nonnegative(),
    mataUang: z.string().length(3),
    tampilan: z.string().min(1),
    sumber: z.string().min(1),
  }).nullable(),
  tanggalMulai: z.object({
    iso: z.string(),
    tampilan: z.string().min(1),
    sumber: z.string().min(1),
  }).nullable(),
  tanggalJatuhTempo: z.object({
    iso: z.string(),
    tampilan: z.string().min(1),
    sumber: z.string().min(1),
  }).nullable(),
  durasi: z.object({
    tampilan: z.string().min(1),
    sumber: z.string().min(1),
  }).nullable(),
  temuanUtama: z.array(z.string().min(1)).max(5),
  penalti: z.array(z.object({
    pemicu: z.string().min(1),
    konsekuensi: z.string().min(1),
    sumber: z.string().min(1),
  })),
  klausulWaspada: z.array(z.object({
    judul: z.string().min(1),
    tingkat: z.enum(["Rendah", "Sedang", "Tinggi"]),
    alasan: z.string().min(1),
    kutipan: z.string().min(1),
    sumber: z.string().min(1),
  })),
  tindakanDisarankan: z.array(z.object({
    tindakan: z.string().min(1),
    sumber: z.string().nullable(),
  })).max(8),
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
