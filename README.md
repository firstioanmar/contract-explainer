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
| `OPENROUTER_API_KEY` | Ya | — | API key server-side dari OpenRouter. Jangan pernah pakai prefix `NEXT_PUBLIC_`. |
| `OPENROUTER_MODEL` | Tidak | `openai/gpt-4.1-mini` | Model utama untuk analisis dokumen pendek; harus mendukung JSON Schema / structured outputs. |
| `OPENROUTER_FALLBACK_MODELS` | Tidak | Tiga model berbiaya rendah | Override daftar sampai tiga model cadangan, pisahkan dengan koma. |
| `OPENROUTER_MODEL_INPUT_USD_PER_MTOK` / `OPENROUTER_MODEL_OUTPUT_USD_PER_MTOK` | Tidak | Harga model yang dikenal | Wajib diisi bersama jika memakai model utama kustom yang belum memiliki harga tercatat dan ingin memasukkannya ke router dokumen panjang. |
| `AUTH_SECRET` | Production | fallback API key hanya saat lokal | Rahasia panjang khusus untuk menandatangani cookie sesi. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Tidak | Client ID KontrakJelas | OAuth client untuk Google Identity Services. |
| `PAID_FALLBACK_TIER` | Tidak | `andal` | Sejauh mana lapis berbayar menebus kegagalan lapis gratis: `none`, `murah`, atau `andal`. |
| `ANALYSIS_TIME_BUDGET_SECONDS` | Tidak | `240` | Deadline dokumen panjang sebelum batas Vercel Fluid Compute. |
| `SHORT_ANALYSIS_TIME_BUDGET_SECONDS` | Tidak | `90` | Deadline untuk analisis dokumen pendek. |
| `PER_MODEL_TIMEOUT_SECONDS` | Tidak | `70` | Batas waktu satu model per bagian, agar model yang menggantung tidak memakan jatah model cadangan. |
| `MAX_FREE_ATTEMPTS_PER_CHUNK` | Tidak | `0` | Berapa model gratis yang dicoba per bagian sebelum turun ke lapis berbayar. Gunakan `0` untuk langsung memakai model berbayar pada dokumen panjang. |
| `EVALUATION_REQUEST_TIMEOUT_SECONDS` | Tidak | `45` | Deadline per model saat menjalankan evaluasi. |

Key hanya dibaca oleh Route Handler dan tidak dikirim ke browser. Untuk model multi-tier, lihat [aturan routing OpenRouter dan document-grounding](docs/OPENROUTER_ROUTING_AND_RAG.md). Versi runtime yang didukung: Node.js 24 dan npm 11 atau lebih baru.

Google login juga memerlukan **Authorized JavaScript origins** berikut pada OAuth Client di Google Cloud Console:

- `http://localhost:3000`
- `https://contract-explainer-ai.vercel.app`

## Arsitektur singkat

```text
Teks / PDF teks / DOCX → validasi client + server → ekstraksi file
         → POST /api/analyze → rate limit per-IP
         → dokumen pendek: OPENROUTER_MODEL + hingga 3 model cadangan OpenRouter
         → dokumen panjang: chunk global + overlap + tier model berbiaya
         → Output.object(Zod) → metadata kelengkapan → validasi objek final
```

`AnalyzerWorkspace` hanya menangani komposisi halaman. State input, lifecycle streaming, timer progress, error mapping, dan reset dikelola oleh `useContractAnalyzer`; validasi serta transformasi hasil tetap berupa fungsi pure di `lib/`.

Alur model dan strategi document-grounding lengkap dijelaskan di [docs/OPENROUTER_ROUTING_AND_RAG.md](docs/OPENROUTER_ROUTING_AND_RAG.md).

Endpoint menerima JSON `{ "text": "..." }`. Respons berupa teks JSON yang dikonsumsi `useObject`; analisis pendek menunggu objek lengkap sebelum mengembalikan HTTP 200 agar kegagalan provider bisa dikirim sebagai status dan pesan yang jelas, bukan respons kosong. Maksimal lima analisis per IP per menit. In-memory limiter ini sesuai untuk demo satu instance; produksi multi-instance sebaiknya memakai Vercel KV/Upstash.

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

