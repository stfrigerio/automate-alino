import { readFileSync } from "fs";
import { extname } from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import type Anthropic from "@anthropic-ai/sdk";

type ContentBlock = Anthropic.Messages.ContentBlockParam;

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function readFile(filePath: string): Promise<ContentBlock[] | null> {
  const ext = extname(filePath).toLowerCase();

  if (IMAGE_EXTS.has(ext)) {
    const data = readFileSync(filePath).toString("base64");
    const mediaType = EXT_TO_MIME[ext] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    return [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      },
    ];
  }

  if (ext === ".pdf") {
    const buffer = readFileSync(filePath);
    const { text } = await pdf(buffer);
    if (!text.trim()) return null;
    return [{ type: "text", text }];
  }

  if (ext === ".docx") {
    const buffer = readFileSync(filePath);
    const { value: text } = await mammoth.extractRawText({ buffer });
    if (!text.trim()) return null;
    return [{ type: "text", text }];
  }

  // Try as plain text
  try {
    const text = readFileSync(filePath, "utf-8");
    if (!text.trim()) return null;
    return [{ type: "text", text }];
  } catch {
    return null;
  }
}
