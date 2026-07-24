import { PROVIDERS } from "../../constants/models.js";

export const PROVIDER_CONFIG = {
  [PROVIDERS.OPENROUTER]: {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  },

  [PROVIDERS.GROQ]: {
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
  },

  [PROVIDERS.GEMINI]: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: process.env.GEMINI_API_KEY,
  },
};
