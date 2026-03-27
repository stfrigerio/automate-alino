import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdirSync, renameSync, existsSync } from "fs";
import { join } from "path";
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectDir,
  PROJECTS_DIR,
} from "./storage.js";
import { readFile } from "./reader.js";
import { classify } from "./classifier.js";
import type { FileResult, ConfirmRequest, CreateProjectRequest } from "../../shared/types.js";

const app = express();
app.use(cors());
app.use(express.json());

// Pending files: id -> { tempPath, originalName }
const pending = new Map<string, { tempPath: string; originalName: string }>();

// --- Projects ---

app.get("/api/projects", (_req, res) => {
  res.json(getProjects());
});

app.get("/api/projects/:id", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

app.post("/api/projects", (req, res) => {
  const data = req.body as CreateProjectRequest;
  const project = createProject(data);
  res.status(201).json(project);
});

app.put("/api/projects/:id", (req, res) => {
  try {
    const project = updateProject(req.params.id, req.body);
    res.json(project);
  } catch {
    res.status(404).json({ error: "Project not found" });
  }
});

app.delete("/api/projects/:id", (req, res) => {
  deleteProject(req.params.id);
  res.json({ ok: true });
});

// --- Logo upload ---

app.post(
  "/api/projects/:id/logo",
  multer({ dest: join(PROJECTS_DIR, "tmp") }).single("logo"),
  (req, res) => {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const ext = file.originalname.split(".").pop() ?? "png";
    const logoName = `logo.${ext}`;
    const dest = join(getProjectDir(project.id), logoName);
    mkdirSync(getProjectDir(project.id), { recursive: true });
    renameSync(file.path, dest);
    const updated = updateProject(project.id, { logo: logoName });
    res.json(updated);
  },
);

// --- Document upload & classify ---

const uploadStorage = multer({ dest: join(PROJECTS_DIR, "tmp") });

app.post(
  "/api/projects/:id/upload",
  uploadStorage.array("files"),
  async (req, res) => {
    const project = getProject(req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      res.status(400).json({ error: "No files provided" });
      return;
    }

    const results: FileResult[] = [];

    for (const file of files) {
      const id = randomUUID();
      const contentBlocks = await readFile(file.path);
      const category = contentBlocks
        ? await classify(contentBlocks, project.workers, file.originalname)
        : "unclassified";

      pending.set(id, { tempPath: file.path, originalName: file.originalname });
      results.push({ id, filename: file.originalname, category });
    }

    res.json(results);
  },
);

// --- Confirm & file ---

app.post("/api/projects/:id/confirm", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const { results } = req.body as ConfirmRequest;
  const moved: string[] = [];

  for (const result of results) {
    const entry = pending.get(result.id);
    if (!entry || !existsSync(entry.tempPath)) continue;

    const worker = project.workers.find(
      (w) => w.name.toLowerCase() === result.category.toLowerCase(),
    );
    const folder = worker
      ? worker.name.toLowerCase().replace(/\s+/g, "_")
      : "unclassified";

    const destDir = join(getProjectDir(project.id), "output", folder);
    mkdirSync(destDir, { recursive: true });
    renameSync(entry.tempPath, join(destDir, entry.originalName));

    pending.delete(result.id);
    moved.push(entry.originalName);
  }

  res.json({ moved, count: moved.length });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
