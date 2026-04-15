import { extname } from "path";
import { spawnClaude } from "./claude.js";
import { readFile } from "../reader.js";
import type { DocumentCategory } from "../../../shared/types.ts";

const VALID_CATEGORIES: DocumentCategory[] = [
  "busta_paga", "timecard", "ordine_servizio", "prospetto_costo_orario",
  "f24", "bonifico", "lettera_incarico", "fattura", "cv",
  "relazione_attivita", "relazione_finale", "dichiarazione_irap",
  "scheda_finanziaria", "registri_presenze", "non_pertinente",
];

export interface ClassifiedDocument {
  categoria: DocumentCategory;
  persona_nome: string | null;
  persona_cognome: string | null;
  mese: string | null; // YYYY-MM
  descrizione: string;
  motivo: string;
  progetto_nome: string | null;
  progetto_codice: string | null;
}

export interface SubDocument extends ClassifiedDocument {
  pagine: number[]; // 1-based page numbers
}

export interface ClassificationResult {
  documenti_multipli: boolean;
  documento?: ClassifiedDocument;
  sotto_documenti?: SubDocument[];
}

const FALLBACK_DOC: ClassifiedDocument = {
  categoria: "non_pertinente",
  persona_nome: null,
  persona_cognome: null,
  mese: null,
  progetto_nome: null,
  progetto_codice: null,
  descrizione: "Impossibile classificare",
  motivo: "Nessuna risposta",
};

function parseClassifiedDoc(obj: any): ClassifiedDocument {
  const categoria = VALID_CATEGORIES.includes(obj.categoria) ? obj.categoria : "non_pertinente";
  return {
    categoria,
    persona_nome: obj.persona_nome ?? null,
    persona_cognome: obj.persona_cognome ?? null,
    mese: obj.mese ?? null,
    progetto_nome: obj.progetto_nome ?? null,
    progetto_codice: obj.progetto_codice ?? null,
    descrizione: obj.descrizione ?? "",
    motivo: obj.motivo ?? "",
  };
}

export async function classifyDocument(filePath: string): Promise<ClassificationResult> {
  const ext = extname(filePath).toLowerCase();

  // For non-PDF files, pre-extract content since Claude CLI's Read tool
  // only reliably handles text and PDF files
  let preExtractedText: string | null = null;
  if (ext !== ".pdf") {
    try {
      const blocks = await readFile(filePath);
      if (blocks?.length) {
        preExtractedText = blocks
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("\n");
        if (!preExtractedText.trim()) preExtractedText = null;
      }
    } catch {
      // Fall through to Claude CLI Read
    }
  }

  const categories = `Categorie possibili:
- "busta_paga": cedolino/busta paga di un lavoratore
- "timecard": foglio presenze / timesheet firmato
- "f24": modello F24 per versamento ritenute/contributi
- "bonifico": ricevuta di bonifico bancario o pagamento stipendio
- "fattura": fattura o notula di un consulente esterno
- "ordine_servizio": ordine di servizio / disposizione incarico interno
- "prospetto_costo_orario": prospetto di calcolo del costo orario
- "lettera_incarico": lettera di incarico per collaboratore esterno
- "cv": curriculum vitae
- "relazione_attivita": relazione sulle attività svolte
- "relazione_finale": relazione finale di progetto
- "dichiarazione_irap": dichiarazione IRAP
- "scheda_finanziaria": scheda finanziaria del progetto
- "registri_presenze": registro presenze corsisti/partecipanti
- "non_pertinente": documento che NON c'entra nulla con la rendicontazione`;

  const jsonFormat = `IMPORTANTE: Controlla se il file contiene PIU' documenti distinti (es. più buste paga di persone diverse, più timecard, più F24).
Indizi di documenti multipli: cambio di persona, cambio di mese, intestazioni ripetute, page break tra documenti diversi.

Se il file contiene PIU' documenti distinti, rispondi con:
{
  "documenti_multipli": true,
  "sotto_documenti": [
    {
      "categoria": "...",
      "persona_nome": "nome (string o null)",
      "persona_cognome": "cognome (string o null)",
      "mese": "YYYY-MM (string o null)",
      "progetto_nome": "... (string o null)",
      "progetto_codice": "... (string o null)",
      "descrizione": "breve descrizione",
      "motivo": "perché questa categoria",
      "pagine": [1, 2]
    },
    ...
  ]
}

Se il file contiene UN SOLO documento, rispondi con:
{
  "documenti_multipli": false,
  "categoria": "...",
  "persona_nome": "nome (string o null)",
  "persona_cognome": "cognome (string o null)",
  "mese": "YYYY-MM (string o null)",
  "progetto_nome": "... (string o null)",
  "progetto_codice": "... (string o null)",
  "descrizione": "breve descrizione",
  "motivo": "perché questa categoria"
}

Rispondi SOLO con il JSON.`;

  let prompt: string;
  let claudeOpts: { allowedTools?: string[] } | undefined;

  if (preExtractedText) {
    prompt = `Classifica il seguente documento.
Questo file ("${filePath}") è stato caricato in un sistema di rendicontazione per progetti di finanziamento europeo/nazionale.

${categories}

--- CONTENUTO DOCUMENTO ---
${preExtractedText}
--- FINE DOCUMENTO ---

${jsonFormat}`;
    claudeOpts = { allowedTools: [] };
  } else {
    prompt = `Leggi il file "${filePath}" usando il tool Read e classificalo.
Questo file è stato caricato in un sistema di rendicontazione per progetti di finanziamento europeo/nazionale.

${categories}

${jsonFormat}`;
  }

  try {
    const raw = await spawnClaude(prompt, claudeOpts);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { documenti_multipli: false, documento: FALLBACK_DOC };
    }
    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.documenti_multipli && Array.isArray(parsed.sotto_documenti) && parsed.sotto_documenti.length > 1) {
      const sotto_documenti: SubDocument[] = parsed.sotto_documenti.map((sd: any) => ({
        ...parseClassifiedDoc(sd),
        pagine: Array.isArray(sd.pagine) ? sd.pagine.filter((p: any) => typeof p === "number" && p >= 1) : [],
      }));
      return { documenti_multipli: true, sotto_documenti };
    }

    // Single document (or multi-doc with only 1 entry)
    const doc = parsed.sotto_documenti?.[0]
      ? parseClassifiedDoc(parsed.sotto_documenti[0])
      : parseClassifiedDoc(parsed);
    return { documenti_multipli: false, documento: doc };
  } catch (err) {
    console.error("[classifyDocument] Error:", err);
    return {
      documenti_multipli: false,
      documento: { ...FALLBACK_DOC, descrizione: "Errore durante la classificazione", motivo: String(err) },
    };
  }
}
