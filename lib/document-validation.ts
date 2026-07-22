const documentSignals = [
  "perjanjian",
  "kontrak",
  "pasal",
  "invoice",
  "faktur",
  "pembayaran",
  "para pihak",
  "jatuh tempo",
  "penyedia",
  "pemberi kerja",
  "penerima kerja",
];

export type LocalValidation =
  | { valid: true }
  | { valid: false; reason: string };

export function validateDocumentInput(text: string): LocalValidation {
  const normalized = text.trim().toLowerCase();

  if (normalized.length < 80) {
    return {
      valid: false,
      reason: normalized.length === 0
        ? "Tempelkan isi kontrak atau gunakan contoh yang kami sediakan."
        : "Teks terlalu singkat. Masukkan bagian kontrak yang lebih lengkap agar hasilnya akurat.",
    };
  }

  if (!documentSignals.some((signal) => normalized.includes(signal))) {
    return {
      valid: false,
      reason: "Teks ini tampaknya bukan kontrak atau invoice. Periksa kembali dokumen lalu coba lagi.",
    };
  }

  return { valid: true };
}
