import assert from "node:assert/strict";
import test from "node:test";
import { hasValidFileSignature, looksLikeScannedPdf, MAX_DOCUMENT_BYTES, validateDocumentFile } from "../lib/document-file";

test("menerima PDF dan DOCX yang sesuai", () => {
  assert.deepEqual(validateDocumentFile({ name: "kontrak.pdf", size: 1024, type: "application/pdf" }), { valid: true, format: "pdf" });
  assert.deepEqual(validateDocumentFile({ name: "invoice.docx", size: 2048, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), { valid: true, format: "docx" });
});

test("menolak ekstensi, MIME, dan ukuran yang tidak valid", () => {
  assert.equal(validateDocumentFile({ name: "kontrak.doc", size: 100, type: "application/msword" }).valid, false);
  assert.equal(validateDocumentFile({ name: "kontrak.pdf", size: 100, type: "image/png" }).valid, false);
  assert.equal(validateDocumentFile({ name: "kontrak.pdf", size: MAX_DOCUMENT_BYTES + 1, type: "application/pdf" }).valid, false);
});

test("memeriksa signature PDF dan ZIP DOCX", () => {
  assert.equal(hasValidFileSignature(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]), "pdf"), true);
  assert.equal(hasValidFileSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), "docx"), true);
  assert.equal(hasValidFileSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), "pdf"), false);
});

test("menandai PDF scan yang kosong atau nyaris tanpa teks per halaman", () => {
  // PDF scan murni: hampir tidak ada teks sama sekali.
  assert.equal(looksLikeScannedPdf(0, 5), true);
  assert.equal(looksLikeScannedPdf(40, 1), true);

  // 20 halaman tetapi hanya menyisakan watermark/metadata: ~15 karakter/halaman.
  assert.equal(looksLikeScannedPdf(300, 20), true);
});

test("tidak menandai PDF berbasis teks yang sehat", () => {
  // Kontrak ringkas satu halaman.
  assert.equal(looksLikeScannedPdf(1_800, 1), false);
  // Kontrak sepuluh halaman dengan isi normal.
  assert.equal(looksLikeScannedPdf(24_000, 10), false);
  // Halaman tidak diketahui (mis. DOCX) tetapi teks memadai.
  assert.equal(looksLikeScannedPdf(5_000, null), false);
});

