import assert from "node:assert/strict";
import test from "node:test";
import { hasValidFileSignature, MAX_DOCUMENT_BYTES, validateDocumentFile } from "../lib/document-file";

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

