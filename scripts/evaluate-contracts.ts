import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { analyzeLongDocument } from "../lib/ai/analyze-document";
import { CONTRACT_SYSTEM_PROMPT, buildContractPrompt } from "../lib/ai/contract-prompt";
import { ANALYSIS_MODELS, MAX_OUTPUT_TOKENS } from "../lib/ai/models";
import { contractAnalysisSchema, type ContractAnalysis } from "../lib/contract-schema";
import { contractFixtures, nonContractFixture } from "../tests/fixtures/contracts";

const EVALUATION_REQUEST_TIMEOUT_MS = Math.max(
  10_000,
  (Number(process.env.EVALUATION_REQUEST_TIMEOUT_SECONDS) || 45) * 1_000,
);

/** Menormalkan teks agar perbandingan kutipan tidak gagal karena spasi atau tanda baca. */
function loose(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Memeriksa apakah model benar-benar mengutip dokumen, bukan mengarang.
 * Ini yang paling sering meleset pada model gratis berukuran kecil.
 */
function checkGrounding(output: ContractAnalysis, source: string) {
  const issues: string[] = [];
  const haystack = loose(source);
  const lineCount = source.split("\n").length;

  for (const clause of output.klausulWaspada) {
    const quote = loose(clause.kutipan.replace(/L\d+\|\s*/g, ""));
    if (quote.length > 0 && !haystack.includes(quote)) {
      issues.push(`kutipan tidak ada di dokumen: "${clause.kutipan.slice(0, 70)}"`);
    }
  }

  const sources = [
    ...output.pihak.map((party) => party.sumber),
    ...output.penalti.map((penalty) => penalty.sumber),
    ...output.klausulWaspada.map((clause) => clause.sumber),
    output.nilaiKontrak?.sumber,
    output.tanggalMulai?.sumber,
    output.tanggalJatuhTempo?.sumber,
    output.durasi?.sumber,
  ].filter((value): value is string => typeof value === "string");

  for (const sumber of sources) {
    const lineMatch = /baris\s+(\d+)/i.exec(sumber);
    if (lineMatch && Number(lineMatch[1]) > lineCount) {
      issues.push(`sumber menunjuk baris di luar dokumen: "${sumber}" (dokumen ${lineCount} baris)`);
      continue;
    }

    const pasalMatch = /pasal\s+([\w.]+)/i.exec(sumber);
    if (pasalMatch && !new RegExp(`pasal\\s+${pasalMatch[1].replace(/\./g, "\\.")}`, "i").test(source)) {
      issues.push(`sumber menyebut pasal yang tidak tertulis: "${sumber}"`);
    }
  }

  return issues;
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY belum tersedia. Salin .env.example ke .env.local lalu isi key.");
    process.exit(1);
  }

  const openrouter = createOpenRouter({ apiKey });
  const cases = [
    ...contractFixtures.map((fixture) => ({ ...fixture, expectedValid: true })),
    { name: "input-non-kontrak", expectedType: "bukan_dokumen" as const, expectedValid: false, text: nonContractFixture },
  ];

  // Setiap model diuji sendiri-sendiri, bukan lewat rantai cadangan, supaya
  // terlihat model mana yang benar-benar layak dipakai dan mana yang selalu
  // gagal. Router di produksi memakai hasil ini sebagai dasar urutan prioritas.
  const scoreboard: Array<{ model: string; pass: number; total: number }> = [];

  for (const model of ANALYSIS_MODELS) {
    console.log(`\n=== ${model.label} (${model.id}) ===`);
    let pass = 0;

    for (const fixture of cases) {
      try {
        const { output } = await generateText({
          model: openrouter(model.id),
          providerOptions: {
            openrouter: { plugins: [{ id: "response-healing" }] },
          },
          system: CONTRACT_SYSTEM_PROMPT,
          prompt: buildContractPrompt(fixture.text),
          output: Output.object({ schema: contractAnalysisSchema }),
          temperature: 0.1,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 1,
          abortSignal: AbortSignal.timeout(EVALUATION_REQUEST_TIMEOUT_MS),
        });

        const classified = output.isValidDocument === fixture.expectedValid
          && output.jenisDokumen === fixture.expectedType
          && (!fixture.expectedValid || output.ringkasan.length >= 40);

        const groundingIssues = fixture.expectedValid ? checkGrounding(output, fixture.text) : [];
        const passed = classified && groundingIssues.length === 0;

        if (passed) pass += 1;
        console.log(`  ${passed ? "PASS" : "FAIL"} ${fixture.name}: ${output.jenisDokumen}, valid=${output.isValidDocument}, pihak=${output.pihak.length}`);
        for (const issue of groundingIssues) console.log(`    - ${issue}`);
      } catch (error) {
        console.error(`  FAIL ${fixture.name}: ${error instanceof Error ? error.message : "error tidak dikenal"}`);
        if (NoObjectGeneratedError.isInstance(error)) {
          console.error(`    Raw output: ${(error.text ?? "(kosong)").slice(0, 300)}`);
        }
      }
    }

    scoreboard.push({ model: model.label, pass, total: cases.length });
  }

  // Jalur dokumen panjang diuji terpisah: pemecahan, giliran model, dan
  // penggabungan hasil hanya aktif di jalur ini.
  console.log("\n=== jalur dokumen panjang (pecah + gabung) ===");
  let longDocumentOk = false;
  try {
    const longDocument = contractFixtures
      .map((fixture, index) => `BAGIAN ${index + 1}\n${fixture.text}`)
      .join("\n\n")
      .repeat(12);

    const { analysis, chunks, failedChunks, attempts } = await analyzeLongDocument(
      openrouter,
      longDocument,
      Math.min(180_000, EVALUATION_REQUEST_TIMEOUT_MS * 3),
    );
    const modelsUsed = new Set(attempts.filter((attempt) => attempt.ok).map((attempt) => attempt.model));

    longDocumentOk = analysis.isValidDocument && failedChunks.length === 0;
    console.log(`  ${longDocumentOk ? "PASS" : "FAIL"} ${chunks} bagian, gagal: ${failedChunks.length}, model terpakai: ${[...modelsUsed].join(", ") || "-"}`);
    console.log(`  pihak=${analysis.pihak.length}, penalti=${analysis.penalti.length}, klausul=${analysis.klausulWaspada.length}`);
    for (const attempt of attempts.filter((item) => !item.ok)) {
      console.log(`    bagian ${attempt.chunk} via ${attempt.model}: ${attempt.reason}`);
    }
  } catch (error) {
    console.error(`  FAIL jalur dokumen panjang: ${error instanceof Error ? error.message : "error tidak dikenal"}`);
  }

  console.log("\n=== ringkasan ===");
  for (const row of scoreboard) {
    console.log(`  ${row.model}: ${row.pass}/${row.total}`);
  }
  console.log(`  dokumen panjang: ${longDocumentOk ? "PASS" : "FAIL"}`);

  const usableModels = scoreboard.filter((row) => row.pass === row.total).length;
  if (usableModels === 0) {
    console.error("\nTidak ada model yang lolos seluruh kasus uji.");
    process.exit(1);
  }

  console.log(`\n${usableModels} dari ${scoreboard.length} model lolos seluruh kasus uji.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Evaluasi model gagal tanpa detail.");
  process.exit(1);
});
