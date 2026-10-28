import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { analyzeLongDocument, AnalysisTimeoutError } from "@/lib/ai/analyze-document";
import { CONTRACT_SYSTEM_PROMPT, buildContractPrompt, normalizeDocumentText } from "@/lib/ai/contract-prompt";
import { splitDocument } from "@/lib/ai/document-chunks";
import { buildInjectionWarning, detectInjectionSignals } from "@/lib/ai/injection-detection";
import { clearRejectedAnalysis } from "@/lib/ai/merge-analysis";
import {
  FALLBACK_ANALYSIS_MODELS,
  MAX_OUTPUT_TOKENS,
  OPENROUTER_MODEL_CONFIG_ERROR,
  PRIMARY_ANALYSIS_MODEL,
  SHORT_ANALYSIS_TIME_BUDGET_MS,
} from "@/lib/ai/models";
import { analyzeRequestSchema, contractAnalysisSchema } from "@/lib/contract-schema";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

// Fluid Compute mendukung 300 detik pada Vercel Hobby. Deadline internal tetap
// lebih pendek supaya aplikasi mengakhiri model yang menggantung secara jujur.
export const maxDuration = 300;


type ProviderFailure = { status: number; message: string; code: string };

function getProviderFailure(error: unknown): ProviderFailure {
  if (NoObjectGeneratedError.isInstance(error)) {
    return {
      status: 502,
      code: "invalid_structured_output",
      message: "Model AI tidak menghasilkan data kontrak dalam format yang valid. Coba lagi atau gunakan dokumen yang lebih pendek.",
    };
  }

  const candidate = typeof error === "object" && error !== null
    ? error as { statusCode?: unknown; status?: unknown; name?: unknown; message?: unknown; responseBody?: unknown }
    : {};
  const statusCandidate = Number(candidate.statusCode ?? candidate.status);
  const status = Number.isInteger(statusCandidate) && statusCandidate >= 400 && statusCandidate <= 599
    ? statusCandidate
    : 502;
  const details = `${typeof candidate.message === "string" ? candidate.message : ""} ${typeof candidate.responseBody === "string" ? candidate.responseBody : ""}`.toLowerCase();
  const code = typeof candidate.name === "string" ? candidate.name : "UnknownProviderError";

  if (status === 401 || status === 403 || /invalid api key|unauthorized|authentication/.test(details)) {
    return {
      status: 502,
      code: "openrouter_authentication",
      message: "Autentikasi OpenRouter ditolak. Periksa OPENROUTER_API_KEY di Vercel Production dan pastikan key masih aktif.",
    };
  }
  if (status === 402 || /insufficient credits|payment required|billing/.test(details)) {
    return {
      status: 502,
      code: "openrouter_credits",
      message: "Saldo atau billing OpenRouter tidak mencukupi. Periksa kredit akun OpenRouter sebelum mencoba lagi.",
    };
  }
  if (status === 429 || /rate.?limit|too many requests/.test(details)) {
    return {
      status: 503,
      code: "openrouter_rate_limit",
      message: "OpenRouter sedang membatasi permintaan. Tunggu sebentar lalu coba lagi.",
    };
  }
  if (status === 404 || /model not found|unknown model/.test(details)) {
    return {
      status: 502,
      code: "openrouter_model",
      message: "Model OpenRouter tidak ditemukan. Periksa OPENROUTER_MODEL dan nama model cadangan di Vercel.",
    };
  }
  if (status === 400 || /response_format|json schema|structured output|unsupported parameter/.test(details)) {
    return {
      status: 502,
      code: "openrouter_structured_output",
      message: "Model atau provider menolak format JSON Schema. Pilih model OpenRouter yang mendukung structured outputs.",
    };
  }
  if (status === 408 || status === 504 || /timed out|timeout|aborted/.test(details)) {
    return {
      status: 504,
      code: "openrouter_timeout",
      message: "Analisis melewati batas waktu. Coba dokumen yang lebih pendek atau ulangi beberapa saat lagi.",
    };
  }

  return {
    status: status >= 500 ? 502 : status,
    code,
    message: "OpenRouter gagal menyelesaikan analisis. Periksa status layanan dan konfigurasi model, lalu coba lagi.",
  };
}

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

  if (OPENROUTER_MODEL_CONFIG_ERROR) {
    return jsonError("OPENROUTER_MODEL tidak valid. Gunakan format provider/model, misalnya openai/gpt-4.1-mini.", 503, headers);
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return jsonError("Layanan AI belum dikonfigurasi oleh administrator. Tambahkan OPENROUTER_API_KEY di environment Vercel.", 503, headers);
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

  // Dokumen yang memuat teks pengarah hasil tidak boleh dialirkan token demi
  // token: peringatannya menempel pada _meta, dan _meta hanya bisa dikirim pada
  // jalur yang mengembalikan objek utuh. Menukar streaming dengan peringatan
  // adalah pertukaran yang benar di sini — pengguna yang dokumennya sedang
  // mencoba memanipulasi hasil lebih butuh tahu daripada butuh cepat.
  const injectionSignals = detectInjectionSignals(normalized);
  const injectionWarning = buildInjectionWarning(injectionSignals);

  if (injectionSignals.length > 0) {
    console.warn(
      `Injection signals: ${injectionSignals.length} baris (${injectionSignals.map((signal) => signal.line).join(", ")})`,
    );
  }

  // Dokumen panjang dipecah dan dianalisis bagian demi bagian oleh model yang
  // bergiliran, lalu digabungkan. Hasil gabungan baru berarti setelah semua
  // bagian selesai, sehingga jalur ini tidak mengalirkan hasil sebagian.
  if (chunks.length > 1 || injectionWarning) {
    try {
      const { analysis, chunks: total, failedChunks, attempts, estimatedCostUsd } =
        await analyzeLongDocument(openrouter, normalized);

      // Berapa bagian yang harus ditebus lapis berbayar adalah sinyal kesehatan
      // lapis gratis. Bila angkanya terus naik, urutan model perlu ditinjau.
      const succeeded = attempts.filter((attempt) => attempt.ok);
      const paidChunks = succeeded.filter((attempt) => attempt.tier !== "gratis").length;

      console.info(
        `Contract analysis: ${total} bagian, ${succeeded.length} berhasil`,
        `(${paidChunks} lewat lapis berbayar, ~$${estimatedCostUsd.toFixed(5)})`,
        failedChunks.length > 0 ? `bagian gagal: ${failedChunks.join(", ")}` : "",
      );

      const warnings = [
        ...(injectionWarning ? [injectionWarning] : []),
        ...(failedChunks.length > 0
          ? [`Analisis selesai sebagian. Bagian ${failedChunks.join(", ")} dari ${total} tidak dapat dibaca oleh model AI dan tidak disertakan dalam hasil.`]
          : []),
      ];

      return jsonStream({
        ...clearRejectedAnalysis(analysis),
        _meta: {
          isPartial: failedChunks.length > 0,
          failedChunks,
          totalChunks: total,
          warnings,
        },
      }, headers);
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

      const failure = getProviderFailure(error);
      console.error(`Long document analysis failed code=${failure.code} status=${failure.status}`);
      return jsonError(failure.message, failure.status, headers);
    }
  }

  // Generate the complete short-document object before returning HTTP 200.
  // A streaming response commits its status before OpenRouter's provider error
  // is known, which previously let provider failures become empty HTTP 200 bodies.
  try {
    const result = await generateText({
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
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(SHORT_ANALYSIS_TIME_BUDGET_MS),
    });

    return jsonStream(clearRejectedAnalysis(result.output), headers);
  } catch (error) {
    const failure = getProviderFailure(error);
    // Never log API keys, document text, raw model output, or raw provider body.
    console.error(`Contract analysis failed code=${failure.code} status=${failure.status} model=${PRIMARY_ANALYSIS_MODEL}`);
    return jsonError(failure.message, failure.status, headers);
  }
}
