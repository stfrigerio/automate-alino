import Anthropic from "@anthropic-ai/sdk";
import type { Person } from "../../shared/types.js";

const client = new Anthropic();

type ContentBlock = Anthropic.Messages.ContentBlockParam;

export async function classify(
  contentBlocks: ContentBlock[],
  workers: Person[],
  fileName: string,
): Promise<string> {
  const workersText = workers
    .map((w) => {
      const extra = w.hints?.length ? `: ${w.hints.join(", ")}` : "";
      return `- ${w.name}${extra}`;
    })
    .join("\n");

  const prompt: ContentBlock = {
    type: "text",
    text: [
      "Classify this document by assigning it to one of these workers:",
      "",
      workersText,
      "",
      'If the document doesn\'t clearly match any worker, respond with "unclassified".',
      "",
      `Document filename: ${fileName}`,
      "",
      "Respond with ONLY the exact worker name, nothing else.",
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

  const match = workers.find(
    (w) => w.name.toLowerCase() === result.toLowerCase(),
  );
  return match ? match.name : "unclassified";
}
