// Vercel Functions membatasi seluruh request body 4,5 MB. Batas file dibuat
// 4 MB agar masih tersedia ruang untuk multipart boundary dan metadata form.
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_EXTRACTED_CHARACTERS = 60_000;

/** Di bawah ini teks dianggap terlalu sedikit untuk dianalisis. */
export const MIN_MEANINGFUL_CHARACTERS = 80;

/**
 * Di bawah rata-rata karakter per halaman ini, PDF hampir pasti hasil scan atau
 * foto walau masih ada sisa teks (watermark, metadata, header). Ambang dipasang
 * rendah agar kontrak asli yang ringkas tidak salah ditandai; halaman kontrak
 * berbasis teks selalu jauh di atas angka ini.
 */
const MIN_CHARACTERS_PER_PAGE = 50;

/**
 * Pesan yang menuntun pengguna saat PDF tidak punya lapisan teks. Bukan sekadar
 * menolak: memberi tiga jalan keluar gratis yang bisa langsung ditempuh.
 */
export const SCANNED_PDF_GUIDANCE =
  "PDF ini sepertinya hasil scan atau foto, sehingga tidak ada teks yang bisa dibaca otomatis. Tiga cara mudah: (1) salin dan tempel langsung isi kontraknya ke kolom teks di atas; (2) buka file di Google Docs — teksnya akan dikenali otomatis, lalu salin ke sini; atau (3) simpan ulang sebagai PDF berbasis teks atau DOCX.";

/** Pesan saat dokumen terbaca tetapi isinya tidak cukup untuk dianalisis. */
export const INSUFFICIENT_TEXT_GUIDANCE =
  "Dokumen terbaca tetapi isinya terlalu sedikit untuk dianalisis. Pastikan file memuat teks kontrak, bukan hanya gambar, sampul, atau tabel kosong.";

/**
 * Menandai PDF yang kemungkinan besar hasil scan. Dipisah agar dapat diuji
 * tanpa memproses file PDF sungguhan.
 */
export function looksLikeScannedPdf(textLength: number, pages: number | null): boolean {
  if (textLength < MIN_MEANINGFUL_CHARACTERS) return true;
  if (pages !== null && pages > 1 && textLength / pages < MIN_CHARACTERS_PER_PAGE) return true;
  return false;
}

export const SUPPORTED_DOCUMENT_FORMATS = [
  {
    extension: ".pdf",
    mime: "application/pdf",
    label: "PDF berbasis teks",
  },
  {
    extension: ".docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Microsoft Word (DOCX)",
  },
] as const;

export const SUPPORTED_DOCUMENT_TYPES = [
  "kontrak atau perjanjian",
  "invoice atau faktur",
  "surat perintah kerja (SPK)",
  "purchase order (PO)",
] as const;

export type SupportedDocumentFormat = "pdf" | "docx";

type FileMetadata = Pick<File, "name" | "size" | "type">;

export type FileValidation =
  | { valid: true; format: SupportedDocumentFormat }
  | { valid: false; reason: string };

export function validateDocumentFile(file: FileMetadata): FileValidation {
  const name = file.name.trim().toLowerCase();
  const definition = SUPPORTED_DOCUMENT_FORMATS.find((item) => name.endsWith(item.extension));

  if (!definition) {
    return { valid: false, reason: "Format belum didukung. Pilih file PDF berbasis teks atau DOCX." };
  }

  if (file.size <= 0) {
    return { valid: false, reason: "File kosong dan tidak dapat dianalisis." };
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return { valid: false, reason: "Ukuran file melebihi batas 4 MB." };
  }

  if (file.type && file.type !== definition.mime) {
    return { valid: false, reason: "Isi dan ekstensi file tidak cocok. Pilih dokumen PDF atau DOCX yang valid." };
  }

  return { valid: true, format: definition.extension.slice(1) as SupportedDocumentFormat };
}

export function hasValidFileSignature(bytes: Uint8Array, format: SupportedDocumentFormat) {
  if (format === "pdf") {
    return bytes.length >= 5
      && bytes[0] === 0x25
      && bytes[1] === 0x50
      && bytes[2] === 0x44
      && bytes[3] === 0x46
      && bytes[4] === 0x2d;
  }

  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
    && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);
}

export function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
