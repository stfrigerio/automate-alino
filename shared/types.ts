// --- Checklist Rules ---

export interface DocTemplate {
  categoria: string;
  descrizione: string;
  perMese: boolean;
  unaTantum: boolean;
}

export interface ChecklistRules {
  docs_interno: DocTemplate[];
  docs_interno_con_relazione: DocTemplate[];
  ruoli_con_relazione: string[];
  docs_esterno: DocTemplate[];
  docs_progetto: DocTemplate[];
  docs_per_mode: Record<string, DocTemplate[]>;
}

export interface Tipologia {
  id: string;
  nome: string;
  codice: string;
  builtin: number;
  descrizione: string;
  regole_json: string;
  source_pdf_path?: string;
  created_at: string;
}

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
  | "registri_presenze"
  | "non_pertinente";

export type CategoriaOreNonProgetto =
  | "riunioni"
  | "formazione"
  | "malattia"
  | "ferie"
  | "permessi"
  | "altro";

// --- Entities ---

export interface Project {
  id: string;
  nome: string;
  codice_progetto: string;
  denominazione_attivita: string;
  ente_agenzia: string;
  modalita_rendicontazione: RendicontazioneMode;
  tipologia_id?: string;
  tipologia_nome?: string;
  data_inizio: string;
  data_fine: string;
  loghi: string[];
  color?: string;
  created_at: string;
}

export interface Lavoratore {
  id: string;
  nome: string;
  cognome: string;
  codice_fiscale?: string;
  created_at: string;
}

export interface Persona {
  id: string;
  progetto_id: string;
  lavoratore_id?: string;
  nome: string;
  cognome: string;
  ruolo: RuoloPersonale;
  tipo: TipoPersonale;
  numero_incarico?: string;
  costo_orario?: number;
  ore_previste?: number;
  created_at: string;
}

export interface OreGiornaliere {
  giorno: number;
  ordinarie: number;
  straordinario: number;
  assenza: number;
}

export interface DettaglioOre {
  ore_ordinarie?: number;
  ore_straordinario?: number;
  ore_festivita?: number;
  ore_assenza?: number;
}

export interface BustaPaga {
  id: string;
  lavoratore_id?: string;
  persona_id?: string;
  progetto_id?: string;
  mese: string;
  file_path: string;
  file_name: string;
  ore_estratte?: number;
  costo_orario_estratto?: number;
  totale_estratto?: number;
  nome_estratto?: string;
  cognome_estratto?: string;
  ore_giornaliere?: string;
  dettaglio_ore?: string;
  stato_parsing: ParsingStatus;
  created_at: string;
}

export interface AllocazioneOre {
  id: string;
  busta_paga_id: string;
  progetto_id: string;
  persona_id: string;
  ore: number;
  note?: string;
  created_at: string;
}

export interface OreNonProgetto {
  id: string;
  busta_paga_id: string;
  categoria: CategoriaOreNonProgetto;
  ore: number;
  note?: string;
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
  tipologia_id?: string;
  data_inizio: string;
  data_fine: string;
  color?: string;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {}

export interface CreateLavoratoreRequest {
  nome: string;
  cognome: string;
  codice_fiscale?: string;
}

export interface CreatePersonaRequest {
  nome: string;
  cognome: string;
  ruolo: RuoloPersonale;
  numero_incarico?: string;
  costo_orario?: number;
  ore_previste?: number;
  lavoratore_id?: string;
}

export interface UpdateBustaPagaRequest {
  lavoratore_id?: string;
  mese?: string;
  ore_estratte?: number;
  stato_parsing?: ParsingStatus;
}

export interface SaveAllocazioniRequest {
  allocazioni: { progetto_id: string; persona_id: string; ore: number; note?: string }[];
  ore_non_progetto: { categoria: CategoriaOreNonProgetto; ore: number; note?: string }[];
}

export interface AllocationSuggestion {
  allocazioni: { progetto_id: string; ore: number; motivazione: string }[];
  ore_non_progetto: { categoria: CategoriaOreNonProgetto; ore: number; motivazione: string }[];
  nota: string;
}

export interface UpdateTimecardRequest {
  righe?: TimecardRiga[];
  stato?: TimecardStatus;
}

export interface AllocazioneGiornaliera {
  id: string;
  busta_paga_id: string;
  progetto_id?: string;
  persona_id?: string;
  categoria_non_progetto?: CategoriaOreNonProgetto;
  giorno: number;
  ore: number;
  created_at: string;
}

export interface SaveAllocazioniGiornaliereRequest {
  allocazioni: {
    giorno: number;
    ore: number;
    progetto_id?: string;
    persona_id?: string;
    categoria_non_progetto?: CategoriaOreNonProgetto;
  }[];
}
