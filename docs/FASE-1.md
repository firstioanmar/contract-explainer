# Log Fase 1 — Structured output dan context engineering

## Outcome

KontrakJelas telah berpindah dari prototype mock menjadi workspace AI streaming untuk teks, PDF berbasis teks, dan DOCX. Route Handler memakai OpenRouter melalui Vercel AI SDK, menghasilkan objek parsial selama proses, dan memvalidasi objek final dengan Zod sebelum ditampilkan. Login Google telah diverifikasi server-side; pengguna masuk dapat menyimpan hasil per perangkat dan mengunduh laporan PDF.

## Checklist

- [x] Next.js App Router, TypeScript, Tailwind CSS, dan komponen reusable bergaya shadcn/ui.
- [x] Vercel AI SDK dan provider OpenRouter.
- [x] Endpoint `streamText` dengan `Output.object()`.
- [x] UI textarea menampilkan structured output secara streaming.
- [x] Schema Zod untuk ringkasan, pihak, nilai kontrak, jatuh tempo, penalti, dan klausul waspada.
- [x] Hasil dirender sebagai card, tabel, badge severity, dan checklist.
- [x] Penolakan input non-kontrak pada validasi lokal dan prompt/model output.
- [x] System prompt bahasa Indonesia awam, konsisten, hati-hati, dan bukan nasihat hukum.
- [x] Empty, loading/streaming, invalid, dan error states.
- [x] Rate limit demo lima request per IP per menit.
- [x] Fixtures tiga format: perjanjian jasa, invoice tanpa pasal, dan kontrak kerja naratif.
- [x] Evaluasi live empat kasus: tiga format dokumen valid dan satu input non-kontrak.
- [x] Empat model OpenRouter gratis dengan fallback: GPT-OSS, Gemma, Nemotron, dan free router.
- [x] Ekstraksi PDF berbasis teks dan DOCX dengan validasi ekstensi, MIME, ukuran, dan signature.
- [x] Login Google Identity Services dengan cookie sesi HTTP-only.
- [x] Penyimpanan maksimal 20 hasil per akun/perangkat dan ekspor PDF.
- [x] Modal privasi dan ketentuan yang keyboard-friendly.
- [x] Deployment Vercel dan smoke test URL produksi.

## Keputusan penting

### Memisahkan workspace dari orchestration

`AnalyzerWorkspace` sekarang hanya merakit header, hero, panel input, panel hasil, dan footer. Custom hook `useContractAnalyzer` memiliki lifecycle AI di sisi client: state, structured stream, progress timer, validasi hasil, error, serta reset. Fungsi domain seperti validasi input dan transformasi hasil tetap pure di `lib/`, sehingga dapat diuji tanpa React.

### Menggabungkan streaming dan structured output

AI SDK modern menyatukan structured output ke `streamText` melalui `Output.object()`. UI memakai `useObject`, sehingga pengguna melihat ringkasan dan card muncul bertahap tanpa mengorbankan validasi objek final.

### Dua lapis penolakan input

Validasi lokal menolak input yang terlalu pendek atau sama sekali tidak memiliki sinyal dokumen. Input yang lolos tetap diklasifikasikan model melalui `isValidDocument` dan `jenisDokumen`. Ini mengurangi pemborosan token tanpa menganggap heuristic lokal sebagai sumber kebenaran tunggal.

### Rate limit yang jujur terhadap batas demo

Limiter in-memory sederhana cukup untuk development dan satu instance. Pada Vercel multi-instance, store perlu dipindahkan ke Redis/KV agar batas konsisten secara global.

### Fallback model gratis dan prompt yang eksplisit

Uji awal menunjukkan beberapa model gratis membentuk field versinya sendiri walaupun schema sudah dikirim. Prompt kemudian dipertegas dengan urutan kerja, aturan null, dan daftar nama properti yang wajib persis. GPT-OSS 20B dipakai sebagai model utama, disusul Gemma 4, Nemotron 3 Super, lalu router gratis. Evaluasi final meluluskan tiga dokumen berbeda dan satu input non-kontrak.

### Penyimpanan tanpa database untuk fase demo

Google ID token diverifikasi di server dan diubah menjadi cookie sesi HTTP-only. Hasil yang dipilih pengguna disimpan di local storage dengan key berdasarkan `sub` Google, maksimal 20 item. Ini menjaga demo sederhana dan tidak mengirim hasil ke database, tetapi riwayat belum tersinkron antarperangkat.

## Batasan saat ini

- PDF hasil scan/foto belum didukung karena OCR belum tersedia.
- Riwayat tersimpan hanya pada browser/perangkat yang sama, bukan database lintas perangkat.
- Rate limit masih in-memory dan tidak dibagi antar-instance serverless.
- Model gratis dapat memiliki antrean, rate limit, atau ketersediaan yang berubah.

## Langkah berikutnya

1. Tambahkan OCR untuk PDF scan/foto bila dibutuhkan pengguna.
2. Pindahkan riwayat dan rate limit ke database/Redis untuk sinkronisasi lintas perangkat.
3. Tambahkan kuota per akun dan observability model fallback.
4. Jalankan evaluasi fixture setiap kali schema, prompt, atau urutan model berubah.
