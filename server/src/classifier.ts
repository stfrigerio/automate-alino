import Anthropic from "@anthropic-ai/sdk";
import type { RulesConfig } from "../../shared/types.js";

const client = new Anthropic();

type ContentBlock = Anthropic.Messages.ContentBlockParam;

export async function classify(
  contentBlocks: ContentBlock[],
  rules: RulesConfig,
  fileName: string,
): Promise<string> {
  const categoriesText = rules.categories
    .map((cat) => `- ${cat.name}: ${cat.hints.join(", ")}`)
    .join("\n");

  const prompt: ContentBlock = {
    type: "text",
    text: [
      "Classify this document into one of these categories:",
      "",
      categoriesText,
      "",
      'If the document doesn\'t clearly match any category, respond with "unclassified".',
      "",
      `Document filename: ${fileName}`,
      "",
      "Respond with ONLY the exact category name, nothing else.",
    ].join("\n"),
  };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 256,
    messages: [{ role: "user", content: [...contentBlocks, prompt] }],
  });

  const result =
    response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "unclassified";

  // Match against known categories (case-insensitive)
  const match = rules.categories.find(
    (cat) => cat.name.toLowerCase() === result.toLowerCase(),
  );
  return match ? match.name : "unclassified";
}
