import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdirSync, renameSync, existsSync } from "fs";
import { join, resolve } from "path";
import { loadRules } from "./config.js";
import { readFile } from "./reader.js";
import { classify } from "./classifier.js";
import type { FileResult, ConfirmRequest } from "../../shared/types.js";

const ROOT = resolve(import.meta.dirname, "../..");
const CONFIG_PATH = process.env.CONFIG_PATH ?? join(ROOT, "config/rules.yaml");
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? join(ROOT, "output");
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(ROOT, "uploads");

mkdirSync(OUTPUT_DIR, { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });
const app = express();

app.use(cors());
app.use(express.json());

// Pending files: id -> { tempPath, originalName }
const pending = new Map<string, { tempPath: string; originalName: string }>();

app.get("/api/categories", (_req, res) => {
  try {
    const rules = loadRules(CONFIG_PATH);
    res.json(rules.categories);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/upload", upload.array("files"), async (req, res) => {
  try {
    const rules = loadRules(CONFIG_PATH);
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
        ? await classify(contentBlocks, rules, file.originalname)
        : "unclassified";

      pending.set(id, { tempPath: file.path, originalName: file.originalname });
      results.push({ id, filename: file.originalname, category });
    }

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/confirm", (req, res) => {
  try {
    const { results } = req.body as ConfirmRequest;
    const rules = loadRules(CONFIG_PATH);
    const moved: string[] = [];

    for (const result of results) {
      const entry = pending.get(result.id);
      if (!entry || !existsSync(entry.tempPath)) continue;

      const cat = rules.categories.find(
        (c) => c.name.toLowerCase() === result.category.toLowerCase(),
      );
      const folder = cat?.folder ?? "unclassified";
      const destDir = join(OUTPUT_DIR, folder);
      mkdirSync(destDir, { recursive: true });

      renameSync(entry.tempPath, join(destDir, entry.originalName));
      pending.delete(result.id);
      moved.push(entry.originalName);
    }

    res.json({ moved, count: moved.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
