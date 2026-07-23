import { CHUNK_BUDGET_CHARS, CHUNK_OVERLAP_LINES } from "@/lib/ai/models";

export type DocumentChunk = {
  /** Nomor bagian, mulai dari 1. */
  index: number;
  /** Total bagian dokumen. */
  total: number;
  /** Nomor baris global pertama pada bagian ini, mulai dari 1. */
  startLine: number;
  /** Nomor baris global terakhir pada bagian ini. */
  endLine: number;
  text: string;
};

/**
 * Memecah baris yang lebih panjang dari anggaran agar satu baris tidak pernah
 * membuat satu bagian melebihi batas. Terjadi pada PDF yang seluruh halamannya
 * terbaca sebagai satu baris.
 */
function splitLongLines(lines: string[], budget: number) {
  const result: string[] = [];

  for (const line of lines) {
    if (line.length <= budget) {
      result.push(line);
      continue;
    }

    for (let offset = 0; offset < line.length; offset += budget) {
      result.push(line.slice(offset, offset + budget));
    }
  }

  return result;
}

/**
 * Memecah dokumen menjadi beberapa bagian yang saling tumpang tindih.
 *
 * Nomor baris yang dilaporkan selalu nomor global, bukan nomor di dalam bagian,
 * sehingga sumber seperti "Baris 214" tetap benar setelah hasil semua bagian
 * digabungkan. Tumpang tindih beberapa baris menjaga klausul yang kebetulan
 * terpotong di batas bagian tetap terbaca utuh oleh salah satu bagian.
 */
export function splitDocument(
  text: string,
  budget = CHUNK_BUDGET_CHARS,
  overlap = CHUNK_OVERLAP_LINES,
): DocumentChunk[] {
  const lines = splitLongLines(text.split("\n"), budget);

  if (text.length <= budget) {
    return [{ index: 1, total: 1, startLine: 1, endLine: lines.length, text }];
  }

  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;

  while (start < lines.length) {
    let end = start;
    let size = 0;

    while (end < lines.length) {
      const nextSize = size + lines[end].length + 1;
      if (end > start && nextSize > budget) break;
      size = nextSize;
      end += 1;
    }

    ranges.push({ start, end });

    if (end >= lines.length) break;
    // Mundur beberapa baris agar bagian berikutnya memuat ekor bagian ini.
    start = Math.max(end - overlap, start + 1);
  }

  return ranges.map((range, position) => ({
    index: position + 1,
    total: ranges.length,
    startLine: range.start + 1,
    endLine: range.end,
    text: lines.slice(range.start, range.end).join("\n"),
  }));
}
