import type {
  Project,
  CreateProjectRequest,
  Persona,
  CreatePersonaRequest,
  BustaPaga,
  UpdateBustaPagaRequest,
  Timecard,
  UpdateTimecardRequest,
  DocumentoRichiesto,
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
