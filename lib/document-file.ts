export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARACTERS = 60_000;

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
    return { valid: false, reason: "Ukuran file melebihi batas 10 MB." };
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

