import { AI_ERRORS } from "../../constants/errors.js";

export function isAvailable() {
  return Boolean(process.env.GROQ_API_KEY);
}

function supports(model) {
  return model === MODELS.LLAMA_70B;
}

// function isAvailable() {
//   return Boolean(providerConfig.apiKey);
// }

export async function generate() {
  return {
    success: false,

    provider: "groq",

    error: {
      code: AI_ERRORS.PROVIDER_ERROR,

      message: "Groq provider has not been implemented yet.",
    },
  };
}
