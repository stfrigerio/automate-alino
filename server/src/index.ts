import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdirSync, existsSync, renameSync, unlinkSync, readdirSync, statSync } from "fs";
import { join } from "path";
import db from "./db.js";
import { parsePayslip, matchPersona } from "./services/parser.js";
import { generateChecklist } from "./services/checklist.js";
import { tipoFromRuolo } from "./helpers.js";
import type {
  CreateProjectRequest,
  CreatePersonaRequest,
  UpdateBustaPagaRequest,
  UpdateTimecardRequest,
  Persona,
  BustaPaga,
  Timecard,
  DocumentoRichiesto,
  Project,
} from "../../shared/types.ts";

const ROOT = join(import.meta.dirname, "../..");
const DATA_DIR = join(ROOT, "data");
const UPLOADS_DIR = join(DATA_DIR, "uploads");
const PROJECTS_DIR = join(DATA_DIR, "projects");
mkdirSync(UPLOADS_DIR, { recursive: true });
mkdirSync(PROJECTS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });
const app = express();
app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────────────────
// PROJECTS
// ──────────────────────────────────────────────────────────

app.get("/api/projects", (_req, res) => {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as Project[];
  res.json(rows.map((r) => ({ ...r, loghi: JSON.parse(r.loghi as unknown as string) })));
});

app.get("/api/projects/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as Project | undefined;
  if (!row) { res.status(404).json({ error: "Progetto non trovato" }); return; }
  res.json({ ...row, loghi: JSON.parse(row.loghi as unknown as string) });
});

app.post("/api/projects", (req, res) => {
  const data = req.body as CreateProjectRequest;
  const id = randomUUID();
  db.prepare(`
    INSERT INTO projects (id, nome, codice_progetto, denominazione_attivita, ente_agenzia, modalita_rendicontazione, data_inizio, data_fine)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.nome, data.codice_progetto, data.denominazione_attivita ?? "", data.ente_agenzia ?? "", data.modalita_rendicontazione, data.data_inizio, data.data_fine);

  mkdirSync(join(PROJECTS_DIR, id, "output"), { recursive: true });
  mkdirSync(join(PROJECTS_DIR, id, "logos"), { recursive: true });
  mkdirSync(join(PROJECTS_DIR, id, "buste_paga"), { recursive: true });

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project;
  res.status(201).json({ ...project, loghi: JSON.parse(project.loghi as unknown as string) });
});

app.put("/api/projects/:id", (req, res) => {
  const fields = req.body as Partial<CreateProjectRequest>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) { res.status(400).json({ error: "Nessun campo da aggiornare" }); return; }
  vals.push(req.params.id);
  db.prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as Project;
  res.json({ ...project, loghi: JSON.parse(project.loghi as unknown as string) });
});

app.delete("/api/projects/:id", (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Logo upload
app.post("/api/projects/:id/logos", upload.array("logos"), (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as Project | undefined;
  if (!project) { res.status(404).json({ error: "Progetto non trovato" }); return; }

  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "Nessun file" }); return; }

  const logoDir = join(PROJECTS_DIR, project.id, "logos");
  mkdirSync(logoDir, { recursive: true });

  const existing: string[] = JSON.parse(project.loghi as unknown as string);
  for (const file of files) {
    const ext = file.originalname.split(".").pop() ?? "png";
    const name = `logo_${existing.length + 1}.${ext}`;
    renameSync(file.path, join(logoDir, name));
    existing.push(name);
  }
  db.prepare("UPDATE projects SET loghi = ? WHERE id = ?").run(JSON.stringify(existing), project.id);
  res.json({ loghi: existing });
});

// Serve logo files
app.get("/api/projects/:id/logos/:filename", (req, res) => {
  const filePath = join(PROJECTS_DIR, req.params.id, "logos", req.params.filename);
  if (!existsSync(filePath)) { res.status(404).json({ error: "Logo non trovato" }); return; }
  res.sendFile(filePath);
});

// ──────────────────────────────────────────────────────────
// PERSONE
// ──────────────────────────────────────────────────────────

app.get("/api/projects/:id/persone", (req, res) => {
  const rows = db.prepare("SELECT * FROM persone WHERE progetto_id = ? ORDER BY cognome, nome").all(req.params.id);
  res.json(rows);
});

app.post("/api/projects/:id/persone", (req, res) => {
  const data = req.body as CreatePersonaRequest;
  const id = randomUUID();
  const tipo = tipoFromRuolo(data.ruolo);
  db.prepare(`
    INSERT INTO persone (id, progetto_id, nome, cognome, ruolo, tipo, numero_incarico, costo_orario)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, data.nome, data.cognome, data.ruolo, tipo, data.numero_incarico ?? null, data.costo_orario ?? null);
  const persona = db.prepare("SELECT * FROM persone WHERE id = ?").get(id);
  res.status(201).json(persona);
});

