import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAnalysisPdf } from "../lib/export-analysis-pdf";
import { mockResult } from "../lib/mock-contract";

async function main() {
  const outputDirectory = resolve("output/pdf");
  const outputPath = resolve(outputDirectory, "kontrakjelas-sample-analysis.pdf");
  const warningOutputPath = resolve(outputDirectory, "kontrakjelas-sample-partial-analysis.pdf");

  await mkdir(outputDirectory, { recursive: true });
  const pdf = createAnalysisPdf(mockResult);
  await writeFile(outputPath, Buffer.from(pdf.output("arraybuffer")));
  const warningPdf = createAnalysisPdf({
    ...mockResult,
    warnings: ["Analisis selesai sebagian. Bagian 2 dari 4 tidak dapat dibaca oleh model AI dan tidak disertakan dalam hasil."],
  });
  await writeFile(warningOutputPath, Buffer.from(warningPdf.output("arraybuffer")));
  console.log(outputPath);
  console.log(warningOutputPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
