import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAnalysisPdf } from "../lib/export-analysis-pdf";
import { mockResult } from "../lib/mock-contract";

async function main() {
  const outputDirectory = resolve("output/pdf");
  const outputPath = resolve(outputDirectory, "kontrakjelas-sample-analysis.pdf");

  await mkdir(outputDirectory, { recursive: true });
  const pdf = createAnalysisPdf(mockResult);
  await writeFile(outputPath, Buffer.from(pdf.output("arraybuffer")));
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
