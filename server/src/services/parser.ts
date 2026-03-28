import { readFileSync } from "fs";
import pdf from "pdf-parse";
import type { ChecklistRules, OreGiornaliere, DettaglioOre } from "../../../shared/types.ts";
import { FSE_PLUS_RULES } from "./checklist-rules.ts";
import { spawnClaude } from "./claude.js";

async function extractPdfText(filePath: string): Promise<string> {
  const buffer = readFileSync(filePath);
  const { text } = await pdf(buffer);
  return text;
}

interface ParsedPayslip {
  nome: string | null;
  cognome: string | null;
  mese: string | null; // YYYY-MM
  ore_lavorate: number | null;
  costo_orario: number | null;
  totale: number | null;
  ore_giornaliere: OreGiornaliere[];
  dettaglio_ore: DettaglioOre;
}

const NULL_RESULT: ParsedPayslip = {
  nome: null, cognome: null, mese: null, ore_lavorate: null,
  costo_orario: null, totale: null, ore_giornaliere: [], dettaglio_ore: {},
};

export async function parsePayslip(filePath: string): Promise<ParsedPayslip> {
  let pdfText: string;
  try {
    pdfText = await extractPdfText(filePath);
  } catch {
    pdfText = "";
  }

  // If pdf-parse extracted text, send it inline (fast, no tool calls).
  // Otherwise fall back to Claude CLI with Read tool (handles scanned/image PDFs).
  const useFallback = !pdfText.trim() || pdfText.trim().length < 50;

  const instructions = `Analizza questa busta paga italiana.
Estrai i seguenti dati e rispondi SOLO con un oggetto JSON valido, senza altro testo.

Campi da estrarre:
- "nome": nome di battesimo del lavoratore (string o null)
- "cognome": cognome del lavoratore (string o null)
- "mese": mese di competenza in formato YYYY-MM (string o null)
- "ore_lavorate": ore lavorate totali nel mese (number o null)
- "costo_orario": costo orario lordo del lavoratore in euro (number o null)
- "totale": retribuzione lorda totale del mese in euro (number o null)
- "ore_giornaliere": array con le ore giorno per giorno estratte dalla griglia presenze.
  Per ogni giorno del mese che ha ore > 0, includi un oggetto:
  {"giorno": <numero giorno 1-31>, "ordinarie": <ore ordinarie>, "straordinario": <ore straordinario>, "assenza": <ore assenza>}
  La griglia nella busta paga ha righe etichettate "ORDINARIO", "STRAORDIN." e "ASSENZA" con le colonne numerate 1-31.
  Se un giorno non ha ore in nessuna riga, omettilo. Usa 0 per le righe senza valore per quel giorno.
- "dettaglio_ore": oggetto con il riepilogo per tipo di ore dal corpo della busta paga:
  {"ore_ordinarie": <number o null>, "ore_straordinario": <number o null>, "ore_festivita": <number o null>, "ore_assenza": <number o null>}
  Cerca le voci "Ore Ordinarie", "Ore Straordinarie", "Festività", "ASSENZA" nella sezione DESCRIZIONE/COMPETENZE.
  I valori sono nella colonna GG./ORE. Attenzione: i numeri italiani usano la virgola decimale (es. 58,800 = 58.8).

Per le ore totali, cerca "ORE LAV.", "Ore lavorate", o la somma delle ore nella griglia presenze.
Per il costo orario, cerca "RETR. ORARIA", "IMPORTO UNITARIO", "Retribuzione oraria".
Per il totale, cerca "TOTALE COMPETENZE", "TOT. ELEM. FISSI", "Retribuzione lorda".
Per il mese, cerca "PERIODO RETRIBUTIVO", "Competenza", date in formato MESE/ANNO.

Rispondi SOLO con il JSON.`;

  try {
    let raw: string;
    if (useFallback) {
      // Scanned PDF — need Claude CLI with Read tool
      raw = await spawnClaude(
        `Leggi il file "${filePath}" usando il tool Read.\n\n${instructions}`,
        { maxTurns: 5, timeoutMs: 300_000, allowedTools: ["Read"] },
      );
    } else {
      // Text PDF — direct API call, much faster
      raw = await spawnClaude(
        `${instructions}\n\n--- CONTENUTO BUSTA PAGA ---\n${pdfText}\n--- FINE ---`,
        { maxTurns: 1, timeoutMs: 60_000, allowedTools: [] },
      );
    }
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NULL_RESULT;
    const parsed = JSON.parse(jsonMatch[0]);

    const oreGiornaliere: OreGiornaliere[] = Array.isArray(parsed.ore_giornaliere)
      ? parsed.ore_giornaliere.map((g: Record<string, unknown>) => ({
          giorno: Number(g.giorno),
          ordinarie: Number(g.ordinarie ?? 0),
          straordinario: Number(g.straordinario ?? 0),
          assenza: Number(g.assenza ?? 0),
        }))
      : [];

    const det = parsed.dettaglio_ore ?? {};
    const dettaglioOre: DettaglioOre = {
      ore_ordinarie: det.ore_ordinarie != null ? Number(det.ore_ordinarie) : undefined,
      ore_straordinario: det.ore_straordinario != null ? Number(det.ore_straordinario) : undefined,
      ore_festivita: det.ore_festivita != null ? Number(det.ore_festivita) : undefined,
      ore_assenza: det.ore_assenza != null ? Number(det.ore_assenza) : undefined,
    };

    return {
      nome: parsed.nome ?? null,
      cognome: parsed.cognome ?? null,
      mese: parsed.mese ?? null,
      ore_lavorate: parsed.ore_lavorate != null ? Number(parsed.ore_lavorate) : null,
      costo_orario: parsed.costo_orario != null ? Number(parsed.costo_orario) : null,
      totale: parsed.totale != null ? Number(parsed.totale) : null,
      ore_giornaliere: oreGiornaliere,
      dettaglio_ore: dettaglioOre,
    };
  } catch (err) {
    console.error("[parsePayslip] Error:", err);
    return NULL_RESULT;
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

/**
 * Parse a PDF containing rendicontazione rules and extract a ChecklistRules object.
 * Falls back to FSE+ rules if extraction fails.
 */
export async function parseRulesPdf(filePath: string): Promise<ChecklistRules> {
  const prompt = `Leggi il file "${filePath}" usando il tool Read.
Questo documento descrive le regole di rendicontazione per un programma di finanziamento europeo/nazionale.
Devi estrarre le regole per la checklist documentale.

Per ogni tipo di personale (interno ed esterno), identifica quali documenti sono richiesti.
Per ogni documento, determina:
- "categoria": un codice breve tra questi valori noti: "busta_paga", "timecard", "ordine_servizio", "prospetto_costo_orario", "f24", "bonifico", "fattura", "cv", "lettera_incarico", "relazione_attivita", "relazione_finale", "dichiarazione_irap", "scheda_finanziaria", "registri_presenze". Se il documento non rientra in nessuna di queste categorie, usa un codice_snake_case descrittivo.
- "descrizione": descrizione breve in italiano
- "perMese": true se il documento è richiesto per ogni mese di attività, false se è unico
- "unaTantum": true se il documento è richiesto una sola volta per persona/progetto

Rispondi SOLO con un oggetto JSON con questa struttura esatta:
{
  "docs_interno": [{"categoria": "...", "descrizione": "...", "perMese": false, "unaTantum": true}, ...],
  "docs_interno_con_relazione": [... stessi docs di docs_interno + relazione_attivita ...],
  "ruoli_con_relazione": ["tutor_interno", "amministrativo", "direttore_interno", "coordinatore", "rendicontatore"],
  "docs_esterno": [...],
  "docs_progetto": [...],
  "docs_per_mode": {"costi_reali": [...]}
}

Se non riesci a determinare una sezione, usa un array vuoto.
Rispondi SOLO con il JSON, senza altro testo.`;

  try {
    const raw = await spawnClaude(prompt, { maxTurns: 5, timeoutMs: 300_000 });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in Claude output");
    const parsed = JSON.parse(jsonMatch[0]) as ChecklistRules;
    // Basic validation
    if (!parsed.docs_interno || !parsed.docs_esterno || !parsed.docs_progetto) {
      throw new Error("Incomplete rules extracted");
    }
    return {
      docs_interno: parsed.docs_interno ?? [],
      docs_interno_con_relazione: parsed.docs_interno_con_relazione ?? parsed.docs_interno,
      ruoli_con_relazione: parsed.ruoli_con_relazione ?? FSE_PLUS_RULES.ruoli_con_relazione,
      docs_esterno: parsed.docs_esterno ?? [],
      docs_progetto: parsed.docs_progetto ?? [],
      docs_per_mode: parsed.docs_per_mode ?? {},
    };
  } catch (err) {
    console.error("[parseRulesPdf] Error, falling back to FSE+ rules:", err);
    return FSE_PLUS_RULES;
  }
}
