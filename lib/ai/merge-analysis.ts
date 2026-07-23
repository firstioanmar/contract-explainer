import type { ContractAnalysis } from "@/lib/contract-schema";

const ATTENTION_RANK = { Rendah: 0, Sedang: 1, Tinggi: 2 } as const;

type Attention = ContractAnalysis["tingkatPerhatian"];

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Menggabungkan daftar dari beberapa bagian tanpa duplikat, mempertahankan urutan kemunculan. */
function dedupe<Item>(groups: Item[][], keyOf: (item: Item) => string, limit?: number) {
  const seen = new Set<string>();
  const result: Item[] = [];

  for (const group of groups) {
    for (const item of group) {
      const key = keyOf(item);
      if (key.length === 0 || seen.has(key)) continue;
      seen.add(key);
      result.push(item);
      if (limit !== undefined && result.length >= limit) return result;
    }
  }

  return result;
}

/** Seberapa banyak fakta yang berhasil diambil sebuah bagian; dipakai memilih ringkasan terbaik. */
function richness(analysis: ContractAnalysis) {
  return analysis.pihak.length
    + analysis.penalti.length
    + analysis.klausulWaspada.length
    + analysis.temuanUtama.length
    + (analysis.nilaiKontrak ? 2 : 0)
    + (analysis.tanggalMulai ? 1 : 0)
    + (analysis.tanggalJatuhTempo ? 1 : 0);
}

function highestAttention(values: Attention[]): Attention {
  return values.reduce<Attention>(
    (highest, value) => (ATTENTION_RANK[value] > ATTENTION_RANK[highest] ? value : highest),
    "Rendah",
  );
}

/**
 * Menggabungkan hasil analisis beberapa bagian dokumen menjadi satu hasil utuh.
 *
 * Penggabungan dilakukan tanpa memanggil model lagi, supaya tidak menambah titik
 * gagal baru pada rangkaian yang sudah bergantung pada model gratis.
 */
export function mergeAnalyses(parts: ContractAnalysis[]): ContractAnalysis {
  if (parts.length === 0) {
    throw new Error("Tidak ada hasil analisis untuk digabungkan.");
  }

  if (parts.length === 1) return parts[0];

  // Bagian yang menolak dokumen diabaikan: pada dokumen panjang, satu bagian
  // bisa saja hanya berisi lampiran atau tabel yang tampak bukan kontrak.
  const valid = parts.filter((part) => part.isValidDocument && part.jenisDokumen !== "bukan_dokumen");

  if (valid.length === 0) {
    return { ...parts[0], isValidDocument: false, jenisDokumen: "bukan_dokumen" };
  }

  const typeCounts = new Map<ContractAnalysis["jenisDokumen"], number>();
  for (const part of valid) {
    typeCounts.set(part.jenisDokumen, (typeCounts.get(part.jenisDokumen) ?? 0) + 1);
  }
  const jenisDokumen = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

  // Judul diambil dari bagian pertama karena judul dokumen selalu ada di awal.
  const judulDokumen = valid[0].judulDokumen;

  // Ringkasan diambil dari bagian dengan ekstraksi terkaya, bukan digabung,
  // agar tetap 2-4 kalimat dan tidak berulang.
  const ringkasan = [...valid].sort((a, b) => richness(b) - richness(a))[0].ringkasan;

  // Nilai terbesar dipilih karena subtotal, cicilan, dan pajak selalu lebih
  // kecil daripada total transaksi yang dicari.
  const nilaiKontrak = valid
    .map((part) => part.nilaiKontrak)
    .filter((value): value is NonNullable<ContractAnalysis["nilaiKontrak"]> => value !== null)
    .sort((a, b) => b.nilai - a.nilai)[0] ?? null;

  const firstDefined = <Key extends "tanggalMulai" | "tanggalJatuhTempo" | "durasi">(key: Key) =>
    valid.find((part) => part[key] !== null)?.[key] ?? null;

  return {
    jenisDokumen,
    isValidDocument: true,
    alasanPenolakan: null,
    judulDokumen,
    tingkatPerhatian: highestAttention(valid.map((part) => part.tingkatPerhatian)),
    ringkasan,
    pihak: dedupe(valid.map((part) => part.pihak), (party) => normalizeKey(party.nama)),
    nilaiKontrak,
    tanggalMulai: firstDefined("tanggalMulai"),
    tanggalJatuhTempo: firstDefined("tanggalJatuhTempo"),
    durasi: firstDefined("durasi"),
    temuanUtama: dedupe(valid.map((part) => part.temuanUtama), normalizeKey, 5),
    penalti: dedupe(
      valid.map((part) => part.penalti),
      (penalty) => `${normalizeKey(penalty.pemicu)}|${normalizeKey(penalty.konsekuensi)}`,
    ),
    klausulWaspada: dedupe(valid.map((part) => part.klausulWaspada), (clause) => normalizeKey(clause.kutipan))
      .sort((a, b) => ATTENTION_RANK[b.tingkat] - ATTENTION_RANK[a.tingkat]),
    tindakanDisarankan: dedupe(
      valid.map((part) => part.tindakanDisarankan),
      (action) => normalizeKey(action.tindakan),
      8,
    ),
  };
}
