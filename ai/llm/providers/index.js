import * as deepseek from "./deepseek.provider.js";
import * as groq from "./groq.provider.js";
import * as gemini from "./gemini.provider.js";

import { PROVIDERS } from "../../constants/models.js";

const providers = {
  [PROVIDERS.DEEPSEEK]: {
    name: PROVIDERS.DEEPSEEK,
    service: deepseek,
  },

  [PROVIDERS.GEMINI]: {
    name: PROVIDERS.GEMINI,
    service: gemini,
  },

  [PROVIDERS.GROQ]: {
    name: PROVIDERS.GROQ,
    service: groq,
  },
};

export default providers;
