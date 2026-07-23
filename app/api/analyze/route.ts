import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Output, streamText } from "ai";
import { analyzeLongDocument, AnalysisTimeoutError } from "@/lib/ai/analyze-document";
import { CONTRACT_SYSTEM_PROMPT, buildContractPrompt, normalizeDocumentText } from "@/lib/ai/contract-prompt";
import { splitDocument } from "@/lib/ai/document-chunks";
import { FALLBACK_ANALYSIS_MODELS, MAX_OUTPUT_TOKENS, PRIMARY_ANALYSIS_MODEL } from "@/lib/ai/models";
import { analyzeRequestSchema, contractAnalysisSchema } from "@/lib/contract-schema";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

// Batas yang diminta ke platform. Vercel Hobby tetap membatasi 60 detik apa pun
// nilainya; batas waktu efektif diatur oleh ANALYSIS_TIME_BUDGET_SECONDS agar
// server sempat mengembalikan pesan jujur sebelum fungsi dimatikan paksa.
export const maxDuration = 300;

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

/**
 * Klien membaca hasil sebagai aliran teks JSON. Dokumen panjang tidak bisa
 * dialirkan sambil diproses karena hasil tiap bagian baru berarti setelah
 * digabungkan, jadi objek akhir dikirim sekaligus lewat aliran yang sama.
 */
function jsonStream(payload: unknown, headers: HeadersInit) {
  const body = JSON.stringify(payload);
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" } },
  );
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getClientIp(request));
  const headers = rateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return jsonError(
      "Batas analisis tercapai. Coba lagi dalam satu menit.",
      429,
      { ...headers, "Retry-After": String(Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000))) },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("Layanan AI belum dikonfigurasi oleh administrator.", 503, headers);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Format permintaan tidak valid.", 400, headers);
  }

  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Teks harus berisi 80 sampai 60.000 karakter.", 422, headers);
  }

  const openrouter = createOpenRouter({ apiKey });
  const normalized = normalizeDocumentText(parsed.data.text);
  const chunks = splitDocument(normalized);

  // Dokumen panjang dipecah dan dianalisis bagian demi bagian oleh model yang
  // bergiliran, lalu digabungkan. Hasil gabungan baru berarti setelah semua
  // bagian selesai, sehingga jalur ini tidak mengalirkan hasil sebagian.
  if (chunks.length > 1) {
    try {
      const { analysis, chunks: total, failedChunks, attempts } = await analyzeLongDocument(openrouter, normalized);

      console.info(
        `Contract analysis: ${total} bagian, ${attempts.filter((attempt) => attempt.ok).length} berhasil`,
        failedChunks.length > 0 ? `bagian gagal: ${failedChunks.join(", ")}` : "",
      );

      return jsonStream(analysis, headers);
    } catch (error) {
      // Kehabisan waktu: sampaikan jujur bahwa dokumen tidak dapat dituntaskan,
      // jangan menyajikan analisis yang diam-diam kehilangan sebagian isi.
      if (error instanceof AnalysisTimeoutError) {
        console.warn(`Long document timed out: ${error.completedChunks}/${error.totalChunks} bagian selesai`);
        return jsonError(
          "Dokumen ini terlalu panjang untuk dituntaskan dalam batas waktu yang tersedia, sehingga analisisnya tidak dapat diselesaikan sepenuhnya. Untuk hasil yang andal, analisis satu bagian terpenting saja (misalnya pasal pembayaran, denda, dan pengakhiran), atau pisahkan dokumen menjadi beberapa bagian yang lebih pendek lalu analisis satu per satu.",
          504,
          headers,
        );
      }

      console.error("Long document analysis failed", error instanceof Error ? error.message : "UnknownError");
      return jsonError("Seluruh model gratis gagal menganalisis dokumen ini. Coba lagi sebentar lagi.", 502, headers);
    }
  }

  // Dokumen pendek tetap dialirkan token demi token agar hasil parsial langsung
  // tampil. Pergantian model ditangani OpenRouter sebelum aliran dimulai.
  const result = streamText({
    model: openrouter(PRIMARY_ANALYSIS_MODEL),
    providerOptions: {
      openrouter: {
        models: [...FALLBACK_ANALYSIS_MODELS],
        plugins: [{ id: "response-healing" }],
      },
    },
    system: CONTRACT_SYSTEM_PROMPT,
    prompt: buildContractPrompt(normalized),
    output: Output.object({
      schema: contractAnalysisSchema,
      name: "analisis_kontrak",
      description: "Analisis terstruktur kontrak atau invoice dalam bahasa Indonesia awam.",
    }),
    temperature: 0.1,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 2,
    onError({ error }) {
      console.error("Contract analysis stream failed", error instanceof Error ? error.name : "UnknownError");
    },
  });

  return result.toTextStreamResponse({ headers });
}
