import { defineAgent } from "eve";
import { openai } from "eve/models/openai";

const key = process.env.OPENAI_API_KEY;

console.info("[concierge/openai-key-shape]", {
  present: Boolean(key),
  surroundingWhitespace:
    typeof key === "string" && key !== key.trim(),
  startsWithQuote:
    typeof key === "string" && /^["']/.test(key),
  endsWithQuote:
    typeof key === "string" && /["']$/.test(key),
});

export default defineAgent({
  model: openai("gpt-4.1-mini"),

  limits: {
    sessionUsage: ({ total }) =>
      total.inputTokens >= 80_000 ||
      total.outputTokens >= 6_000,
  },
});