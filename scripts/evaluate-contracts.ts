import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { CONTRACT_SYSTEM_PROMPT, buildContractPrompt } from "../lib/ai/contract-prompt";
import { FALLBACK_ANALYSIS_MODELS, PRIMARY_ANALYSIS_MODEL } from "../lib/ai/models";
import { contractAnalysisSchema } from "../lib/contract-schema";
import { contractFixtures, nonContractFixture } from "../tests/fixtures/contracts";

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error("OPENROUTER_API_KEY belum tersedia. Salin .env.example ke .env.local lalu isi key.");
    process.exit(1);
  }

  const openrouter = createOpenRouter({ apiKey });
  const model = openrouter(PRIMARY_ANALYSIS_MODEL);
  const cases = [
    ...contractFixtures.map((fixture) => ({ ...fixture, expectedValid: true })),
    { name: "input-non-kontrak", expectedType: "bukan_dokumen" as const, expectedValid: false, text: nonContractFixture },
  ];

  let failures = 0;

  for (const fixture of cases) {
    try {
      const { output } = await generateText({
        model,
        providerOptions: {
          openrouter: {
            models: [...FALLBACK_ANALYSIS_MODELS],
            plugins: [{ id: "response-healing" }],
          },
        },
        system: CONTRACT_SYSTEM_PROMPT,
        prompt: buildContractPrompt(fixture.text),
        output: Output.object({ schema: contractAnalysisSchema }),
        temperature: 0.1,
        maxOutputTokens: 3_500,
      });

      const passed = output.isValidDocument === fixture.expectedValid
        && output.jenisDokumen === fixture.expectedType
        && (!fixture.expectedValid || output.ringkasan.length >= 40);

      if (!passed) failures += 1;
      console.log(`${passed ? "PASS" : "FAIL"} ${fixture.name}: ${output.jenisDokumen}, valid=${output.isValidDocument}, pihak=${output.pihak.length}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${fixture.name}: ${error instanceof Error ? error.message : "error tidak dikenal"}`);
      if (NoObjectGeneratedError.isInstance(error)) {
        console.error(`Raw output: ${(error.text ?? "(kosong)").slice(0, 500)}`);
      }
    }
  }

  if (failures > 0) {
    console.error(`${failures} evaluasi gagal.`);
    process.exit(1);
  }

  console.log("Semua evaluasi model berhasil.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Evaluasi model gagal tanpa detail.");
  process.exit(1);
});