app.put("/api/projects/:projId/persone/:personaId", (req, res) => {
  const data = req.body as Partial<CreatePersonaRequest>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (data.ruolo) {
    sets.push("tipo = ?");
    vals.push(tipoFromRuolo(data.ruolo));
  }
  vals.push(req.params.personaId);
  db.prepare(`UPDATE persone SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  const persona = db.prepare("SELECT * FROM persone WHERE id = ?").get(req.params.personaId);
  res.json(persona);
});

app.delete("/api/projects/:projId/persone/:personaId", (req, res) => {
  db.prepare("DELETE FROM persone WHERE id = ?").run(req.params.personaId);
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────
// BUSTE PAGA
// ──────────────────────────────────────────────────────────

app.get("/api/projects/:id/buste-paga", (req, res) => {
  const rows = db.prepare("SELECT * FROM buste_paga WHERE progetto_id = ? ORDER BY mese, created_at").all(req.params.id);
  res.json(rows);
});

app.post("/api/projects/:id/buste-paga", upload.array("files"), async (req, res) => {
  const progettoId = req.params.id as string;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(progettoId) as Project | undefined;
  if (!project) { res.status(404).json({ error: "Progetto non trovato" }); return; }

  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "Nessun file" }); return; }

  const persone = db.prepare("SELECT * FROM persone WHERE progetto_id = ?").all(progettoId) as Persona[];
  const bpDir = join(PROJECTS_DIR, progettoId, "buste_paga");
  mkdirSync(bpDir, { recursive: true });

  const results: (BustaPaga & { match_confidence?: string })[] = [];

  for (const file of files) {
    const id = randomUUID();
    const destPath = join(bpDir, `${id}_${file.originalname}`);
    renameSync(file.path, destPath);

    // Parse with Claude
    let parsed;
    try {
      parsed = await parsePayslip(destPath);
    } catch {
      parsed = { nome: null, cognome: null, mese: null, ore_lavorate: null };
    }

    // Try to match to a person
    const match = matchPersona(parsed.nome, parsed.cognome, persone);

    const stato = match.confidence === "exact" ? "ok"
      : match.confidence === "partial" ? "revisione_manuale"
      : parsed.nome || parsed.ore_lavorate ? "revisione_manuale"
      : "errore";

    db.prepare(`
      INSERT INTO buste_paga (id, progetto_id, persona_id, mese, file_path, file_name, ore_estratte, nome_estratto, cognome_estratto, stato_parsing)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, progettoId,
      match.personaId,
      parsed.mese ?? "",
      destPath,
      file.originalname,
      parsed.ore_lavorate,
      parsed.nome,
      parsed.cognome,
      stato,
    );

    const row = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(id) as BustaPaga;
    results.push({ ...row, match_confidence: match.confidence });
  }

  // Auto-create timecards for matched payslips
  for (const bp of results) {
    if (bp.persona_id && bp.mese && bp.ore_estratte) {
      const existing = db.prepare(
        "SELECT id FROM timecards WHERE persona_id = ? AND progetto_id = ? AND mese = ?",
      ).get(bp.persona_id, progettoId, bp.mese);
      if (!existing) {
        db.prepare(`
          INSERT INTO timecards (id, persona_id, progetto_id, mese, ore_totali)
          VALUES (?, ?, ?, ?, ?)
        `).run(randomUUID(), bp.persona_id, progettoId, bp.mese, bp.ore_estratte);
      }
    }
  }

  res.json(results);
});

