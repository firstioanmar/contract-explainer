# KontrakJelas

Workspace SaaS sederhana untuk mengubah kontrak atau invoice menjadi ringkasan bahasa Indonesia awam, data terstruktur, penalti, klausul yang perlu diwaspadai, dan tindakan berikutnya.

Portfolio project by [firstioanmar](https://github.com/firstioanmar).

**Live:** https://contract-explainer-ai.vercel.app

## Quick start

```bash
npm install
Copy-Item .env.example .env.local
# Isi OPENROUTER_API_KEY di .env.local
npm run dev
```

Buka `http://localhost:3000`, pilih **Gunakan Contoh**, centang persetujuan, lalu klik **Jelaskan Kontrak**.

## Konfigurasi

| Variabel | Wajib | Default | Keterangan |
|---|---:|---|---|
| `OPENROUTER_API_KEY` | Ya | — | API key server-side dari OpenRouter. |
| `AUTH_SECRET` | Production | fallback API key hanya saat lokal | Rahasia panjang khusus untuk menandatangani cookie sesi. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Tidak | Client ID KontrakJelas | OAuth client untuk Google Identity Services. |
| `ANALYSIS_TIME_BUDGET_SECONDS` | Tidak | `240` | Deadline dokumen panjang sebelum batas Vercel Fluid Compute. |
| `SHORT_ANALYSIS_TIME_BUDGET_SECONDS` | Tidak | `90` | Deadline untuk streaming dokumen pendek. |
| `EVALUATION_REQUEST_TIMEOUT_SECONDS` | Tidak | `45` | Deadline per model saat menjalankan evaluasi. |

Key hanya dibaca oleh Route Handler dan tidak dikirim ke browser.

Google login juga memerlukan **Authorized JavaScript origins** berikut pada OAuth Client di Google Cloud Console:

- `http://localhost:3000`
- `https://contract-explainer-ai.vercel.app`

## Arsitektur singkat

```text
Teks / PDF teks / DOCX → validasi client + server → ekstraksi file
         → POST /api/analyze → rate limit per-IP
         → OpenRouter + 4 model gratis + timeout dan fallback
         → streamText/analisis per bagian + Output.object(Zod)
         → metadata kelengkapan → card/tabel bertahap → validasi objek final
```

`AnalyzerWorkspace` hanya menangani komposisi halaman. State input, lifecycle streaming, timer progress, error mapping, dan reset dikelola oleh `useContractAnalyzer`; validasi serta transformasi hasil tetap berupa fungsi pure di `lib/`.

Endpoint menerima JSON `{ "text": "..." }`. Respons berupa text stream JSON parsial yang dikonsumsi `useObject`. Maksimal lima analisis per IP per menit. In-memory limiter ini sesuai untuk demo satu instance; produksi multi-instance sebaiknya memakai Vercel KV/Upstash.

## Quality checks

```bash
npm test
npm run lint
npm run build
```

Evaluasi model dengan tiga format dokumen dan satu input non-kontrak:

```bash
npm run eval:contracts
```

Evaluasi ini membutuhkan `OPENROUTER_API_KEY`, tetapi seluruh model dalam daftar fallback memakai suffix `:free` atau router gratis. Ketersediaan dan antrean tetap mengikuti OpenRouter.

Laporan PDF contoh dapat dibuat dengan:

```bash
npm run verify:pdf
```

## Status fitur

- Streaming structured output untuk input teks, PDF berbasis teks, dan DOCX: tersedia.
- Penolakan non-kontrak: validasi lokal dan klasifikasi model-side.
- Upload: ekstensi, MIME, ukuran 4 MB, signature file, dan rate limit diverifikasi sebelum ekstraksi. Batas 4 MB menyisakan ruang dari limit request Vercel 4,5 MB. PDF scan/foto belum didukung karena OCR belum tersedia.
- Analisis panjang: hasil yang kehilangan bagian diberi peringatan di UI dan PDF; hasil yang kehabisan waktu tidak ditampilkan sebagai analisis lengkap.
- Login Google: token Google diverifikasi server-side dan sesi disimpan dalam cookie HTTP-only.
- Hasil tersimpan: maksimal 20 hasil di local storage per akun/perangkat, dengan unduhan PDF.
- Modal privasi dan ketentuan: tersedia dari input panel dan footer.
- Disclaimer: hasil membantu pemahaman awal dan bukan nasihat hukum.
- Deployment production: tersedia di `contract-explainer-ai.vercel.app`.

Detail progres tersedia di [Log Fase 1](docs/FASE-1.md).
