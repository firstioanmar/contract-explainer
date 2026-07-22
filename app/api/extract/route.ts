import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import {
  hasValidFileSignature,
  MAX_EXTRACTED_CHARACTERS,
  normalizeExtractedText,
  validateDocumentFile,
  type SupportedDocumentFormat,
} from "@/lib/document-file";
import { validateDocumentInput } from "@/lib/document-validation";

export const runtime = "nodejs";
export const maxDuration = 30;

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

    if (normalized.length < 80) {
      return Response.json({
        error: validation.format === "pdf"
          ? "Teks tidak terbaca. PDF hasil scan atau foto belum didukung; gunakan PDF berbasis teks atau DOCX."
          : "Dokumen tidak berisi cukup teks untuk dianalisis.",
      }, { status: 422 });
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
