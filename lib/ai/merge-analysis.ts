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

function summarySentences(value: string) {
  return value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [value];
}

/** Mengambil sedikitnya satu fakta ringkasan dari setiap bagian, maksimal empat kalimat. */
function mergeSummaries(analyses: ContractAnalysis[]) {
  const perPart = analyses.map((analysis) => summarySentences(analysis.ringkasan));
  const selected = dedupe(perPart.map((sentences) => sentences.slice(0, 1)), normalizeKey, 4);

  if (selected.length < 4) {
    const additions = dedupe(perPart, normalizeKey);
    for (const sentence of additions) {
      if (selected.some((current) => normalizeKey(current) === normalizeKey(sentence))) continue;
      selected.push(sentence);
      if (selected.length >= 4) break;
    }
  }

  return selected.join(" ");
}

/**
 * Jangan membandingkan angka lintas mata uang. Pilih mata uang yang paling
 * sering terdeteksi, lalu angka terbesar di dalam mata uang tersebut untuk
 * membedakan total dari subtotal/cicilan.
 */
function selectContractValue(analyses: ContractAnalysis[]) {
  const values = analyses.flatMap((analysis, partIndex) => analysis.nilaiKontrak
    ? [{ value: analysis.nilaiKontrak, partIndex }]
    : []);
  if (values.length === 0) return null;

  const groups = new Map<string, typeof values>();
  for (const candidate of values) {
    const currency = candidate.value.mataUang.toUpperCase();
    groups.set(currency, [...(groups.get(currency) ?? []), candidate]);
  }

  const selectedCurrency = [...groups.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[1][0].partIndex - b[1][0].partIndex;
  })[0][0];

  return [...groups.get(selectedCurrency)!].sort((a, b) => b.value.nilai - a.value.nilai)[0].value;
}

function mostFrequentDefined<Key extends "tanggalMulai" | "tanggalJatuhTempo" | "durasi">(
  analyses: ContractAnalysis[],
  key: Key,
) {
  const values = analyses.flatMap((analysis, partIndex) => analysis[key]
    ? [{ value: analysis[key], partIndex }]
    : []);
  if (values.length === 0) return null;

  const groups = new Map<string, typeof values>();
  for (const candidate of values) {
    const groupKey = normalizeKey(candidate.value!.tampilan);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), candidate]);
  }

  return [...groups.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a[0].partIndex - b[0].partIndex;
  })[0][0].value;
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

  const ringkasan = mergeSummaries(valid);
  const nilaiKontrak = selectContractValue(valid);

  return {
    jenisDokumen,
    isValidDocument: true,
    alasanPenolakan: null,
    judulDokumen,
    tingkatPerhatian: highestAttention(valid.map((part) => part.tingkatPerhatian)),
    ringkasan,
    pihak: dedupe(valid.map((part) => part.pihak), (party) => normalizeKey(party.nama)),
    nilaiKontrak,
    tanggalMulai: mostFrequentDefined(valid, "tanggalMulai"),
    tanggalJatuhTempo: mostFrequentDefined(valid, "tanggalJatuhTempo"),
    durasi: mostFrequentDefined(valid, "durasi"),
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