Evaluasi ini membutuhkan `OPENROUTER_API_KEY` dan menguji setiap model dalam daftar aktif satu per satu, termasuk lapis berbayar. Biayanya dicetak di akhir laporan dan berada di kisaran sen. Set `PAID_FALLBACK_TIER=none` bila ingin mengevaluasi lapis gratis saja.

Ketahanan terhadap prompt injection diuji terpisah:

```bash
npm run eval:injection                            # model pintu masuk produksi
npm run eval:injection -- --all                   # seluruh daftar model
npm run eval:injection -- --models=gemini-2.5-flash-lite
```

Delapan serangan dijalankan atas satu kontrak dasar yang sama, sehingga payload menjadi satu-satunya variabel. Uji ini menanyakan hal yang berbeda dari `eval:contracts`: bukan "apakah model ini layak dipakai", melainkan apakah hasil yang sampai ke pengguna masih jujur ketika dokumen berisi perintah. Hasil, temuan, dan mitigasinya ada di [docs/UJI-PROMPT-INJECTION.md](docs/UJI-PROMPT-INJECTION.md).

Evaluasi keluar dengan status gagal bila ada model yang tidak lolos satu pun kasus uji. Model seperti itu menempati slot di rantai tanpa pernah menghasilkan apa pun, dan pada dokumen panjang ia hanya memakan anggaran waktu bagian tersebut.

### Evaluasi terjadwal

`.github/workflows/eval-models.yml` menjalankan evaluasi ini setiap Senin 02:00 UTC, juga bisa dipicu manual lewat tab Actions. Ketersediaan model gratis di OpenRouter berubah menurut beban dan kebijakan penyedia, jadi urutan di `lib/ai/models.ts` bisa basi tanpa ada satu baris kode pun yang berubah — jadwal ini yang menemukannya, bukan laporan pengguna.

Saat ada model yang gagal seluruh kasus, workflow membuka satu isu dan menambahkan komentar pada isu yang sama di run berikutnya, alih-alih menumpuk isu baru tiap minggu. Log dan `eval-report.json` selalu tersimpan sebagai artifact selama 90 hari.

Aktifkan dengan menambahkan API key sebagai secret repo:

```bash
gh secret set OPENROUTER_API_KEY
```

Catatan: GitHub menonaktifkan workflow terjadwal pada repo yang tidak ada aktivitas selama 60 hari. Bila repo sedang menganggur, jadwalnya perlu diaktifkan kembali dari tab Actions.

## Rantai model

Analisis tidak bergantung pada satu model. Dokumen pendek memakai `OPENROUTER_MODEL` terlebih dahulu, sementara setiap bagian dokumen panjang memakai tier model berbiaya sampai ada yang berhasil:

| Lapis | Model | Kapan dipakai | Biaya per bagian |
|---|---|---|---:|
| Gratis | `gemma-4-26b`, `nemotron-3-super`, `openrouter/free`, `nemotron-nano-9b` | Selalu dicoba lebih dulu, urutan dirotasi per bagian dokumen | $0 |
| Murah | `gemini-2.5-flash-lite`, `llama-3.3-70b`, `mistral-small-3.2` | Seluruh model gratis pada giliran itu gagal | ~$0,0006 |
| Andal | `gemini-3.1-flash-lite` | Hanya bila `PAID_FALLBACK_TIER=andal` | ~$0,0016 |

Rotasi lapis gratis membuat beban tersebar dan tidak ada satu model yang selalu menjadi pintu masuk. Lapis berbayar tidak dirotasi karena tugasnya bukan berbagi beban melainkan menyelamatkan bagian yang gagal secepat mungkin di sisa anggaran waktu. Setiap model dalam rantai mendukung structured output, sehingga schema Zod yang sama berlaku di semua lapis.

