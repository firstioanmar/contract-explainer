import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { Output, streamText } from "ai";
import { CONTRACT_SYSTEM_PROMPT, buildContractPrompt } from "@/lib/ai/contract-prompt";
import { FALLBACK_ANALYSIS_MODELS, PRIMARY_ANALYSIS_MODEL } from "@/lib/ai/models";
import { analyzeRequestSchema, contractAnalysisSchema } from "@/lib/contract-schema";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const maxDuration = 45;

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
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
  const result = streamText({
    model: openrouter(PRIMARY_ANALYSIS_MODEL),
    providerOptions: {
      openrouter: {
        models: [...FALLBACK_ANALYSIS_MODELS],
      },
    },
    system: CONTRACT_SYSTEM_PROMPT,
    prompt: buildContractPrompt(parsed.data.text),
    output: Output.object({
      schema: contractAnalysisSchema,
      name: "analisis_kontrak",
      description: "Analisis terstruktur kontrak atau invoice dalam bahasa Indonesia awam.",
    }),
    temperature: 0.1,
    maxOutputTokens: 3_500,
    maxRetries: 2,
    onError({ error }) {
      console.error("Contract analysis stream failed", error instanceof Error ? error.name : "UnknownError");
    },
  });

  return result.toTextStreamResponse({ headers });
}
