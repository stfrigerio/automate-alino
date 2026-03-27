import type { FileResult, Category } from "../types";

const API = "/api";

export async function uploadFiles(files: File[]): Promise<FileResult[]> {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));

  const res = await fetch(`${API}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API}/categories`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmResults(
  results: FileResult[],
): Promise<{ moved: string[]; count: number }> {
  const res = await fetch(`${API}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
