// --- Enums ---

export type RendicontazioneMode = "staff_40" | "forfettario_7" | "costi_reali";

export type RuoloPersonale =
  | "docente_interno"
  | "docente_esterno"
  | "tutor_interno"
  | "tutor_esterno"
  | "coordinatore"
  | "direttore_interno"
  | "direttore_esterno"
  | "amministrativo"
  | "rendicontatore";

export type TipoPersonale = "interno" | "esterno";

export type ParsingStatus = "pending" | "ok" | "errore" | "revisione_manuale";

export type TimecardStatus = "bozza" | "generata" | "firmata";

export type DocumentStatus = "mancante" | "caricato" | "verificato";

export type DocumentCategory =
  | "busta_paga"
  | "timecard"
  | "ordine_servizio"
  | "prospetto_costo_orario"
  | "f24"
  | "bonifico"
  | "lettera_incarico"
  | "fattura"
  | "cv"
  | "relazione_attivita"
  | "relazione_finale"
  | "dichiarazione_irap"
  | "scheda_finanziaria"
  | "registri_presenze";

// --- Entities ---

export interface Project {
  id: string;
  nome: string;
  codice_progetto: string;
  denominazione_attivita: string;
  ente_agenzia: string;
  modalita_rendicontazione: RendicontazioneMode;
  data_inizio: string;
  data_fine: string;
  loghi: string[];
  created_at: string;
}

export interface Persona {
  id: string;
  progetto_id: string;
  nome: string;
  cognome: string;
  ruolo: RuoloPersonale;
  tipo: TipoPersonale;
  numero_incarico?: string;
  costo_orario?: number;
  created_at: string;
}

export interface BustaPaga {
  id: string;
  persona_id?: string;
  progetto_id: string;
  mese: string;
  file_path: string;
  file_name: string;
  ore_estratte?: number;
  nome_estratto?: string;
  cognome_estratto?: string;
  stato_parsing: ParsingStatus;
  created_at: string;
}

export interface TimecardRiga {
  data: string;
  ore: number;
  orario_inizio?: string;
  orario_fine?: string;
  descrizione_attivita?: string;
  sede?: string;
  numero_incarico?: string;
}

export interface Timecard {
  id: string;
  persona_id: string;
  progetto_id: string;
  mese: string;
  righe: TimecardRiga[];
  ore_totali: number;
  stato: TimecardStatus;
  file_pdf_path?: string;
  created_at: string;
}

export interface DocumentoRichiesto {
  id: string;
  progetto_id: string;
  persona_id?: string;
  categoria: DocumentCategory;
  descrizione: string;
  mese?: string;
  stato: DocumentStatus;
  file_path?: string;
  file_name?: string;
  created_at: string;
}

// --- API Requests ---

export interface CreateProjectRequest {
  nome: string;
  codice_progetto: string;
  denominazione_attivita: string;
  ente_agenzia: string;
  modalita_rendicontazione: RendicontazioneMode;
  data_inizio: string;
  data_fine: string;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {}

export interface CreatePersonaRequest {
  nome: string;
  cognome: string;
  ruolo: RuoloPersonale;
  numero_incarico?: string;
  costo_orario?: number;
}

export interface UpdateBustaPagaRequest {
  persona_id?: string;
  mese?: string;
  ore_estratte?: number;
  stato_parsing?: ParsingStatus;
}

export interface UpdateTimecardRequest {
  righe?: TimecardRiga[];
  stato?: TimecardStatus;
}

// --- Helpers ---

const RUOLI_ESTERNI: RuoloPersonale[] = [
  "docente_esterno",
  "tutor_esterno",
  "direttore_esterno",
];

export function tipoFromRuolo(ruolo: RuoloPersonale): TipoPersonale {
  return RUOLI_ESTERNI.includes(ruolo) ? "esterno" : "interno";
}

export const RUOLO_LABELS: Record<RuoloPersonale, string> = {
  docente_interno: "Docente interno",
  docente_esterno: "Docente esterno",
  tutor_interno: "Tutor interno",
  tutor_esterno: "Tutor esterno",
  coordinatore: "Coordinatore",
  direttore_interno: "Direttore progetto interno",
  direttore_esterno: "Direttore progetto esterno",
  amministrativo: "Personale amministrativo",
  rendicontatore: "Rendicontatore",
};

export const RENDICONTAZIONE_LABELS: Record<RendicontazioneMode, string> = {
  staff_40: "Staff + 40%",
  forfettario_7: "Forfettizzazione 7%",
  costi_reali: "Costi reali",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  mancante: "Mancante",
  caricato: "Caricato",
  verificato: "Verificato",
};
