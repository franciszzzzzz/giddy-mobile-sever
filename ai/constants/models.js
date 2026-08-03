export const PROVIDERS = {
  DEEPSEEK: "deepseek",
  GEMINI: "gemini",
  GROQ: "groq",
  OPENROUTER: "openrouter",
};

export const MODELS = {
  DEEPSEEK_CHAT: "deepseek-v4-flash",

  // "gemini-2.5-flash" was deprecated by Google and returns MODEL_NOT_FOUND.
  // The "-latest" alias always points at the newest 2.5 Flash build, so this
  // won't break again on the next point-release retirement.
  GEMINI_FLASH: "gemini-2.5-flash-latest",

  LLAMA_70B: "llama-3.3-70b-versatile",
};