app.put("/api/projects/:projId/buste-paga/:bpId", (req, res) => {
  const data = req.body as UpdateBustaPagaRequest;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
  }
  vals.push(req.params.bpId);
  db.prepare(`UPDATE buste_paga SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  // If matching to a person, auto-create timecard
  if (data.persona_id) {
    const bp = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(req.params.bpId) as BustaPaga;
    if (bp.mese && bp.ore_estratte) {
      const existing = db.prepare(
        "SELECT id FROM timecards WHERE persona_id = ? AND progetto_id = ? AND mese = ?",
      ).get(bp.persona_id, bp.progetto_id, bp.mese);
      if (!existing) {
        db.prepare(`
          INSERT INTO timecards (id, persona_id, progetto_id, mese, ore_totali)
          VALUES (?, ?, ?, ?, ?)
        `).run(randomUUID(), bp.persona_id, bp.progetto_id, bp.mese, bp.ore_estratte);
      }
    }
  }

  const row = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(req.params.bpId);
  res.json(row);
});

// ──────────────────────────────────────────────────────────
// TIMECARDS
// ──────────────────────────────────────────────────────────

app.get("/api/projects/:id/timecards", (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, p.nome as persona_nome, p.cognome as persona_cognome
    FROM timecards t
    JOIN persone p ON t.persona_id = p.id
    WHERE t.progetto_id = ?
    ORDER BY t.mese, p.cognome
  `).all(req.params.id);
  res.json(rows.map((r: any) => ({ ...r, righe: JSON.parse(r.righe) })));
});

app.get("/api/projects/:projId/timecards/:tcId", (req, res) => {
  const row = db.prepare(`
    SELECT t.*, p.nome as persona_nome, p.cognome as persona_cognome, p.numero_incarico
    FROM timecards t
    JOIN persone p ON t.persona_id = p.id
    WHERE t.id = ?
  `).get(req.params.tcId) as any;
  if (!row) { res.status(404).json({ error: "Timecard non trovata" }); return; }
  res.json({ ...row, righe: JSON.parse(row.righe) });
});

app.put("/api/projects/:projId/timecards/:tcId", (req, res) => {
  const data = req.body as UpdateTimecardRequest;
  if (data.righe !== undefined) {
    db.prepare("UPDATE timecards SET righe = ? WHERE id = ?")
      .run(JSON.stringify(data.righe), req.params.tcId);
  }
  if (data.stato !== undefined) {
    db.prepare("UPDATE timecards SET stato = ? WHERE id = ?")
      .run(data.stato, req.params.tcId);
  }
  const row = db.prepare("SELECT * FROM timecards WHERE id = ?").get(req.params.tcId) as any;
  res.json({ ...row, righe: JSON.parse(row.righe) });
});

// ──────────────────────────────────────────────────────────
// DOCUMENTI (CHECKLIST)
// ──────────────────────────────────────────────────────────

app.get("/api/projects/:id/documenti", (req, res) => {
  const rows = db.prepare("SELECT * FROM documenti WHERE progetto_id = ? ORDER BY persona_id, categoria, mese").all(req.params.id);
  res.json(rows);
});

