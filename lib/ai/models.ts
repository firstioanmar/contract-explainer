export const FREE_ANALYSIS_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
] as const;

export const PRIMARY_ANALYSIS_MODEL = FREE_ANALYSIS_MODELS[0];
export const FALLBACK_ANALYSIS_MODELS = FREE_ANALYSIS_MODELS.slice(1);
