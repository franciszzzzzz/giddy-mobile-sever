export const PROVIDERS = {
  DEEPSEEK: "deepseek",
  GEMINI: "gemini",
  GROQ: "groq",
  OPENROUTER: "openrouter",
};

export const MODELS = {
  DEEPSEEK_CHAT: "deepseek-v4-flash",

  // NOTE: "gemini-2.5-flash" is retired (404) and there is no
  // "gemini-2.5-flash-latest" alias — both verified against
  // ModelService.ListModels. "gemini-flash-latest" exists but returns 503
  // high-demand errors, so we use the lite alias: auto-updating (won't break
  // on version retirements) and verified reliable. Fine for a fallback slot.
  GEMINI_FLASH: "gemini-flash-lite-latest",

  // "llama-3.3-70b-versatile" was decommissioned by Groq (verified against
  // GET /openai/v1/models — no llama-3.3 models remain).
  GPT_OSS_120B: "openai/gpt-oss-120b",
};
