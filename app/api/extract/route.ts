import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import {
  hasValidFileSignature,
  INSUFFICIENT_TEXT_GUIDANCE,
  looksLikeScannedPdf,
  MAX_EXTRACTED_CHARACTERS,
  MIN_MEANINGFUL_CHARACTERS,
  normalizeExtractedText,
  SCANNED_PDF_GUIDANCE,
  validateDocumentFile,
  type SupportedDocumentFormat,
} from "@/lib/document-file";
import { validateDocumentInput } from "@/lib/document-validation";

export const runtime = "nodejs";
export const maxDuration = 120;

async function extractPdf(buffer: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  try {
    const result = await extractText(pdf, { mergePages: true });
    return { text: result.text, pages: result.totalPages };
  } finally {
    await pdf.destroy();
  }
}

async function extractDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, pages: null };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Form upload tidak valid." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Pilih satu file PDF atau DOCX." }, { status: 400 });
  }

  const validation = validateDocumentFile(file);
  if (!validation.valid) {
    return Response.json({ error: validation.reason }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasValidFileSignature(buffer.subarray(0, 8), validation.format)) {
    return Response.json({ error: "Signature file tidak sesuai dengan format dokumen." }, { status: 422 });
  }

  try {
    const extracted = validation.format === "pdf"
      ? await extractPdf(buffer)
      : await extractDocx(buffer);
    const normalized = normalizeExtractedText(extracted.text);

    // PDF hasil scan tidak punya lapisan teks (atau nyaris kosong per halaman).
    // Alih-alih meneruskan teks sampah ke model, pandu pengguna ke jalan keluar.
    if (validation.format === "pdf" && looksLikeScannedPdf(normalized.length, extracted.pages)) {
      return Response.json({ error: SCANNED_PDF_GUIDANCE }, { status: 422 });
    }

    if (normalized.length < MIN_MEANINGFUL_CHARACTERS) {
      return Response.json({ error: INSUFFICIENT_TEXT_GUIDANCE }, { status: 422 });
    }

    const localValidation = validateDocumentInput(normalized);
    if (!localValidation.valid) {
      return Response.json({ error: localValidation.reason }, { status: 422 });
    }

    const truncated = normalized.length > MAX_EXTRACTED_CHARACTERS;
    return Response.json({
      text: normalized.slice(0, MAX_EXTRACTED_CHARACTERS),
      format: validation.format as SupportedDocumentFormat,
      pages: extracted.pages,
      warning: truncated ? "Dokumen dipotong pada 60.000 karakter pertama agar analisis tetap stabil." : null,
    });
  } catch (error) {
    console.error("Document extraction failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return Response.json({ error: "Dokumen rusak, terkunci, atau tidak dapat dibaca." }, { status: 422 });
  }
}
