import { AI_ERRORS } from "../../constants/errors.js";

export function isAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function supports(model) {
  return model === MODELS.GEMINI_FLASH;
}

// function isAvailable() {
//   return Boolean(providerConfig.apiKey);
// }

export async function generate() {
  return {
    success: false,

    provider: "gemini",

    error: {
      code: AI_ERRORS.PROVIDER_ERROR,

      message: "Gemini provider has not been implemented yet.",
    },
  };
}
