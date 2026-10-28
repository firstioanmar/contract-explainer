export type ModelTier = "gratis" | "murah" | "andal";

export type AnalysisModel = {
  /** Id model di OpenRouter. */
  id: string;
  /** Nama pendek untuk log dan telemetri. */
  label: string;
  /** Lapis biaya. Menentukan kapan model boleh dipakai dan bagaimana dicatat. */
  tier: ModelTier;
  /** Harga OpenRouter per 1 juta token, untuk perkiraan biaya di log. */
  usdPerMTok: { in: number; out: number };
};

/**
 * Lapis pertama: seluruhnya gratis. Model gratis sering antre, kena batas
 * harian, atau mengembalikan keluaran yang tidak sesuai schema, jadi daftar ini
 * dipakai bergiliran agar tidak ada satu model yang menanggung semua beban.
 *
 * Hanya model yang mendukung structured_outputs yang masuk daftar; analisis ini
 * selalu meminta objek berschema, dan model tanpa dukungan itu hampir selalu
 * gagal di tahap validasi.
 *
 * Urutan mengikuti tingkat keberhasilan yang terukur pada fixture kontrak, bukan
 * ukuran model. `openai/gpt-oss-20b:free` dicoret setelah gagal pada seluruh
 * percobaan — menggantung sampai batas waktu atau mengirim keluaran di luar
 * schema — padahal sebelumnya menjadi model utama.
 *
 * Angka terukur: gemma-4-26b 3/3, nemotron-3-super 2/3, openrouter-free 2/3,
 * nemotron-nano-9b 1/3. Seluruhnya lambat, 24 sampai 64 detik per bagian, jadi
 * lapis ini menghemat biaya dengan menukarnya dengan waktu.
 */
export const FREE_MODELS: readonly AnalysisModel[] = [
  { id: "google/gemma-4-26b-a4b-it:free", label: "gemma-4-26b", tier: "gratis", usdPerMTok: { in: 0, out: 0 } },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "nemotron-3-super", tier: "gratis", usdPerMTok: { in: 0, out: 0 } },
  { id: "openrouter/free", label: "openrouter-free", tier: "gratis", usdPerMTok: { in: 0, out: 0 } },
  { id: "nvidia/nemotron-nano-9b-v2:free", label: "nemotron-nano-9b", tier: "gratis", usdPerMTok: { in: 0, out: 0 } },
] as const;

/**
 * Lapis kedua: berbayar, tetapi biayanya hampir tidak terasa. Pada fixture
 * kontrak nyata, satu bagian dokumen menghabiskan sekitar USD 0,0005 sampai
 * 0,0006 — di bawah Rp 10 per bagian. Lapis ini hanya tersentuh ketika seluruh
 * model gratis pada giliran itu gagal, jadi tagihan mengikuti tingkat kegagalan
 * lapis gratis, bukan jumlah analisis.
 *
 * Daftar ini hasil pengukuran, bukan katalog harga. Beberapa model yang lebih
 * murah di atas kertas dicoret karena tidak layak dipakai di sini:
 * `qwen/qwen3.5-flash` menolak permintaan berschema lewat penyedianya,
 * `z-ai/glm-4.7-flash` mengembalikan keluaran yang tidak dapat diurai,
 * `openai/gpt-5-nano` menghabiskan anggaran token tanpa menghasilkan objek, dan
 * `openai/gpt-oss-120b` walau lulus butuh sekitar 80 detik — terlalu lambat
 * untuk model yang tugasnya menyelamatkan bagian di sisa anggaran waktu.
 *
 * Urutan mengikuti kecepatan, bukan harga, karena selisih harganya tipis
 * sedangkan selisih waktunya menentukan bagian itu selesai atau tidak. Ketiga
 * model berasal dari penyedia berbeda supaya gangguan pada satu penyedia tidak
 * menjatuhkan seluruh lapis.
 */
export const CHEAP_MODELS: readonly AnalysisModel[] = [
  { id: "google/gemini-2.5-flash-lite", label: "gemini-2.5-flash-lite", tier: "murah", usdPerMTok: { in: 0.1, out: 0.4 } },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "llama-3.3-70b", tier: "murah", usdPerMTok: { in: 0.13, out: 0.4 } },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "mistral-small-3.2", tier: "murah", usdPerMTok: { in: 0.1, out: 0.3 } },
] as const;

/**
 * Lapis terakhir: dipakai hanya bila dua lapis di atas menyerah. Sekitar USD
 * 0,0016 per bagian dan selesai dalam hitungan detik, dengan kepatuhan schema
 * dan bahasa Indonesia yang paling stabil di antara seluruh daftar. Lapis ini
 * yang menjaga agar pengguna tidak pernah melihat "semua model gagal".
 */
export const RELIABLE_MODELS: readonly AnalysisModel[] = [
  { id: "google/gemini-3.1-flash-lite", label: "gemini-3.1-flash-lite", tier: "andal", usdPerMTok: { in: 0.25, out: 1.5 } },
] as const;

