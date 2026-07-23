export type AnalysisModel = {
  /** Id model di OpenRouter. */
  id: string;
  /** Nama pendek untuk log dan telemetri. */
  label: string;
};

/**
 * Urutan daftar ini adalah urutan prioritas. Router mencoba model pertama,
 * lalu menurun ke model berikutnya bila gagal. Untuk dokumen panjang, setiap
 * bagian dokumen memulai dari titik yang berbeda di daftar ini agar beban
 * tersebar dan seluruh model benar-benar terpakai.
 */
export const ANALYSIS_MODELS: readonly AnalysisModel[] = [
  { id: "openai/gpt-oss-20b:free", label: "gpt-oss-20b" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "gemma-4-26b" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "nemotron-3-super" },
  { id: "openrouter/free", label: "openrouter-free" },
] as const;

export const FREE_ANALYSIS_MODELS = ANALYSIS_MODELS.map((model) => model.id);
export const PRIMARY_ANALYSIS_MODEL = FREE_ANALYSIS_MODELS[0];
export const FALLBACK_ANALYSIS_MODELS = FREE_ANALYSIS_MODELS.slice(1);

/**
 * Anggaran karakter dokumen untuk satu permintaan. Dipasang konservatif agar
 * aman di seluruh model gratis pada daftar di atas; model kecil kehilangan
 * akurasi jauh sebelum jendela konteksnya benar-benar penuh.
 */
export const CHUNK_BUDGET_CHARS = 18_000;

/** Jumlah baris yang diulang di awal bagian berikutnya agar klausul yang terpotong tetap terbaca utuh. */
export const CHUNK_OVERLAP_LINES = 6;

export const MAX_OUTPUT_TOKENS = 3_500;

/**
 * Anggaran waktu untuk menuntaskan analisis dokumen panjang. Sengaja dipasang
 * lebih kecil daripada batas waktu platform, supaya server sempat mengirim
 * pesan yang jujur sebelum fungsi dimatikan paksa oleh platform.
 *
 * Setel ANALYSIS_TIME_BUDGET_SECONDS sesuai batas hosting:
 * - Vercel Hobby (batas 60 detik): biarkan default 52.
 * - Vercel Pro (batas 300 detik): setel 290 agar dokumen besar sempat selesai.
 */
export const ANALYSIS_TIME_BUDGET_MS = Math.max(
  15_000,
  (Number(process.env.ANALYSIS_TIME_BUDGET_SECONDS) || 52) * 1_000,
);

/** Daftar model yang dicoba untuk satu bagian dokumen, dimulai dari offset tertentu. */
export function modelRotation(offset: number): AnalysisModel[] {
  const size = ANALYSIS_MODELS.length;
  const start = ((offset % size) + size) % size;
  return Array.from({ length: size }, (_, step) => ANALYSIS_MODELS[(start + step) % size]);
}
