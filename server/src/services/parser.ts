import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { extname } from "path";
import pdf from "pdf-parse";

const client = new Anthropic();

interface ParsedPayslip {
  nome: string | null;
  cognome: string | null;
  mese: string | null; // YYYY-MM
  ore_lavorate: number | null;
}

export async function parsePayslip(filePath: string): Promise<ParsedPayslip> {
  const ext = extname(filePath).toLowerCase();
  let textContent = "";

  if (ext === ".pdf") {
    const buffer = readFileSync(filePath);
    const { text } = await pdf(buffer);
    textContent = text;
  } else {
    textContent = readFileSync(filePath, "utf-8");
  }

  if (!textContent.trim()) {
    return { nome: null, cognome: null, mese: null, ore_lavorate: null };
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analizza questa busta paga italiana ed estrai i seguenti dati.
Rispondi SOLO con un oggetto JSON valido, senza altro testo.

Campi da estrarre:
- "nome": nome di battesimo del lavoratore (string o null)
- "cognome": cognome del lavoratore (string o null)
- "mese": mese di competenza in formato YYYY-MM (string o null)
- "ore_lavorate": ore lavorate nel mese (number o null)

Per le ore, cerca campi come "Ore lavorate", "Ore ordinarie", "ORE LAVORATE NEL MESE", o la somma delle ore nella sezione presenze.
Per il mese, cerca "Competenza", "Periodo", date in formato MM/YYYY.

Testo della busta paga:
---
${textContent.slice(0, 8000)}
---

Rispondi SOLO con il JSON:`,
          },
        ],
      },
    ],
  });

  try {
    const raw =
      response.content[0].type === "text" ? response.content[0].text : "";
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { nome: null, cognome: null, mese: null, ore_lavorate: null };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      nome: parsed.nome ?? null,
      cognome: parsed.cognome ?? null,
      mese: parsed.mese ?? null,
      ore_lavorate:
        parsed.ore_lavorate != null ? Number(parsed.ore_lavorate) : null,
    };
  } catch {
    return { nome: null, cognome: null, mese: null, ore_lavorate: null };
  }
}

/**
 * Try to match extracted name to a project's people list.
 * Returns persona_id if found, null otherwise.
 */
export function matchPersona(
  nomeEstratto: string | null,
  cognomeEstratto: string | null,
  persone: { id: string; nome: string; cognome: string }[],
): { personaId: string | null; confidence: "exact" | "partial" | "none" } {
  if (!nomeEstratto && !cognomeEstratto) {
    return { personaId: null, confidence: "none" };
  }

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const en = normalize(nomeEstratto ?? "");
  const ec = normalize(cognomeEstratto ?? "");

  // Exact match
  for (const p of persone) {
    const pn = normalize(p.nome);
    const pc = normalize(p.cognome);
    if (en === pn && ec === pc) {
      return { personaId: p.id, confidence: "exact" };
    }
  }

  // Partial: surname match
  for (const p of persone) {
    const pc = normalize(p.cognome);
    if (ec && ec === pc) {
      return { personaId: p.id, confidence: "partial" };
    }
  }

  // Partial: name contained in full name
  const fullExtracted = `${en} ${ec}`.trim();
  for (const p of persone) {
    const fullPerson = `${normalize(p.nome)} ${normalize(p.cognome)}`;
    if (fullExtracted && fullPerson.includes(fullExtracted)) {
      return { personaId: p.id, confidence: "partial" };
    }
    if (fullExtracted && fullExtracted.includes(fullPerson)) {
      return { personaId: p.id, confidence: "partial" };
    }
  }

  return { personaId: null, confidence: "none" };
}
