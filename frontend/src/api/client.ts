import type {
  Project,
  CreateProjectRequest,
  Persona,
  CreatePersonaRequest,
  Lavoratore,
  CreateLavoratoreRequest,
  BustaPaga,
  UpdateBustaPagaRequest,
  AllocazioneOre,
  OreNonProgetto,
  SaveAllocazioniRequest,
  AllocationSuggestion,
  AllocazioneGiornaliera,
  SaveAllocazioniGiornaliereRequest,
  Timecard,
  UpdateTimecardRequest,
  DocumentoRichiesto,
  Tipologia,
} from "../types";

const API = "/api";

async function request<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

// --- Settings ---

export type ClaudeModel = "haiku" | "sonnet" | "opus";
export interface AppSettings { model: ClaudeModel; }

export const getAppSettings = () => request<AppSettings>(`${API}/settings`);
export const updateAppSettings = (model: ClaudeModel) =>
  request<AppSettings>(`${API}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });

// --- Tipologie ---

export const getTipologie = () => request<Tipologia[]>(`${API}/tipologie`);

export const createCustomTipologia = (nome: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("nome", nome);
  return request<Tipologia>(`${API}/tipologie/custom`, { method: "POST", body: fd });
};

// --- Projects ---

export const getProjects = () => request<Project[]>(`${API}/projects`);

export const getProject = (id: string) => request<Project>(`${API}/projects/${id}`);

export const createProject = (data: CreateProjectRequest) =>
  request<Project>(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updateProject = (id: string, data: Partial<CreateProjectRequest>) =>
  request<Project>(`${API}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteProject = (id: string) =>
  request<{ ok: boolean }>(`${API}/projects/${id}`, { method: "DELETE" });

export const uploadLogos = (projectId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("logos", f));
  return request<{ loghi: string[] }>(`${API}/projects/${projectId}/logos`, {
    method: "POST",
    body: fd,
  });
};

export const logoUrl = (projectId: string, filename: string) =>
  `${API}/projects/${projectId}/logos/${filename}`;

// --- Persone ---

export const getPersone = (projectId: string) =>
  request<Persona[]>(`${API}/projects/${projectId}/persone`);

