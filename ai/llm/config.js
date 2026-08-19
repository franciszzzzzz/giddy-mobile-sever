import { MODELS, PROVIDERS } from "../constants/models.js";

// Validate required environment variables
if (!process.env.OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY environment variable is missing.");
}

const config = {
  providerPriority: [
    {
      provider: PROVIDERS.DEEPSEEK,
      model: MODELS.DEEPSEEK_CHAT,
      priority: 1,
      enabled: true,
    },

    {
      provider: PROVIDERS.GEMINI,
      model: MODELS.GEMINI_FLASH,
      priority: 2,
      enabled: true,
    },

    {
      provider: PROVIDERS.GROQ,
      model: MODELS.GPT_OSS_120B,
      priority: 3,
      enabled: true,
    },
  ],

  timeout: Number(process.env.AI_REQUEST_TIMEOUT || 30000),

  maxRetries: Number(process.env.AI_MAX_RETRIES || 2),

  temperature: Number(process.env.AI_TEMPERATURE || 0.6),

  maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || 600),
};

export default config;