/**
 * Sejauh mana lapis berbayar boleh dipakai:
 * - `none`  : gratis saja. Perilaku lama; dokumen bisa gagal saat lapis gratis sibuk.
 * - `murah` : gratis lalu lapis murah. Default, karena biayanya hampir nol.
 * - `andal` : ditambah lapis terakhir. Dipakai bila keberhasilan lebih penting daripada biaya.
 */
/**
 * Model selection for short document analysis.
 * OPENROUTER_MODEL wins when configured; the known-good list remains the fallback.
 */
const OPENROUTER_MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;

function normalizeModelId(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate && OPENROUTER_MODEL_ID_PATTERN.test(candidate) ? candidate : undefined;
}

const RAW_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL?.trim();
export const OPENROUTER_MODEL_CONFIG_ERROR = RAW_OPENROUTER_MODEL && !normalizeModelId(RAW_OPENROUTER_MODEL)
  ? "OPENROUTER_MODEL harus memakai format provider/model yang valid."
  : undefined;
export const CONFIGURED_OPENROUTER_MODEL = normalizeModelId(RAW_OPENROUTER_MODEL);

function configuredPrimaryModelEntry(): AnalysisModel | null {
  const id = CONFIGURED_OPENROUTER_MODEL;
  if (!id) return null;

  const existing = [...FREE_MODELS, ...CHEAP_MODELS, ...RELIABLE_MODELS];
  if (existing.some((model) => model.id === id)) return null;

  // Known prices for the documented default. For other custom models, require
  // explicit prices before using them in long-document routes with cost logging.
  const knownPrices: Record<string, { in: number; out: number }> = {
    "openai/gpt-4.1-mini": { in: 0.4, out: 1.6 },
  };
  const inputPrice = process.env.OPENROUTER_MODEL_INPUT_USD_PER_MTOK?.trim();
  const outputPrice = process.env.OPENROUTER_MODEL_OUTPUT_USD_PER_MTOK?.trim();
  const explicitPrices = inputPrice && outputPrice
    ? { in: Number(inputPrice), out: Number(outputPrice) }
    : undefined;
  const validExplicitPrices = explicitPrices
    && Number.isFinite(explicitPrices.in) && explicitPrices.in >= 0
    && Number.isFinite(explicitPrices.out) && explicitPrices.out >= 0
    ? explicitPrices
    : undefined;
  const prices = knownPrices[id] ?? validExplicitPrices;

  if (!prices) return null;

  return {
    id,
    label: id.split("/").at(-1) ?? id,
    tier: "andal",
    usdPerMTok: prices,
  };
}

const CONFIGURED_PRIMARY_MODEL_ENTRY = configuredPrimaryModelEntry();

function resolvePaidTier(): ModelTier | "none" {
  const raw = process.env.PAID_FALLBACK_TIER?.trim().toLowerCase();
  if (raw === "none" || raw === "murah" || raw === "andal") return raw;
  return "murah";
}

export const PAID_FALLBACK_TIER = resolvePaidTier();

/** Berbayar murah lebih dulu; opsi andal dipakai hanya pada tier andal. */
export const PAID_MODELS: readonly AnalysisModel[] = (() => {
  if (PAID_FALLBACK_TIER === "none") return [];

  const candidates = PAID_FALLBACK_TIER === "murah"
    ? [...CHEAP_MODELS, ...(CONFIGURED_PRIMARY_MODEL_ENTRY ? [CONFIGURED_PRIMARY_MODEL_ENTRY] : [])]
    : [...CHEAP_MODELS, ...RELIABLE_MODELS, ...(CONFIGURED_PRIMARY_MODEL_ENTRY ? [CONFIGURED_PRIMARY_MODEL_ENTRY] : [])];

  return candidates.filter((model, index) => candidates.findIndex((candidate) => candidate.id === model.id) === index);
})();

/** Daftar model aktif untuk evaluasi. */
export const ANALYSIS_MODELS: readonly AnalysisModel[] = [...FREE_MODELS, ...PAID_MODELS];

export const FREE_ANALYSIS_MODELS = FREE_MODELS.map((model) => model.id);
export const PAID_ANALYSIS_MODELS = PAID_MODELS.map((model) => model.id);

/**
 * For short documents, the explicit environment model is primary.
 * For long documents, modelRotation still uses the low-cost policy and retries.
 */
export const STREAMING_MODELS: readonly AnalysisModel[] =
  PAID_MODELS.length > 0 ? [...PAID_MODELS, ...FREE_MODELS] : FREE_MODELS;

/** OpenRouter accepts at most three model fallbacks in this request shape. */
export const OPENROUTER_MAX_FALLBACK_MODELS = 3;

export const PRIMARY_ANALYSIS_MODEL = CONFIGURED_OPENROUTER_MODEL ?? STREAMING_MODELS[0].id;