export const createPersona = (projectId: string, data: CreatePersonaRequest) =>
  request<Persona>(`${API}/projects/${projectId}/persone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const updatePersona = (projectId: string, personaId: string, data: Partial<CreatePersonaRequest>) =>
  request<Persona>(`${API}/projects/${projectId}/persone/${personaId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deletePersona = (projectId: string, personaId: string) =>
  request<{ ok: boolean }>(`${API}/projects/${projectId}/persone/${personaId}`, {
    method: "DELETE",
  });

// --- Buste Paga ---

export const getBustePaga = (projectId: string) =>
  request<BustaPaga[]>(`${API}/projects/${projectId}/buste-paga`);

export const uploadBustePaga = (projectId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return request<(BustaPaga & { match_confidence?: string })[]>(
    `${API}/projects/${projectId}/buste-paga`,
    { method: "POST", body: fd },
  );
};

export const updateBustaPaga = (projectId: string, bpId: string, data: UpdateBustaPagaRequest) =>
  request<BustaPaga>(`${API}/projects/${projectId}/buste-paga/${bpId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteBustaPaga = (projectId: string, bpId: string) =>
  request<{ ok: boolean }>(`${API}/projects/${projectId}/buste-paga/${bpId}`, {
    method: "DELETE",
  });

// --- Timecards ---

export const getTimecards = (projectId: string) =>
  request<(Timecard & { persona_nome: string; persona_cognome: string })[]>(
    `${API}/projects/${projectId}/timecards`,
  );

export const getTimecard = (projectId: string, tcId: string) =>
  request<Timecard & { persona_nome: string; persona_cognome: string; numero_incarico?: string }>(
    `${API}/projects/${projectId}/timecards/${tcId}`,
  );

export const updateTimecard = (projectId: string, tcId: string, data: UpdateTimecardRequest) =>
  request<Timecard>(`${API}/projects/${projectId}/timecards/${tcId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// --- Documenti ---

export const getDocumenti = (projectId: string) =>
  request<DocumentoRichiesto[]>(`${API}/projects/${projectId}/documenti`);

export const generaChecklist = (projectId: string) =>
  request<DocumentoRichiesto[]>(`${API}/projects/${projectId}/documenti/genera`, {
    method: "POST",
  });

export const uploadDocumento = (projectId: string, docId: string, file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return request<DocumentoRichiesto>(
    `${API}/projects/${projectId}/documenti/${docId}/upload`,
    { method: "POST", body: fd },
  );
};

export const deleteDocumento = (projectId: string, docId: string) =>
  request<{ ok: boolean }>(`${API}/projects/${projectId}/documenti/${docId}`, {
    method: "DELETE",
  });

export const uploadDocumentiBulk = (projectId: string, files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return request<(DocumentoRichiesto & {
    motivo?: string;
    match_confidence?: string;
    progetto_mismatch?: { nome_doc: string | null; codice_doc: string | null };
    fuori_periodo?: { mese_doc: string; data_inizio: string; data_fine: string };
    split_from?: string;
    unknown_person?: { nome: string; cognome: string };
  })[]>(
    `${API}/projects/${projectId}/documenti/upload-bulk`,
    { method: "POST", body: fd },
  );
};

export const linkDocumentoPersona = (projectId: string, docId: string, personaId: string) =>
  request<DocumentoRichiesto>(`${API}/projects/${projectId}/documenti/${docId}/link-persona`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona_id: personaId }),
  });

// --- Lavoratori ---

export const getLavoratori = () =>
  request<(Lavoratore & { num_progetti: number; num_buste_paga: number })[]>(`${API}/lavoratori`);

export const getLavoratore = (id: string) =>
  request<Lavoratore & { progetti: { id: string; progetto_nome: string; codice_progetto: string; color?: string; persona_id: string; ruolo: string; costo_orario: number | null }[] }>(
    `${API}/lavoratori/${id}`,
  );

export const createLavoratore = (data: CreateLavoratoreRequest) =>
  request<Lavoratore>(`${API}/lavoratori`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

export const deleteLavoratore = (id: string) =>
  request<{ ok: boolean }>(`${API}/lavoratori/${id}`, { method: "DELETE" });

// --- Global Buste Paga ---

export const getGlobalBustePaga = (filters?: { lavoratore_id?: string; mese?: string }) => {
  const params = new URLSearchParams();
  if (filters?.lavoratore_id) params.set("lavoratore_id", filters.lavoratore_id);
  if (filters?.mese) params.set("mese", filters.mese);
  const qs = params.toString();
  return request<(BustaPaga & { lavoratore_nome?: string; lavoratore_cognome?: string; ore_allocate: number; ore_non_progetto: number })[]>(
    `${API}/buste-paga${qs ? `?${qs}` : ""}`,
  );
};

export const getGlobalBustaPaga = (id: string) =>
  request<BustaPaga & {
    lavoratore_nome?: string; lavoratore_cognome?: string;
    allocazioni: (AllocazioneOre & { progetto_nome: string; codice_progetto: string })[];
    ore_non_progetto: OreNonProgetto[];
  }>(`${API}/buste-paga/${id}`);

export const uploadGlobalBustePaga = (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return request<(BustaPaga & { match_confidence?: string })[]>(`${API}/buste-paga`, { method: "POST", body: fd });
};

export const deleteGlobalBustaPaga = (id: string) =>
  request<{ ok: boolean }>(`${API}/buste-paga/${id}`, { method: "DELETE" });

// --- Allocazioni ---

export const getAllocazioni = (bpId: string) =>
  request<{ allocazioni: AllocazioneOre[]; ore_non_progetto: OreNonProgetto[] }>(
    `${API}/buste-paga/${bpId}/allocazioni`,
  );

export const saveAllocazioni = (bpId: string, data: SaveAllocazioniRequest) =>
  request<{ allocazioni: AllocazioneOre[]; ore_non_progetto: OreNonProgetto[] }>(
    `${API}/buste-paga/${bpId}/allocazioni`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) },
  );

