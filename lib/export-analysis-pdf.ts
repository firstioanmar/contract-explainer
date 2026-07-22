import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ContractResult } from "@/lib/contract-types";

function pdfText(value: string) {
  return value
    .replaceAll("↔", "<->")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "analisis-kontrak";
}

export function createAnalysisPdf(result: ContractResult) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(91, 67, 210);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("KontrakJelas", margin, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Laporan analisis kontrak dalam bahasa awam", margin, 20);

  doc.setTextColor(25, 30, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(pdfText(result.title), margin, 42, { maxWidth: contentWidth - 35 });
  const attentionColors = {
    Tinggi: { background: [255, 231, 235], foreground: [190, 24, 55] },
    Sedang: { background: [255, 247, 224], foreground: [161, 98, 7] },
    Rendah: { background: [220, 252, 231], foreground: [21, 128, 61] },
  } as const;
  const attentionColor = attentionColors[result.attention];
  doc.setFillColor(attentionColor.background[0], attentionColor.background[1], attentionColor.background[2]);
  doc.roundedRect(pageWidth - margin - 30, 35, 30, 9, 3, 3, "F");
  doc.setTextColor(attentionColor.foreground[0], attentionColor.foreground[1], attentionColor.foreground[2]);
  doc.setFontSize(8);
  doc.text(pdfText(result.attention), pageWidth - margin - 15, 40.5, { align: "center" });

  doc.setTextColor(25, 30, 45);
  doc.setFontSize(11);
  doc.text("Ringkasan", margin, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const summaryLines = doc.splitTextToSize(pdfText(result.summary), contentWidth);
  doc.text(summaryLines, margin, 61, { lineHeightFactor: 1.45 });
  let cursorY = 61 + summaryLines.length * 5.2 + 5;

  autoTable(doc, {
    startY: cursorY,
    head: [["Data penting", "Nilai", "Sumber"]],
    body: result.data.map((item) => [pdfText(item.label), pdfText(item.value), pdfText(item.source)]),
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: { fillColor: [91, 67, 210], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5, textColor: [45, 52, 70] },
    columnStyles: { 0: { cellWidth: 34 }, 2: { cellWidth: 28 } },
  });
  cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (result.penalties.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [["Penalti", "Konsekuensi", "Sumber"]],
      body: result.penalties.map((item) => [pdfText(item.trigger), pdfText(item.consequence), pdfText(item.source)]),
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: { 2: { cellWidth: 28 } },
    });
    cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (result.risks.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [["Klausul waspada", "Tingkat", "Alasan", "Sumber"]],
      body: result.risks.map((item) => [pdfText(item.title), item.severity, pdfText(item.reason), pdfText(item.source)]),
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: { fillColor: [225, 29, 72], textColor: 255, fontSize: 8.5 },
      bodyStyles: { fontSize: 7.6, cellPadding: 2.4 },
      columnStyles: { 1: { cellWidth: 18 }, 3: { cellWidth: 25 } },
    });
    cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  autoTable(doc, {
    startY: cursorY,
    head: [["Tindakan yang disarankan", "Sumber"]],
    body: result.actions.map((item, index) => [`${index + 1}. ${pdfText(item.text)}`, pdfText(item.source ?? "-")]),
    margin: { left: margin, right: margin },
    theme: "plain",
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 1: { cellWidth: 28 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(224, 228, 236);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(105, 113, 130);
    doc.text("Hasil AI untuk pemahaman awal - bukan nasihat hukum.", margin, pageHeight - 8);
    doc.text(`Halaman ${page} dari ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }

  return doc;
}

export function downloadAnalysisPdf(result: ContractResult) {
  createAnalysisPdf(result).save(`kontrakjelas-${slugify(result.title)}.pdf`);
}