Tiap bagian hanya mencoba dua model gratis (`MAX_FREE_ATTEMPTS_PER_CHUNK`), bukan seluruhnya. Mencoba keempatnya menghabiskan sekitar 200 detik dari anggaran 240 detik pada pengukuran nyata, sehingga dokumen dengan beberapa bagian pasti kehabisan waktu. Karena titik awal rotasi bergeser per bagian, keempat model gratis tetap kebagian giliran lintas bagian.

Jalur dokumen pendek adalah pengecualian: hasilnya dialirkan token demi token, dan aliran yang sudah terkirim tidak bisa ditarik kembali. Pergantian model oleh OpenRouter hanya menyala pada galat penyedia, sedangkan keluaran di luar schema baru ketahuan setelah aliran selesai — jadi jalur ini tidak punya kesempatan kedua. Karena itu dokumen pendek dipimpin `gemini-2.5-flash-lite` yang terukur patuh schema dan selesai sekitar 4 detik, dengan biaya ~$0,0006 sekali analisis. Lapis gratis tetap melayani dokumen panjang, tempat kegagalan masih bisa ditebus per bagian.

Isi kedua lapis ditentukan oleh pengukuran, bukan daftar harga atau ukuran model. Beberapa yang tampak menarik di atas kertas dicoret karena gagal pada beban nyata: `gpt-oss-20b:free` gagal di seluruh percobaan padahal sebelumnya menjadi model utama, `qwen3.5-flash` menolak permintaan berschema, `glm-4.7-flash` mengirim keluaran yang tidak dapat diurai, `gpt-5-nano` habis token tanpa menghasilkan objek, dan `gpt-oss-120b` butuh sekitar 80 detik meski lulus.

Tingkat keberhasilan lapis gratis yang terukur: `gemma-4-26b` 3/3, `nemotron-3-super` 2/3, `openrouter/free` 2/3, `nemotron-nano-9b` 1/3, masing-masing 24–64 detik per bagian. Lapis gratis menukar waktu dengan biaya; lapis murah menyelesaikan bagian yang sama dalam 4–17 detik. Ukur ulang dengan `npm run eval:contracts` sebelum menambah atau menukar model.

Setiap model punya batas waktu sendiri (`PER_MODEL_TIMEOUT_SECONDS`). Tanpa itu, satu model gratis yang menggantung menghabiskan seluruh anggaran waktu dan rantai cadangan tidak pernah sempat berjalan.

Log server mencatat berapa bagian yang harus ditebus lapis berbayar beserta perkiraan biayanya. Angka itu adalah ukuran kesehatan lapis gratis: bila terus naik, urutan model perlu ditinjau ulang.

Laporan PDF contoh dapat dibuat dengan:

```bash
npm run verify:pdf
```

## Status fitur

- Streaming structured output untuk input teks, PDF berbasis teks, dan DOCX: tersedia.
- Penolakan non-kontrak: validasi lokal dan klasifikasi model-side.
- Prompt injection: aturan prompt khusus instruksi yang menyamar sebagai koreksi data, detektor deterministik yang memperingatkan pengguna beserta nomor barisnya, dan pembersihan hasil yang ditolak. Model utama menahan 8/8 serangan pada uji terakhir; lapis gratis belum diukur ulang.
- Upload: ekstensi, MIME, ukuran 4 MB, signature file, dan rate limit diverifikasi sebelum ekstraksi. Batas 4 MB menyisakan ruang dari limit request Vercel 4,5 MB. PDF scan/foto belum didukung karena OCR belum tersedia.
- Analisis panjang: hasil yang kehilangan bagian diberi peringatan di UI dan PDF; hasil yang kehabisan waktu tidak ditampilkan sebagai analisis lengkap.
- Login Google: token Google diverifikasi server-side dan sesi disimpan dalam cookie HTTP-only.
- Hasil tersimpan: maksimal 20 hasil di local storage per akun/perangkat, dengan unduhan PDF.
- Modal privasi dan ketentuan: tersedia dari input panel dan footer.
- Disclaimer: hasil membantu pemahaman awal dan bukan nasihat hukum.
- Deployment production: tersedia di `contract-explainer-ai.vercel.app`.

Detail progres tersedia di [Log Fase 1](docs/FASE-1.md).
