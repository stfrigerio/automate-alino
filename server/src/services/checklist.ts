import { randomUUID } from "crypto";
import type {
  DocumentCategory,
  DocumentoRichiesto,
  Persona,
  RendicontazioneMode,
} from "../../../shared/types.ts";

interface DocTemplate {
  categoria: DocumentCategory;
  descrizione: string;
  perMese: boolean; // if true, one per month
  unaTantum: boolean; // if true, only once per persona
}

const DOCS_INTERNO: DocTemplate[] = [
  { categoria: "ordine_servizio", descrizione: "Ordine di servizio", perMese: false, unaTantum: true },
  { categoria: "prospetto_costo_orario", descrizione: "Prospetto calcolo costo orario", perMese: false, unaTantum: true },
  { categoria: "busta_paga", descrizione: "Busta paga", perMese: true, unaTantum: false },
  { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
  { categoria: "f24", descrizione: "F24 versamento ritenute", perMese: true, unaTantum: false },
  { categoria: "bonifico", descrizione: "Ricevuta bonifico stipendio", perMese: true, unaTantum: false },
];

const DOCS_INTERNO_CON_RELAZIONE: DocTemplate[] = [
  ...DOCS_INTERNO,
  { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
];

const DOCS_ESTERNO: DocTemplate[] = [
  { categoria: "lettera_incarico", descrizione: "Lettera d'incarico", perMese: false, unaTantum: true },
  { categoria: "cv", descrizione: "CV sottoscritto", perMese: false, unaTantum: true },
  { categoria: "fattura", descrizione: "Fattura / Notula", perMese: true, unaTantum: false },
  { categoria: "timecard", descrizione: "Timecard firmata", perMese: true, unaTantum: false },
  { categoria: "f24", descrizione: "F24 ritenute", perMese: true, unaTantum: false },
  { categoria: "bonifico", descrizione: "Ricevuta pagamento", perMese: true, unaTantum: false },
  { categoria: "relazione_attivita", descrizione: "Relazione attività", perMese: false, unaTantum: true },
];

const DOCS_PROGETTO: DocTemplate[] = [
  { categoria: "scheda_finanziaria", descrizione: "Scheda finanziaria validata", perMese: false, unaTantum: true },
  { categoria: "registri_presenze", descrizione: "Copia conforme registri presenze / REC", perMese: false, unaTantum: true },
  { categoria: "relazione_finale", descrizione: "Relazione finale", perMese: false, unaTantum: true },
];

function getDocsForPersona(persona: Persona): DocTemplate[] {
  if (persona.tipo === "esterno") return DOCS_ESTERNO;

  // Internal roles that require a relazione
  const needsRelazione = [
    "tutor_interno",
    "amministrativo",
    "direttore_interno",
    "coordinatore",
    "rendicontatore",
  ];
  if (needsRelazione.includes(persona.ruolo)) return DOCS_INTERNO_CON_RELAZIONE;

  return DOCS_INTERNO;
}

/**
 * Generate the full document checklist for a project.
 * Call this whenever people or months change.
 */
export function generateChecklist(
  progettoId: string,
  persone: Persona[],
  mesi: string[], // YYYY-MM strings
  _mode: RendicontazioneMode,
): Omit<DocumentoRichiesto, "created_at">[] {
  const docs: Omit<DocumentoRichiesto, "created_at">[] = [];

  // Per-person documents
  for (const persona of persone) {
    const templates = getDocsForPersona(persona);
    for (const tmpl of templates) {
      if (tmpl.perMese) {
        for (const mese of mesi) {
          docs.push({
            id: randomUUID(),
            progetto_id: progettoId,
            persona_id: persona.id,
            categoria: tmpl.categoria,
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
          categoria: tmpl.categoria,
          descrizione: tmpl.descrizione,
          stato: "mancante",
        });
      }
    }
  }

  // Project-level documents
  for (const tmpl of DOCS_PROGETTO) {
    docs.push({
      id: randomUUID(),
      progetto_id: progettoId,
      categoria: tmpl.categoria,
      descrizione: tmpl.descrizione,
      stato: "mancante",
    });
  }

  // Add IRAP declaration for costi_reali
  if (_mode === "costi_reali") {
    docs.push({
      id: randomUUID(),
      progetto_id: progettoId,
      categoria: "dichiarazione_irap",
      descrizione: "Dichiarazione IRAP",
      stato: "mancante",
    });
  }

  return docs;
}