// Regenerate checklist based on current people and months
app.post("/api/projects/:id/documenti/genera", (req, res) => {
  const progettoId = req.params.id;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(progettoId) as Project | undefined;
  if (!project) { res.status(404).json({ error: "Progetto non trovato" }); return; }

  const persone = db.prepare("SELECT * FROM persone WHERE progetto_id = ?").all(progettoId) as Persona[];

  // Get all months from uploaded payslips
  const mesiRows = db.prepare(
    "SELECT DISTINCT mese FROM buste_paga WHERE progetto_id = ? AND mese != '' ORDER BY mese",
  ).all(progettoId) as { mese: string }[];
  const mesi = mesiRows.map((r) => r.mese);

  // Delete old auto-generated docs that haven't been uploaded
  db.prepare("DELETE FROM documenti WHERE progetto_id = ? AND stato = 'mancante'").run(progettoId);

  // Generate new checklist
  const docs = generateChecklist(progettoId, persone, mesi, project.modalita_rendicontazione as any);

  const insert = db.prepare(`
    INSERT INTO documenti (id, progetto_id, persona_id, categoria, descrizione, mese, stato)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((items: typeof docs) => {
    for (const d of items) {
      // Check if a document of same type already exists (uploaded)
      const existing = db.prepare(
        "SELECT id FROM documenti WHERE progetto_id = ? AND persona_id IS ? AND categoria = ? AND mese IS ?",
      ).get(d.progetto_id, d.persona_id ?? null, d.categoria, d.mese ?? null);
      if (!existing) {
        insert.run(d.id, d.progetto_id, d.persona_id ?? null, d.categoria, d.descrizione, d.mese ?? null, d.stato);
      }
    }
  });
  insertMany(docs);

  const rows = db.prepare("SELECT * FROM documenti WHERE progetto_id = ? ORDER BY persona_id, categoria, mese").all(progettoId);
  res.json(rows);
});

// Upload a document
app.post("/api/projects/:projId/documenti/:docId/upload", upload.single("file"), (req, res) => {
  const doc = db.prepare("SELECT * FROM documenti WHERE id = ?").get(req.params.docId) as DocumentoRichiesto | undefined;
  if (!doc) { res.status(404).json({ error: "Documento non trovato" }); return; }
  const file = req.file;
  if (!file) { res.status(400).json({ error: "Nessun file" }); return; }

  const docDir = join(PROJECTS_DIR, req.params.projId as string, "documenti");
  mkdirSync(docDir, { recursive: true });
  const dest = join(docDir, `${doc.id}_${file.originalname}`);
  renameSync(file.path, dest);

  db.prepare("UPDATE documenti SET stato = 'caricato', file_path = ?, file_name = ? WHERE id = ?")
    .run(dest, file.originalname, doc.id);

  const row = db.prepare("SELECT * FROM documenti WHERE id = ?").get(doc.id);
  res.json(row);
});

// ──────────────────────────────────────────────────────────
// STATS
// ──────────────────────────────────────────────────────────

app.get("/api/projects/:id/stats", (req, res) => {
  const progettoId = req.params.id;
  const personeCount = (db.prepare("SELECT COUNT(*) as c FROM persone WHERE progetto_id = ?").get(progettoId) as any).c;
  const bpCount = (db.prepare("SELECT COUNT(*) as c FROM buste_paga WHERE progetto_id = ?").get(progettoId) as any).c;
  const tcCount = (db.prepare("SELECT COUNT(*) as c FROM timecards WHERE progetto_id = ?").get(progettoId) as any).c;
  const docsTotal = (db.prepare("SELECT COUNT(*) as c FROM documenti WHERE progetto_id = ?").get(progettoId) as any).c;
  const docsMancanti = (db.prepare("SELECT COUNT(*) as c FROM documenti WHERE progetto_id = ? AND stato = 'mancante'").get(progettoId) as any).c;
  const docsCaricati = (db.prepare("SELECT COUNT(*) as c FROM documenti WHERE progetto_id = ? AND stato != 'mancante'").get(progettoId) as any).c;

  res.json({
    persone: personeCount,
    buste_paga: bpCount,
    timecards: tcCount,
    documenti_totali: docsTotal,
    documenti_mancanti: docsMancanti,
    documenti_caricati: docsCaricati,
    completezza: docsTotal > 0 ? Math.round((docsCaricati / docsTotal) * 100) : 0,
  });
});

// ──────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
