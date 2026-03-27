import type {
  Project,
  CreateProjectRequest,
  FileResult,
  ConfirmResponse,
} from "../types";

const API = "/api";

// --- Projects ---

export async function getProjects(): Promise<Project[]> {
  const res = await fetch(`${API}/projects`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${API}/projects/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createProject(
  data: CreateProjectRequest,
): Promise<Project> {
  const res = await fetch(`${API}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadLogo(
  projectId: string,
  file: File,
): Promise<Project> {
  const formData = new FormData();
  formData.append("logo", file);
  const res = await fetch(`${API}/projects/${projectId}/logo`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API}/projects/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

// --- Documents ---

export async function uploadFiles(
  projectId: string,
  files: File[],
): Promise<FileResult[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const res = await fetch(`${API}/projects/${projectId}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmResults(
  projectId: string,
  results: FileResult[],
): Promise<ConfirmResponse> {
  const res = await fetch(`${API}/projects/${projectId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
