import { defineAgent } from "eve";
import { openai } from "eve/models/openai";



export default defineAgent({
  model: openai("gpt-4.1-mini"),

  limits: {
    sessionUsage: ({ total }) =>
      total.inputTokens >= 80_000 ||
      total.outputTokens >= 6_000,
  },
});