function resolveFallbackModelIds(): string[] {
  const configured = process.env.OPENROUTER_FALLBACK_MODELS
    ?.split(",")
    .map((model) => model.trim())
    .filter((model) => model.length > 0) ?? [];
  const defaults = STREAMING_MODELS.map((model) => model.id)
    .filter((id) => id !== PRIMARY_ANALYSIS_MODEL);
  const candidates = [...configured, ...defaults];
  const unique: string[] = [];

  for (const candidate of candidates) {
    if (
      OPENROUTER_MODEL_ID_PATTERN.test(candidate)
      && candidate !== PRIMARY_ANALYSIS_MODEL
      && !unique.includes(candidate)
    ) {
      unique.push(candidate);
    }
    if (unique.length >= OPENROUTER_MAX_FALLBACK_MODELS) break;
  }

  return unique;
}

export const FALLBACK_ANALYSIS_MODELS = resolveFallbackModelIds();

/**
 * Anggaran karakter dokumen untuk satu permintaan. Dipasang konservatif agar
 * aman di seluruh model pada daftar di atas; model kecil kehilangan akurasi
 * jauh sebelum jendela konteksnya benar-benar penuh.
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
 * Vercel Fluid Compute memberi fungsi Node.js hingga 300 detik pada Hobby.
 * Default 240 detik menyisakan waktu untuk serialisasi dan respons error.
 */
export const ANALYSIS_TIME_BUDGET_MS = Math.max(
  30_000,
  Math.min(285_000, (Number(process.env.ANALYSIS_TIME_BUDGET_SECONDS) || 240) * 1_000),
);

/** Dokumen pendek tetap diberi deadline agar model yang antre tidak menggantung tanpa batas. */
export const SHORT_ANALYSIS_TIME_BUDGET_MS = Math.max(
  20_000,
  Math.min(180_000, (Number(process.env.SHORT_ANALYSIS_TIME_BUDGET_SECONDS) || 90) * 1_000),
);

/**
 * Batas waktu satu model untuk satu bagian dokumen.
 *
 * Tanpa batas per model, satu model gratis yang menggantung dapat menghabiskan
 * seluruh anggaran waktu sendirian sehingga rantai cadangan tidak pernah sempat
 * dicoba — rantai yang tidak pernah dijalankan sama saja dengan tidak ada.
 * Pengukuran menunjukkan model gratis yang berhasil selesai dalam 24 sampai 64
 * detik, jadi 70 detik cukup longgar untuk keberhasilan yang wajar sekaligus
 * cukup ketat untuk memotong yang menggantung.
 */
export const PER_MODEL_TIMEOUT_MS = Math.max(
  15_000,
  Math.min(150_000, (Number(process.env.PER_MODEL_TIMEOUT_SECONDS) || 70) * 1_000),
);

/**
 * Berapa banyak model gratis yang boleh dicoba untuk satu bagian sebelum turun
 * ke lapis berbayar.
 *
 * Pengukuran end-to-end menunjukkan mencoba keempat model gratis untuk satu
 * bagian menghabiskan sekitar 200 detik dari anggaran 240 detik, padahal lapis
 * berbayar menuntaskan bagian yang sama dalam hitungan detik. Tanpa batas ini,
 * dokumen dengan beberapa bagian pasti kehabisan waktu — lapis gratis
 * menghemat uang dengan memakan waktu yang tidak dimiliki dokumen panjang.
 *
 * Dua percobaan menjaga penghematan tetap nyata tanpa mempertaruhkan seluruh
 * anggaran. Rotasi tetap membuat keempat model gratis terpakai lintas bagian,
 * jadi beban tetap tersebar meski tiap bagian hanya mencoba dua di antaranya.
 */
export const MAX_FREE_ATTEMPTS_PER_CHUNK = Math.max(
  0,
  Math.min(FREE_MODELS.length, Number(process.env.MAX_FREE_ATTEMPTS_PER_CHUNK ?? 2)),
);

/**
 * Daftar model yang dicoba untuk satu bagian dokumen.
 *
 * Bagian gratis dirotasi per bagian dokumen supaya beban tersebar merata dan
 * tidak ada satu model gratis yang selalu menjadi pintu masuk. Lapis berbayar
 * tidak ikut dirotasi: urutannya tetap dari yang termurah, karena tujuannya
 * menyelamatkan bagian yang gagal dengan biaya sekecil mungkin, bukan berbagi
 * beban.
 */
export function modelRotation(offset: number): AnalysisModel[] {
  const size = FREE_MODELS.length;
  const start = ((offset % size) + size) % size;
  // "none" means free models only. Do not allow a zero paid-attempt setting
  // to accidentally disable every model when the paid tier is explicitly off.
  const freeAttemptLimit = PAID_MODELS.length === 0
    ? FREE_MODELS.length
    : MAX_FREE_ATTEMPTS_PER_CHUNK;
  const rotatedFree = Array.from(
    { length: freeAttemptLimit },
    (_, step) => FREE_MODELS[(start + step) % size],
  );
  return [...rotatedFree, ...PAID_MODELS];
}

/** Perkiraan biaya satu permintaan, untuk log biaya yang jujur alih-alih tebakan. */
export function estimateRequestCostUsd(model: AnalysisModel, inputTokens: number, outputTokens: number) {
  return (inputTokens * model.usdPerMTok.in + outputTokens * model.usdPerMTok.out) / 1_000_000;
}
