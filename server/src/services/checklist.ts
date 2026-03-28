import { randomUUID } from "crypto";
import type {
  ChecklistRules,
  DocTemplate,
  DocumentoRichiesto,
  Persona,
  RendicontazioneMode,
} from "../../../shared/types.ts";

function getDocsForPersona(persona: Persona, rules: ChecklistRules): DocTemplate[] {
  if (persona.tipo === "esterno") return rules.docs_esterno;
  if (rules.ruoli_con_relazione.includes(persona.ruolo)) return rules.docs_interno_con_relazione;
  return rules.docs_interno;
}

/**
 * Generate the full document checklist for a project.
 * Call this whenever people or months change.
 */
export function generateChecklist(
  progettoId: string,
  persone: Persona[],
  mesi: string[],
  mode: RendicontazioneMode,
  rules: ChecklistRules,
): Omit<DocumentoRichiesto, "created_at">[] {
  const docs: Omit<DocumentoRichiesto, "created_at">[] = [];

  // Per-person documents
  for (const persona of persone) {
    const templates = getDocsForPersona(persona, rules);
    for (const tmpl of templates) {
      if (tmpl.perMese) {
        for (const mese of mesi) {
          docs.push({
            id: randomUUID(),
            progetto_id: progettoId,
            persona_id: persona.id,
            categoria: tmpl.categoria as DocumentoRichiesto["categoria"],
            descrizione: `${tmpl.descrizione} — ${mese}`,
            mese,
            stato: "mancante",
          });
        }
      } else if (tmpl.unaTantum) {
        docs.push({
          id: randomUUID(),
          progetto_id: progettoId,
          persona_id: persona.id,
          categoria: tmpl.categoria as DocumentoRichiesto["categoria"],
          descrizione: tmpl.descrizione,
          stato: "mancante",
        });
      }
    }
  }

  // Project-level documents
  for (const tmpl of rules.docs_progetto) {
    docs.push({
      id: randomUUID(),
      progetto_id: progettoId,
      categoria: tmpl.categoria as DocumentoRichiesto["categoria"],
      descrizione: tmpl.descrizione,
      stato: "mancante",
    });
  }

  // Mode-specific documents
  const modeDocs = rules.docs_per_mode[mode] ?? [];
  for (const tmpl of modeDocs) {
    docs.push({
      id: randomUUID(),
      progetto_id: progettoId,
      categoria: tmpl.categoria as DocumentoRichiesto["categoria"],
      descrizione: tmpl.descrizione,
      stato: "mancante",
    });
  }

  return docs;
}
