import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Project, CreateProjectRequest } from "../../shared/types.js";

const ROOT = join(import.meta.dirname, "../..");
const DATA_DIR = join(ROOT, "data");
const DB_PATH = join(DATA_DIR, "db.json");
export const PROJECTS_DIR = join(DATA_DIR, "projects");

mkdirSync(PROJECTS_DIR, { recursive: true });

interface DB {
  projects: Project[];
}

function readDB(): DB {
  if (!existsSync(DB_PATH)) return { projects: [] };
  return JSON.parse(readFileSync(DB_PATH, "utf-8"));
}

function writeDB(db: DB): void {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function getProjects(): Project[] {
  return readDB().projects;
}

export function getProject(id: string): Project | undefined {
  return readDB().projects.find((p) => p.id === id);
}

export function createProject(data: CreateProjectRequest): Project {
  const db = readDB();
  const project: Project = {
    id: randomUUID(),
    name: data.name,
    signatories: data.signatories.map((s) => ({ ...s, id: randomUUID() })),
    workers: data.workers.map((w) => ({ ...w, id: randomUUID() })),
    createdAt: new Date().toISOString(),
  };

  mkdirSync(join(PROJECTS_DIR, project.id, "output"), { recursive: true });

  db.projects.push(project);
  writeDB(db);
  return project;
}

export function updateProject(
  id: string,
  updates: Partial<Pick<Project, "name" | "signatories" | "workers" | "logo">>,
): Project {
  const db = readDB();
  const idx = db.projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Project not found");
  db.projects[idx] = { ...db.projects[idx], ...updates };
  writeDB(db);
  return db.projects[idx];
}

export function deleteProject(id: string): void {
  const db = readDB();
  db.projects = db.projects.filter((p) => p.id !== id);
  writeDB(db);
  const dir = join(PROJECTS_DIR, id);
  if (existsSync(dir)) rmSync(dir, { recursive: true });
}

export function getProjectDir(id: string): string {
  return join(PROJECTS_DIR, id);
}
