import type { ContractAnalysis } from "@/lib/contract-schema";
import type { ContractResult } from "@/lib/contract-types";

/**
 * Dokumen dikirim ke model dengan penanda baris "L12| " agar sumber bisa
 * diverifikasi. Model kecil kadang ikut menyalin penanda itu ke dalam kutipan,
 * jadi penanda dibersihkan sebelum ditampilkan.
 */
function stripLineMarkers(text: string) {
  return text.replace(/L\d+\|\s*/g, "").trim();
}

export function toContractResult(analysis: ContractAnalysis): ContractResult {
  const partiesSource = analysis.pihak[0]?.sumber ?? "Dokumen";

  return {
    title: analysis.judulDokumen,
    analyzedAt: "baru saja",
    attention: analysis.tingkatPerhatian,
    summary: analysis.ringkasan,
    insights: analysis.temuanUtama,
    data: [
      {
        label: "Para Pihak",
        value: analysis.pihak.length > 0
          ? analysis.pihak.map((party) => `${party.nama} (${party.peran})`).join(" ↔ ")
          : "Tidak ditemukan",
        source: partiesSource,
        icon: "users",
      },
      {
        label: "Nilai Kontrak",
        value: analysis.nilaiKontrak?.tampilan ?? "Tidak disebutkan",
        source: analysis.nilaiKontrak?.sumber ?? "Tidak ditemukan",
        icon: "wallet",
      },
      {
        label: "Tanggal Mulai",
        value: analysis.tanggalMulai?.tampilan ?? "Tidak disebutkan",
        source: analysis.tanggalMulai?.sumber ?? "Tidak ditemukan",
        icon: "calendar",
      },
      {
        label: "Jatuh Tempo",
        value: analysis.tanggalJatuhTempo?.tampilan ?? "Tidak disebutkan",
        source: analysis.tanggalJatuhTempo?.sumber ?? "Tidak ditemukan",
        icon: "clock",
      },
      {
        label: "Durasi",
        value: analysis.durasi?.tampilan ?? "Tidak disebutkan",
        source: analysis.durasi?.sumber ?? "Tidak ditemukan",
        icon: "timer",
      },
    ],
    penalties: analysis.penalti.map((penalty) => ({
      trigger: penalty.pemicu,
      consequence: penalty.konsekuensi,
      source: penalty.sumber,
    })),
    risks: analysis.klausulWaspada.map((clause) => ({
      title: clause.judul,
      severity: clause.tingkat,
      reason: clause.alasan,
      quote: stripLineMarkers(clause.kutipan),
      source: clause.sumber,
    })),
    actions: analysis.tindakanDisarankan.map((action) => ({
      text: action.tindakan,
      source: action.sumber ?? undefined,
    })),
  };
}
