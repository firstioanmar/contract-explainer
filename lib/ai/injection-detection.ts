/**
 * Deteksi teks di dalam dokumen yang berusaha mengarahkan hasil analisis.
 *
 * Uji pada 28 Juli 2026 (docs/UJI-PROMPT-INJECTION.md) menunjukkan pertahanan
 * berbasis prompt menahan serangan yang meminta model melanggar perannya, tetapi
 * tembus pada serangan yang menyamar sebagai koreksi data — "angka itu salah
 * ketik", "klausul ini rahasia". Model tetap merasa sedang patuh mengekstrak
 * fakta; yang berubah hanya fakta mana yang dianggap benar.
 *
 * Modul ini adalah lapis deterministik untuk kelas serangan itu. Ia tidak
 * memutuskan apakah hasilnya benar — itu tidak mungkin dilakukan tanpa membaca
 * dokumen seperti manusia. Yang bisa dipastikan secara deterministik adalah
 * apakah dokumen memuat teks yang berbicara kepada sistem analisis, dan itu
 * sendiri sudah layak diberitahukan kepada pengguna.
 *
 * Sengaja memperingatkan, bukan memblokir. Dokumen yang memuat teks semacam ini
 * bisa saja sah — kontrak tentang perangkat lunak AI wajar menyebut "sistem AI".
 * Menolak menganalisisnya merugikan pengguna yang tidak berbuat salah, sedangkan
 * peringatan yang salah hanya menambah satu kalimat kehati-hatian.
 */

export type InjectionSignal = {
  /** Nomor baris pada dokumen yang sudah dinormalisasi, mulai dari 1. */
  line: number;
  /** Potongan teks yang memicu, dipangkas agar aman ditampilkan. */
  excerpt: string;
  /** Kenapa baris ini mencurigakan, dalam bahasa yang bisa dibaca pengguna. */
  reason: string;
};

type Rule = { pattern: RegExp; reason: string };

const RULES: Rule[] = [
  {
    // Sinyal terkuat dan paling kecil kemungkinan salah tuduhnya: kontrak asli
    // tidak pernah menyebut nama field internal aplikasi ini.
    pattern: /\b(nilaiKontrak|klausulWaspada|tingkatPerhatian|isValidDocument|jenisDokumen|alasanPenolakan|judulDokumen|tindakanDisarankan|temuanUtama|tanggalJatuhTempo|tanggalMulai)\b/,
    reason: "menyebut nama field internal sistem analisis",
  },
  {
    // Teks yang berbicara kepada sistem AI *tentang hasil analisis*. Syarat
    // kedekatan dengan kata bermuatan analisis menekan salah tuduh pada kontrak
    // yang memang membahas perangkat lunak AI.
    pattern: /\b(sistem\s+ai|kecerdasan\s+buatan|asisten\s+ai|model\s+bahasa)\b.{0,100}?\b(wajib|harus|dilarang|jangan)\b.{0,100}?\b(hasil|analisis|laporan|menyatakan|mengosongkan|melaporkan|mengisi|menyebutkan)\b/i,
    reason: "berisi perintah yang ditujukan kepada sistem analisis",
  },
  {
    pattern: /\b(instruksi|catatan|perintah|pesan|nota)\s+(untuk|kepada|bagi)\s+(sistem\s+)?(ai|kecerdasan\s+buatan|asisten|model|llm)\b/i,
    reason: "berisi pesan yang dialamatkan kepada sistem AI",
  },
  {
    pattern: /\babaikan\s+(semua\s+|seluruh\s+)?(instruksi|aturan|perintah|petunjuk|angka|nilai|total|data)\b/i,
    reason: "meminta sistem mengabaikan aturan atau data",
  },
  {
    pattern: /\bkosongkan\s+(array|field|daftar|seluruh|bagian)\b/i,
    reason: "meminta sistem mengosongkan bagian hasil",
  },
  {
    pattern: /\b(dilarang|jangan)\s+(di)?(masukkan|sebutkan|tampilkan|cantumkan)\b.{0,60}?\b(hasil|analisis|laporan)\b/i,
    reason: "meminta sistem menyembunyikan data dari hasil",
  },
  {
    // Serangan "koreksi data" — yang tembus pada uji 28 Juli 2026. Satu kata
    // boleh menyela agar "nilai kontrak yang benar adalah" ikut tertangkap.
    pattern: /\b(nilai|angka|jumlah|total|tanggal)\s+(\w+\s+)?(yang\s+)?(sebenarnya|benar)\s+(adalah|ialah)\b/i,
    reason: "mengklaim data di dokumen salah dan memberi penggantinya",
  },
  {
    pattern: /\bsalah\s+ketik\b/i,
    reason: "mengklaim ada salah ketik yang harus diabaikan",
  },
  {
    pattern: /\b(kamu|anda)\s+(sekarang\s+)?(adalah|bukan\s+lagi)\s+(seorang\s+)?(asisten|ai|model|sistem|analis)\b/i,
    reason: "mencoba mengubah peran sistem analisis",
  },
  {
    pattern: /\b(salin|tulis\s+ulang|tampilkan|bocorkan)\b.{0,40}?\b(instruksi\s+sistem|system\s+prompt|prompt\s+sistem|instruksimu)\b/i,
    reason: "meminta sistem membocorkan instruksinya",
  },
];

/** Memangkas potongan teks agar peringatan tetap pendek dan aman ditampilkan. */
function excerptOf(line: string) {
  const trimmed = line.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed;
}

/**
 * Memeriksa dokumen baris demi baris. Satu baris hanya dilaporkan sekali walau
 * memicu beberapa aturan, supaya peringatan tidak menggandakan baris yang sama.
 */
export function detectInjectionSignals(text: string): InjectionSignal[] {
  const signals: InjectionSignal[] = [];

  text.split("\n").forEach((line, index) => {
    if (line.trim().length === 0) return;

    const rule = RULES.find((candidate) => candidate.pattern.test(line));
    if (rule) {
      signals.push({ line: index + 1, excerpt: excerptOf(line), reason: rule.reason });
    }
  });

  return signals;
}

/**
 * Menyusun peringatan untuk pengguna. Peringatan menyebut nomor baris supaya
 * pengguna bisa memeriksa sendiri, dan mengarahkan pemeriksaan ke data yang
 * paling merugikan bila dipalsukan: nilai, tanggal, dan denda.
 */
export function buildInjectionWarning(signals: InjectionSignal[]): string | null {
  if (signals.length === 0) return null;

  const lines = signals.map((signal) => signal.line);
  const lokasi = lines.length === 1 ? `baris ${lines[0]}` : `baris ${lines.join(", ")}`;

  return `Dokumen ini memuat teks yang menyerupai instruksi kepada sistem analisis (${lokasi}: ${signals[0].reason}). Teks seperti itu dapat dipakai untuk menyembunyikan atau mengubah data pada hasil. Periksa ulang nilai kontrak, tanggal, dan denda langsung pada dokumen aslinya sebelum mengambil keputusan.`;
}