export const suggestAllocazione = (bpId: string) =>
  request<AllocationSuggestion>(`${API}/buste-paga/${bpId}/suggerisci-allocazione`, { method: "POST" });

export const getGiornaliere = (bpId: string) =>
  request<AllocazioneGiornaliera[]>(`${API}/buste-paga/${bpId}/allocazioni-giornaliere`);

export const saveGiornaliere = (bpId: string, data: SaveAllocazioniGiornaliereRequest) =>
  request<AllocazioneGiornaliera[]>(`${API}/buste-paga/${bpId}/allocazioni-giornaliere`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// --- Document Triage ---

export interface TriageResult {
  id: string;
  file_name: string;
  file_path: string;
  categoria: string;
  persona_nome: string | null;
  persona_cognome: string | null;
  mese: string | null;
  progetto_nome_doc: string | null;
  progetto_codice_doc: string | null;
  matched_project_id: string | null;
  matched_project_nome: string | null;
  matched_lavoratore_id: string | null;
  matched_lavoratore_nome: string | null;
  needs_action: "none" | "project_not_found" | "assign_project" | "external_busta_paga";
  motivo: string;
  esito: "pending" | "auto_assegnato" | "assegnato_manuale" | "non_pertinente" | "ignorato" | "errore";
  committed_project_id: string | null;
  status: "pending" | "done";
  created_at: string;
}

export const triageDocuments = (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return request<{ items: TriageResult[] }>(`${API}/documenti/triage`, { method: "POST", body: fd });
};

export const triageStatus = (ids: string[]) =>
  request<TriageResult[]>(`${API}/documenti/triage/status?ids=${ids.join(",")}`);

export const triageHistory = () =>
  request<TriageResult[]>(`${API}/documenti/triage/history`);

export const linkTriageLavoratore = (id: string, lavoratoreId: string) =>
  request<{ ok: boolean }>(`${API}/documenti/triage/${id}/link-lavoratore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lavoratore_id: lavoratoreId }),
  });

export const dismissTriageDocument = (id: string) =>
  request<{ ok: boolean }>(`${API}/documenti/triage/${id}/dismiss`, { method: "POST" });

export const deleteTriageDocument = (id: string) =>
  request<{ ok: boolean }>(`${API}/documenti/triage/${id}`, { method: "DELETE" });

export const bulkDeleteTriageDocuments = (ids: string[]) =>
  request<{ ok: boolean; deleted: number }>(`${API}/documenti/triage/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

export const assignTriageProject = (id: string, projectId: string) =>
  request<{ ok: boolean }>(`${API}/documenti/triage/${id}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId }),
  });

export const triageFileUrl = (id: string) => `${API}/documenti/triage/${id}/file`;

export const commitTriageDocument = (id: string, data: {
  file_path: string;
  file_name: string;
  categoria: string;
  mese?: string | null;
  persona_nome?: string | null;
  persona_cognome?: string | null;
  project_id?: string | null;
  lavoratore_id?: string | null;
}) =>
  request<{ ok: boolean }>(`${API}/documenti/triage/${id}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// --- Stats ---

export interface ProjectStats {
  persone: number;
  buste_paga: number;
  timecards: number;
  documenti_totali: number;
  documenti_mancanti: number;
  documenti_caricati: number;
  completezza: number;
}

export const getProjectStats = (projectId: string) =>
  request<ProjectStats>(`${API}/projects/${projectId}/stats`);
