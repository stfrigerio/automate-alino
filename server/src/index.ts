import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdirSync, existsSync, renameSync, unlinkSync, readdirSync, statSync } from "fs";
import { join } from "path";
import db from "./db.js";
import { parsePayslip, matchPersona, parseRulesPdf } from "./services/parser.js";
import { generateChecklist } from "./services/checklist.js";
import { FSE_PLUS_RULES } from "./services/checklist-rules.js";
import { classifyDocument } from "./services/classifier.js";
import type { ClassifiedDocument } from "./services/classifier.js";
import { suggestAllocation } from "./services/allocator.js";
import { splitPdf } from "./services/pdf-splitter.js";
import { getSettings, updateSettings } from "./services/settings.js";
import type { ClaudeModel } from "./services/settings.js";
import { tipoFromRuolo } from "./helpers.js";
import type {
  CreateProjectRequest,
  CreatePersonaRequest,
  CreateLavoratoreRequest,
  UpdateBustaPagaRequest,
  UpdateTimecardRequest,
  SaveAllocazioniRequest,
  SaveAllocazioniGiornaliereRequest,
  ChecklistRules,
  Persona,
  BustaPaga,
  Lavoratore,
  AllocazioneOre,
  OreNonProgetto,
  Timecard,
  DocumentoRichiesto,
  Project,
  Tipologia,
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
// SETTINGS
// ──────────────────────────────────────────────────────────

app.get("/api/settings", (_req, res) => {
  res.json(getSettings());
});

app.put("/api/settings", (req, res) => {
  const { model } = req.body as { model?: ClaudeModel };
  const valid: ClaudeModel[] = ["haiku", "sonnet", "opus"];
  if (model && !valid.includes(model)) {
    res.status(400).json({ error: "Modello non valido" });
    return;
  }
  res.json(updateSettings({ model }));
});

// ──────────────────────────────────────────────────────────
// TIPOLOGIE
// ──────────────────────────────────────────────────────────

app.get("/api/tipologie", (_req, res) => {
  const rows = db.prepare("SELECT * FROM tipologie ORDER BY builtin DESC, nome").all();
  res.json(rows);
});

app.post("/api/tipologie/custom", upload.single("file"), async (req, res) => {
  const nome = req.body.nome as string;
  if (!nome?.trim()) { res.status(400).json({ error: "Nome obbligatorio" }); return; }
  const file = req.file;
  if (!file) { res.status(400).json({ error: "File PDF obbligatorio" }); return; }

  const pdfDir = join(DATA_DIR, "tipologie_pdf");
  mkdirSync(pdfDir, { recursive: true });
  const pdfPath = join(pdfDir, `${randomUUID()}_${file.originalname}`);
  renameSync(file.path, pdfPath);

  try {
    const rules = await parseRulesPdf(pdfPath);
    const id = randomUUID();
    const codice = `custom_${id.slice(0, 8)}`;
    db.prepare(`
      INSERT INTO tipologie (id, nome, codice, builtin, descrizione, regole_json, source_pdf_path)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `).run(id, nome.trim(), codice, `Regole estratte da ${file.originalname}`, JSON.stringify(rules), pdfPath);
    const row = db.prepare("SELECT * FROM tipologie WHERE id = ?").get(id);
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore estrazione regole" });
  }
});

// ──────────────────────────────────────────────────────────
// LAVORATORI (global internal workers)
// ──────────────────────────────────────────────────────────

app.get("/api/lavoratori", (_req, res) => {
  const rows = db.prepare(`
    SELECT l.*,
      (SELECT COUNT(*) FROM persone p WHERE p.lavoratore_id = l.id) as num_progetti,
      (SELECT COUNT(*) FROM buste_paga bp WHERE bp.lavoratore_id = l.id) as num_buste_paga
    FROM lavoratori l ORDER BY l.cognome, l.nome
  `).all();
  res.json(rows);
});

app.get("/api/lavoratori/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM lavoratori WHERE id = ?").get(req.params.id) as Lavoratore | undefined;
  if (!row) { res.status(404).json({ error: "Lavoratore non trovato" }); return; }
  const progetti = db.prepare(`
    SELECT p.id, p.nome as progetto_nome, p.codice_progetto, p.color, per.id as persona_id, per.ruolo, per.costo_orario
    FROM persone per JOIN projects p ON per.progetto_id = p.id
    WHERE per.lavoratore_id = ?
  `).all(req.params.id);
  res.json({ ...row, progetti });
});

app.post("/api/lavoratori", (req, res) => {
  const data = req.body as CreateLavoratoreRequest;
  const id = randomUUID();
  db.prepare("INSERT INTO lavoratori (id, nome, cognome, codice_fiscale) VALUES (?, ?, ?, ?)")
    .run(id, data.nome, data.cognome, data.codice_fiscale ?? null);
  const row = db.prepare("SELECT * FROM lavoratori WHERE id = ?").get(id);
  res.status(201).json(row);
});

app.put("/api/lavoratori/:id", (req, res) => {
  const data = req.body as Partial<CreateLavoratoreRequest>;
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(data)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) { res.status(400).json({ error: "Nessun campo" }); return; }
  vals.push(req.params.id);
  db.prepare(`UPDATE lavoratori SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  const row = db.prepare("SELECT * FROM lavoratori WHERE id = ?").get(req.params.id);
  res.json(row);
});

app.delete("/api/lavoratori/:id", (req, res) => {
  db.prepare("DELETE FROM lavoratori WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────
// GLOBAL DOCUMENT TRIAGE (home page drop zone)
// ──────────────────────────────────────────────────────────

const TRIAGE_CATEGORY_LABELS: Record<string, string> = {
  busta_paga: "Busta paga", timecard: "Timecard", f24: "F24 versamento ritenute",
  bonifico: "Ricevuta bonifico", fattura: "Fattura / Notula", ordine_servizio: "Ordine di servizio",
  prospetto_costo_orario: "Prospetto calcolo costo orario", lettera_incarico: "Lettera d'incarico",
  cv: "CV sottoscritto", relazione_attivita: "Relazione attività", relazione_finale: "Relazione finale",
  dichiarazione_irap: "Dichiarazione IRAP", scheda_finanziaria: "Scheda finanziaria validata",
  registri_presenze: "Registri presenze", non_pertinente: "Non pertinente",
};

app.post("/api/documenti/triage", upload.array("files"), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "Nessun file" }); return; }

  const uploadDir = join(DATA_DIR, "triage_uploads");
  mkdirSync(uploadDir, { recursive: true });

  const itemIds: string[] = [];

  for (const file of files) {
    const id = randomUUID();
    const destPath = join(uploadDir, `${id}_${file.originalname}`);
    renameSync(file.path, destPath);
    itemIds.push(id);

    db.prepare(`
      INSERT INTO triage_log (id, file_name, file_path, categoria, status, esito)
      VALUES (?, ?, ?, 'pending', 'pending', 'pending')
    `).run(id, file.originalname, destPath);
  }

  const items = itemIds.map((id) => db.prepare("SELECT * FROM triage_log WHERE id = ?").get(id));
  res.json({ items });

  // Process in background
  const allProjects = db.prepare("SELECT * FROM projects").all() as Project[];
  const allLavoratori = db.prepare("SELECT * FROM lavoratori").all() as { id: string; nome: string; cognome: string }[];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  for (const id of itemIds) {
    const row = db.prepare("SELECT * FROM triage_log WHERE id = ?").get(id) as { file_path: string };
    (async () => {
      try {
        const classResult = await classifyDocument(row.file_path);
        const classified = classResult.documenti_multipli
          ? classResult.sotto_documenti?.[0]
          : classResult.documento;
        if (!classified) throw new Error("empty classification");

        let matchedProjectId: string | null = null;
        let matchedProjectNome: string | null = null;
        if (classified.progetto_nome || classified.progetto_codice) {
          for (const p of allProjects) {
            const nameOk = classified.progetto_nome && (norm(p.nome).includes(norm(classified.progetto_nome)) || norm(classified.progetto_nome).includes(norm(p.nome)));
            const codeOk = classified.progetto_codice && (norm(p.codice_progetto).includes(norm(classified.progetto_codice)) || norm(classified.progetto_codice).includes(norm(p.codice_progetto)));
            if (nameOk || codeOk) { matchedProjectId = p.id; matchedProjectNome = p.nome; break; }
          }
        }

        let matchedLavoratoreId: string | null = null;
        let matchedLavoratoreNome: string | null = null;
        if (classified.persona_nome || classified.persona_cognome) {
          const match = matchPersona(classified.persona_nome, classified.persona_cognome, allLavoratori as Persona[]);
          if (match.personaId) {
            matchedLavoratoreId = match.personaId;
            const lav = allLavoratori.find((l) => l.id === match.personaId);
            matchedLavoratoreNome = lav ? `${lav.nome} ${lav.cognome}` : null;
          }
        }

        // For busta_paga: always run parsePayslip and use its results for matching
        if (classified.categoria === "busta_paga") {
          const triageRow = db.prepare("SELECT file_name, file_path FROM triage_log WHERE id = ?").get(id) as { file_name: string; file_path: string };
          try {
            const parsed = await parsePayslip(triageRow.file_path);

            // Use parsePayslip results for more accurate person matching
            if (parsed.nome || parsed.cognome) {
              const payslipMatch = matchPersona(parsed.nome, parsed.cognome, allLavoratori as Persona[]);
              if (payslipMatch.personaId) {
                matchedLavoratoreId = payslipMatch.personaId;
                const lav = allLavoratori.find((l) => l.id === payslipMatch.personaId);
                matchedLavoratoreNome = lav ? `${lav.nome} ${lav.cognome}` : null;
              }
            }

            const finalMese = parsed.mese ?? classified.mese ?? "";
            const esitoBp = matchedLavoratoreId ? "auto_assegnato" : "pending";
            const needsActionBp = matchedLavoratoreId ? "none" : "assign_project";

            db.prepare(`
              UPDATE triage_log SET categoria = ?, persona_nome = ?, persona_cognome = ?, mese = ?,
                progetto_nome_doc = ?, progetto_codice_doc = ?, matched_project_id = ?, matched_project_nome = ?,
                matched_lavoratore_id = ?, matched_lavoratore_nome = ?, needs_action = ?, motivo = ?,
                esito = ?, status = 'done'
              WHERE id = ?
            `).run(
              "busta_paga", parsed.nome ?? classified.persona_nome, parsed.cognome ?? classified.persona_cognome, finalMese,
              classified.progetto_nome, classified.progetto_codice, matchedProjectId, matchedProjectNome,
              matchedLavoratoreId, matchedLavoratoreNome, needsActionBp, classified.motivo,
              esitoBp, id,
            );

            // Insert into buste_paga if we have a matched lavoratore
            if (matchedLavoratoreId) {
              const existingBp = db.prepare(
                "SELECT id FROM buste_paga WHERE lavoratore_id IS ? AND mese = ? AND file_name = ?",
              ).get(matchedLavoratoreId, finalMese, triageRow.file_name) as { id: string } | undefined;
              if (!existingBp) {
                const bpId = randomUUID();
                const oreGiornaliereJson = Array.isArray(parsed.ore_giornaliere) && parsed.ore_giornaliere.length > 0
                  ? JSON.stringify(parsed.ore_giornaliere) : null;
                const dettaglioOreJson = parsed.dettaglio_ore && Object.keys(parsed.dettaglio_ore).length > 0
                  ? JSON.stringify(parsed.dettaglio_ore) : null;
                db.prepare(`
                  INSERT INTO buste_paga (id, lavoratore_id, mese, file_path, file_name, ore_estratte, costo_orario_estratto, totale_estratto, nome_estratto, cognome_estratto, ore_giornaliere, dettaglio_ore, stato_parsing)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')
                `).run(bpId, matchedLavoratoreId, finalMese, triageRow.file_path, triageRow.file_name,
                  parsed.ore_lavorate, parsed.costo_orario, parsed.totale, parsed.nome, parsed.cognome,
                  oreGiornaliereJson, dettaglioOreJson);
              }
            }
          } catch (parseErr) {
            console.error(`[triage] parsePayslip failed for ${id}:`, parseErr);
            // Fall through to generic update below
            db.prepare(`
              UPDATE triage_log SET categoria = 'busta_paga', persona_nome = ?, persona_cognome = ?, mese = ?,
                progetto_nome_doc = ?, progetto_codice_doc = ?, needs_action = 'assign_project', motivo = ?,
                esito = 'errore', status = 'done'
              WHERE id = ?
            `).run(
              classified.persona_nome, classified.persona_cognome, classified.mese,
              classified.progetto_nome, classified.progetto_codice,
              `Errore estrazione: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`, id,
            );
          }
        } else {
          // Non-busta_paga documents
          let needs_action = "none";
          let esito = "pending";
          if ((classified.categoria as string) === "non_pertinente") {
            needs_action = "none";
            esito = "non_pertinente";
          } else if ((classified.progetto_nome || classified.progetto_codice) && !matchedProjectId) {
            needs_action = "project_not_found";
          } else if (!matchedProjectId) {
            needs_action = "assign_project";
          } else {
            esito = "auto_assegnato";
          }

          db.prepare(`
            UPDATE triage_log SET categoria = ?, persona_nome = ?, persona_cognome = ?, mese = ?,
              progetto_nome_doc = ?, progetto_codice_doc = ?, matched_project_id = ?, matched_project_nome = ?,
              matched_lavoratore_id = ?, matched_lavoratore_nome = ?, needs_action = ?, motivo = ?,
              esito = ?, status = 'done'
            WHERE id = ?
          `).run(
            classified.categoria, classified.persona_nome, classified.persona_cognome, classified.mese,
            classified.progetto_nome, classified.progetto_codice, matchedProjectId, matchedProjectNome,
            matchedLavoratoreId, matchedLavoratoreNome, needs_action, classified.motivo,
            esito, id,
          );
        }
      } catch (err) {
        db.prepare(`
          UPDATE triage_log SET categoria = 'non_pertinente', motivo = ?, esito = 'errore', status = 'done' WHERE id = ?
        `).run(`Errore: ${err instanceof Error ? err.message : String(err)}`, id);
      }
    })();
  }
});

app.get("/api/documenti/triage/status", (req, res) => {
  const ids = (req.query.ids as string || "").split(",").filter(Boolean);
  if (!ids.length) { res.json([]); return; }
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM triage_log WHERE id IN (${placeholders})`).all(...ids);
  res.json(rows);
});

app.get("/api/documenti/triage/history", (_req, res) => {
  const rows = db.prepare("SELECT * FROM triage_log ORDER BY created_at DESC LIMIT 100").all();
  res.json(rows);
});

app.post("/api/documenti/triage/:id/commit", express.json(), async (req, res) => {
  const triageId = req.params.id;

  // Fall back to triage_log row for any missing fields
  const triageRow = db.prepare("SELECT * FROM triage_log WHERE id = ?").get(triageId) as any;
  if (!triageRow) { res.status(404).json({ error: "Non trovato" }); return; }

  const file_path = req.body.file_path ?? triageRow.file_path;
  const file_name = req.body.file_name ?? triageRow.file_name;
  const categoria = req.body.categoria ?? triageRow.categoria;
  const mese = req.body.mese ?? triageRow.mese;
  const project_id = req.body.project_id ?? triageRow.matched_project_id;
  const lavoratore_id = req.body.lavoratore_id ?? triageRow.matched_lavoratore_id;

  if (categoria === "busta_paga") {
    let parsed;
    try {
      parsed = await parsePayslip(file_path);
    } catch {
      parsed = { nome: null, cognome: null, mese: null, ore_lavorate: null, costo_orario: null, totale: null, ore_giornaliere: [], dettaglio_ore: {} };
    }

    const finalLavoratoreId = lavoratore_id || null;
    const finalMese = parsed.mese ?? mese ?? "";

    const existingBp = db.prepare(
      "SELECT id FROM buste_paga WHERE lavoratore_id IS ? AND mese = ? AND file_name = ?",
    ).get(finalLavoratoreId, finalMese, file_name) as { id: string } | undefined;

    if (!existingBp) {
      const id = randomUUID();
      const oreGiornaliereJson = Array.isArray(parsed.ore_giornaliere) && parsed.ore_giornaliere.length > 0
        ? JSON.stringify(parsed.ore_giornaliere) : null;
      const dettaglioOreJson = parsed.dettaglio_ore && Object.keys(parsed.dettaglio_ore).length > 0
        ? JSON.stringify(parsed.dettaglio_ore) : null;
      db.prepare(`
        INSERT INTO buste_paga (id, lavoratore_id, progetto_id, mese, file_path, file_name, ore_estratte, costo_orario_estratto, totale_estratto, nome_estratto, cognome_estratto, ore_giornaliere, dettaglio_ore, stato_parsing)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, finalLavoratoreId, project_id || null, finalMese, file_path, file_name,
        parsed.ore_lavorate, parsed.costo_orario, parsed.totale, parsed.nome, parsed.cognome,
        oreGiornaliereJson, dettaglioOreJson,
        finalLavoratoreId ? "ok" : "revisione_manuale");
    }

    db.prepare("UPDATE triage_log SET esito = ?, committed_project_id = ? WHERE id = ?")
      .run(project_id ? "assegnato_manuale" : "auto_assegnato", project_id || null, triageId);
    res.json({ ok: true });
  } else if (project_id) {
    const label = TRIAGE_CATEGORY_LABELS[categoria] ?? categoria;
    const descrizione = mese ? `${label} — ${mese}` : label;
    const id = randomUUID();
    db.prepare(`
      INSERT INTO documenti (id, progetto_id, categoria, descrizione, mese, stato, file_path, file_name)
      VALUES (?, ?, ?, ?, ?, 'caricato', ?, ?)
    `).run(id, project_id, categoria, descrizione, mese ?? null, file_path, file_name);

    db.prepare("UPDATE triage_log SET esito = 'assegnato_manuale', committed_project_id = ? WHERE id = ?")
      .run(project_id, triageId);
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: "project_id richiesto per documenti non busta_paga" });
  }
});

// Link a triage doc to a lavoratore (existing or newly created) and process
app.post("/api/documenti/triage/:id/link-lavoratore", express.json(), async (req, res) => {
  const triageId = req.params.id;
  const { lavoratore_id } = req.body;
  if (!lavoratore_id) { res.status(400).json({ error: "lavoratore_id richiesto" }); return; }

  const triageRow = db.prepare("SELECT * FROM triage_log WHERE id = ?").get(triageId) as any;
  if (!triageRow) { res.status(404).json({ error: "Non trovato" }); return; }

  const lav = db.prepare("SELECT * FROM lavoratori WHERE id = ?").get(lavoratore_id) as { id: string; nome: string; cognome: string } | undefined;
  if (!lav) { res.status(404).json({ error: "Lavoratore non trovato" }); return; }

  // Update triage log with the matched lavoratore
  db.prepare(`
    UPDATE triage_log SET matched_lavoratore_id = ?, matched_lavoratore_nome = ?, needs_action = 'none', esito = 'assegnato_manuale'
    WHERE id = ?
  `).run(lav.id, `${lav.nome} ${lav.cognome}`, triageId);

  // If busta_paga, parse and insert
  if (triageRow.categoria === "busta_paga") {
    try {
      const parsed = await parsePayslip(triageRow.file_path);
      const finalMese = parsed.mese ?? triageRow.mese ?? "";
      const existingBp = db.prepare(
        "SELECT id FROM buste_paga WHERE lavoratore_id IS ? AND mese = ? AND file_name = ?",
      ).get(lav.id, finalMese, triageRow.file_name) as { id: string } | undefined;
      if (!existingBp) {
        const bpId = randomUUID();
        const oreGiornaliereJson = Array.isArray(parsed.ore_giornaliere) && parsed.ore_giornaliere.length > 0
          ? JSON.stringify(parsed.ore_giornaliere) : null;
        const dettaglioOreJson = parsed.dettaglio_ore && Object.keys(parsed.dettaglio_ore).length > 0
          ? JSON.stringify(parsed.dettaglio_ore) : null;
        db.prepare(`
          INSERT INTO buste_paga (id, lavoratore_id, mese, file_path, file_name, ore_estratte, costo_orario_estratto, totale_estratto, nome_estratto, cognome_estratto, ore_giornaliere, dettaglio_ore, stato_parsing)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')
        `).run(bpId, lav.id, finalMese, triageRow.file_path, triageRow.file_name,
          parsed.ore_lavorate, parsed.costo_orario, parsed.totale, parsed.nome, parsed.cognome,
          oreGiornaliereJson, dettaglioOreJson);
      }
    } catch (err) {
      console.error(`[triage] parsePayslip failed for link-lavoratore ${triageId}:`, err);
    }
  }

  res.json({ ok: true });
});

app.post("/api/documenti/triage/:id/dismiss", (req, res) => {
  db.prepare("UPDATE triage_log SET esito = 'ignorato' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.delete("/api/documenti/triage/:id", (req, res) => {
  const row = db.prepare("SELECT file_path FROM triage_log WHERE id = ?").get(req.params.id) as { file_path: string } | undefined;
  if (!row) { res.status(404).json({ error: "Non trovato" }); return; }
  if (row.file_path && existsSync(row.file_path)) unlinkSync(row.file_path);
  db.prepare("DELETE FROM triage_log WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/documenti/triage/bulk-delete", express.json(), (req, res) => {
  const ids = req.body.ids as string[];
  if (!Array.isArray(ids) || !ids.length) { res.status(400).json({ error: "ids richiesti" }); return; }
  const del = db.transaction(() => {
    for (const id of ids) {
      const row = db.prepare("SELECT file_path FROM triage_log WHERE id = ?").get(id) as { file_path: string } | undefined;
      if (row?.file_path && existsSync(row.file_path)) unlinkSync(row.file_path);
      db.prepare("DELETE FROM triage_log WHERE id = ?").run(id);
    }
  });
  del();
  res.json({ ok: true, deleted: ids.length });
});

app.get("/api/documenti/triage/:id/file", async (req, res) => {
  const row = db.prepare("SELECT file_path, file_name FROM triage_log WHERE id = ?").get(req.params.id) as { file_path: string; file_name: string } | undefined;
  if (!row || !existsSync(row.file_path)) { res.status(404).json({ error: "File non trovato" }); return; }

  // Convert docx/doc to HTML for in-browser viewing
  const ext = row.file_name.toLowerCase().split(".").pop();
  if (ext === "docx" || ext === "doc") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.default.convertToHtml({ path: row.file_path });
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:50rem;margin:0 auto;line-height:1.6;color:#333}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:0.5rem}img{max-width:100%}</style></head><body>${result.value}</body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      return;
    } catch { /* fall through to sendFile */ }
  }

  res.sendFile(row.file_path);
});

// ──────────────────────────────────────────────────────────
// GLOBAL BUSTE PAGA
// ──────────────────────────────────────────────────────────

app.get("/api/buste-paga", (req, res) => {
  let sql = `
    SELECT bp.*, l.nome as lavoratore_nome, l.cognome as lavoratore_cognome,
      COALESCE((SELECT SUM(a.ore) FROM allocazioni_ore a WHERE a.busta_paga_id = bp.id), 0) as ore_allocate,
      COALESCE((SELECT SUM(onp.ore) FROM ore_non_progetto onp WHERE onp.busta_paga_id = bp.id), 0) as ore_non_progetto
    FROM buste_paga bp
    LEFT JOIN lavoratori l ON bp.lavoratore_id = l.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (req.query.lavoratore_id) { sql += " AND bp.lavoratore_id = ?"; params.push(req.query.lavoratore_id); }
  if (req.query.mese) { sql += " AND bp.mese = ?"; params.push(req.query.mese); }
  sql += " ORDER BY bp.mese DESC, l.cognome, l.nome";
  res.json(db.prepare(sql).all(...params));
});

app.get("/api/buste-paga/:id", (req, res) => {
  const bp = db.prepare(`
    SELECT bp.*, l.nome as lavoratore_nome, l.cognome as lavoratore_cognome
    FROM buste_paga bp LEFT JOIN lavoratori l ON bp.lavoratore_id = l.id
    WHERE bp.id = ?
  `).get(req.params.id) as (BustaPaga & { lavoratore_nome?: string; lavoratore_cognome?: string }) | undefined;
  if (!bp) { res.status(404).json({ error: "Busta paga non trovata" }); return; }
  const allocazioni = db.prepare(`
    SELECT a.*, p.nome as progetto_nome, p.codice_progetto
    FROM allocazioni_ore a JOIN projects p ON a.progetto_id = p.id
    WHERE a.busta_paga_id = ?
  `).all(req.params.id);
  const oreNonProgetto = db.prepare("SELECT * FROM ore_non_progetto WHERE busta_paga_id = ?").all(req.params.id);
  res.json({ ...bp, allocazioni, ore_non_progetto: oreNonProgetto });
});

app.post("/api/buste-paga", upload.array("files"), async (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "Nessun file" }); return; }

  const bpDir = join(DATA_DIR, "buste_paga_global");
  mkdirSync(bpDir, { recursive: true });

  const results: BustaPaga[] = [];

  // Step 1: create rows immediately with stato_parsing = "pending"
  for (const file of files) {
    const id = randomUUID();
    const destPath = join(bpDir, `${id}_${file.originalname}`);
    renameSync(file.path, destPath);

    db.prepare(`
      INSERT INTO buste_paga (id, mese, file_path, file_name, stato_parsing)
      VALUES (?, '', ?, ?, 'pending')
    `).run(id, destPath, file.originalname);
    const row = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(id) as BustaPaga;
    results.push(row);
  }

  // Return immediately so the UI shows the pending rows
  res.json(results);

  // Step 2: parse in the background
  const allLavoratori = db.prepare("SELECT * FROM lavoratori").all() as Lavoratore[];

  for (const bp of results) {
    (async () => {
      try {
        const parsed = await parsePayslip(bp.file_path);

        let lavoratoreId: string | null = null;
        if (parsed.nome || parsed.cognome) {
          const match = matchPersona(parsed.nome, parsed.cognome,
            allLavoratori.map((l) => ({ id: l.id, nome: l.nome, cognome: l.cognome })) as Persona[]);
          lavoratoreId = match.personaId;
        }

        const matchConfidence = lavoratoreId
          ? matchPersona(parsed.nome, parsed.cognome, allLavoratori.map((l) => ({ id: l.id, nome: l.nome, cognome: l.cognome })) as Persona[]).confidence
          : "none";

        const stato = matchConfidence === "exact" ? "ok"
          : matchConfidence === "partial" ? "revisione_manuale"
          : parsed.nome || parsed.ore_lavorate ? "revisione_manuale"
          : "errore";

        const oreGiornaliereJson = parsed.ore_giornaliere.length > 0 ? JSON.stringify(parsed.ore_giornaliere) : null;
        const dettaglioOreJson = Object.keys(parsed.dettaglio_ore).length > 0 ? JSON.stringify(parsed.dettaglio_ore) : null;

        db.prepare(`
          UPDATE buste_paga SET
            lavoratore_id = ?, mese = ?, ore_estratte = ?, costo_orario_estratto = ?,
            totale_estratto = ?, nome_estratto = ?, cognome_estratto = ?,
            ore_giornaliere = ?, dettaglio_ore = ?, stato_parsing = ?
          WHERE id = ?
        `).run(
          lavoratoreId, parsed.mese ?? "", parsed.ore_lavorate, parsed.costo_orario,
          parsed.totale, parsed.nome, parsed.cognome,
          oreGiornaliereJson, dettaglioOreJson, stato,
          bp.id,
        );
        console.log(`[buste-paga] Parsed ${bp.file_name} → ${stato}`);
      } catch (err) {
        db.prepare("UPDATE buste_paga SET stato_parsing = 'errore' WHERE id = ?").run(bp.id);
        console.error(`[buste-paga] Error parsing ${bp.file_name}:`, err);
      }
    })();
  }
});

app.delete("/api/buste-paga/:id", (req, res) => {
  const bp = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(req.params.id) as BustaPaga | undefined;
  if (!bp) { res.status(404).json({ error: "Busta paga non trovata" }); return; }
  if (bp.file_path && existsSync(bp.file_path)) unlinkSync(bp.file_path);
  db.prepare("DELETE FROM buste_paga WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────
// ALLOCAZIONI ORE
// ──────────────────────────────────────────────────────────

app.get("/api/buste-paga/:id/allocazioni", (req, res) => {
  const allocazioni = db.prepare(`
    SELECT a.*, p.nome as progetto_nome, p.codice_progetto,
      per.nome as persona_nome, per.cognome as persona_cognome, per.costo_orario
    FROM allocazioni_ore a
    JOIN projects p ON a.progetto_id = p.id
    JOIN persone per ON a.persona_id = per.id
    WHERE a.busta_paga_id = ?
  `).all(req.params.id);
  const oreNonProgetto = db.prepare("SELECT * FROM ore_non_progetto WHERE busta_paga_id = ?").all(req.params.id);
  res.json({ allocazioni, ore_non_progetto: oreNonProgetto });
});

app.post("/api/buste-paga/:id/allocazioni", (req, res) => {
  const bpId = req.params.id;
  const bp = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(bpId) as BustaPaga | undefined;
  if (!bp) { res.status(404).json({ error: "Busta paga non trovata" }); return; }

  const data = req.body as SaveAllocazioniRequest;

  const save = db.transaction(() => {
    // Clear existing allocations
    db.prepare("DELETE FROM allocazioni_ore WHERE busta_paga_id = ?").run(bpId);
    db.prepare("DELETE FROM ore_non_progetto WHERE busta_paga_id = ?").run(bpId);

    // Insert project allocations
    const insertAlloc = db.prepare(`
      INSERT INTO allocazioni_ore (id, busta_paga_id, progetto_id, persona_id, ore, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const a of data.allocazioni) {
      insertAlloc.run(randomUUID(), bpId, a.progetto_id, a.persona_id, a.ore, a.note ?? null);
    }

    // Insert non-project hours
    const insertNonProj = db.prepare(`
      INSERT INTO ore_non_progetto (id, busta_paga_id, categoria, ore, note)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const np of data.ore_non_progetto) {
      insertNonProj.run(randomUUID(), bpId, np.categoria, np.ore, np.note ?? null);
    }

    // Auto-create/update timecards from allocations
    for (const a of data.allocazioni) {
      const persona = db.prepare("SELECT * FROM persone WHERE id = ?").get(a.persona_id) as Persona | undefined;
      if (persona?.tipo !== "interno" || !bp.mese) continue;

      const existing = db.prepare(
        "SELECT id FROM timecards WHERE persona_id = ? AND progetto_id = ? AND mese = ?",
      ).get(a.persona_id, a.progetto_id, bp.mese) as { id: string } | undefined;

      if (existing) {
        db.prepare("UPDATE timecards SET ore_totali = ? WHERE id = ?").run(a.ore, existing.id);
      } else {
        db.prepare("INSERT INTO timecards (id, persona_id, progetto_id, mese, ore_totali) VALUES (?, ?, ?, ?, ?)")
          .run(randomUUID(), a.persona_id, a.progetto_id, bp.mese, a.ore);
      }
    }
  });
  save();

  // Return updated allocations
  const allocazioni = db.prepare("SELECT * FROM allocazioni_ore WHERE busta_paga_id = ?").all(bpId);
  const oreNonProgetto = db.prepare("SELECT * FROM ore_non_progetto WHERE busta_paga_id = ?").all(bpId);
  res.json({ allocazioni, ore_non_progetto: oreNonProgetto });
});

app.post("/api/buste-paga/:id/suggerisci-allocazione", async (req, res) => {
  try {
    const suggestion = await suggestAllocation(req.params.id);
    res.json(suggestion);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Errore suggerimento" });
  }
});

// ──────────────────────────────────────────────────────────
// ALLOCAZIONI GIORNALIERE
// ──────────────────────────────────────────────────────────

app.get("/api/buste-paga/:id/allocazioni-giornaliere", (req, res) => {
  const rows = db.prepare("SELECT * FROM allocazioni_giornaliere WHERE busta_paga_id = ?").all(req.params.id);
  res.json(rows);
});

app.post("/api/buste-paga/:id/allocazioni-giornaliere", (req, res) => {
  const bpId = req.params.id;
  const bp = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(bpId) as BustaPaga | undefined;
  if (!bp) { res.status(404).json({ error: "Busta paga non trovata" }); return; }

  const { allocazioni } = req.body as SaveAllocazioniGiornaliereRequest;

  const save = db.transaction(() => {
    db.prepare("DELETE FROM allocazioni_giornaliere WHERE busta_paga_id = ?").run(bpId);

    const insertDay = db.prepare(`
      INSERT INTO allocazioni_giornaliere (id, busta_paga_id, progetto_id, persona_id, categoria_non_progetto, giorno, ore)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of allocazioni) {
      insertDay.run(randomUUID(), bpId, a.progetto_id ?? null, a.persona_id ?? null, a.categoria_non_progetto ?? null, a.giorno, a.ore);
    }

    // Recompute allocazioni_ore from daily project allocations
    const projectTotals = new Map<string, { persona_id: string; ore: number }>();
    for (const a of allocazioni) {
      if (a.progetto_id && a.persona_id) {
        const prev = projectTotals.get(a.progetto_id);
        if (prev) prev.ore += a.ore;
        else projectTotals.set(a.progetto_id, { persona_id: a.persona_id, ore: a.ore });
      }
    }

    const nonProjectTotals = new Map<string, number>();
    for (const a of allocazioni) {
      if (a.categoria_non_progetto) {
        nonProjectTotals.set(a.categoria_non_progetto, (nonProjectTotals.get(a.categoria_non_progetto) ?? 0) + a.ore);
      }
    }

    db.prepare("DELETE FROM allocazioni_ore WHERE busta_paga_id = ?").run(bpId);
    const insertAlloc = db.prepare("INSERT INTO allocazioni_ore (id, busta_paga_id, progetto_id, persona_id, ore) VALUES (?, ?, ?, ?, ?)");
    for (const [progetto_id, { persona_id, ore }] of projectTotals) {
      insertAlloc.run(randomUUID(), bpId, progetto_id, persona_id, ore);
    }

    db.prepare("DELETE FROM ore_non_progetto WHERE busta_paga_id = ?").run(bpId);
    const insertNonProj = db.prepare("INSERT INTO ore_non_progetto (id, busta_paga_id, categoria, ore) VALUES (?, ?, ?, ?)");
    for (const [categoria, ore] of nonProjectTotals) {
      insertNonProj.run(randomUUID(), bpId, categoria, ore);
    }

    // Update timecards
    if (bp.mese) {
      for (const [progetto_id, { persona_id, ore }] of projectTotals) {
        const persona = db.prepare("SELECT tipo FROM persone WHERE id = ?").get(persona_id) as { tipo: string } | undefined;
        if (persona?.tipo !== "interno") continue;
        const existing = db.prepare("SELECT id FROM timecards WHERE persona_id = ? AND progetto_id = ? AND mese = ?").get(persona_id, progetto_id, bp.mese) as { id: string } | undefined;
        if (existing) {
          db.prepare("UPDATE timecards SET ore_totali = ? WHERE id = ?").run(ore, existing.id);
        } else {
          db.prepare("INSERT INTO timecards (id, persona_id, progetto_id, mese, ore_totali) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), persona_id, progetto_id, bp.mese, ore);
        }
      }
    }
  });
  save();

  res.json(db.prepare("SELECT * FROM allocazioni_giornaliere WHERE busta_paga_id = ?").all(bpId));
});

// ──────────────────────────────────────────────────────────
// PROJECTS
// ──────────────────────────────────────────────────────────

app.get("/api/projects", (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, t.nome as tipologia_nome
    FROM projects p LEFT JOIN tipologie t ON p.tipologia_id = t.id
    ORDER BY p.created_at DESC
  `).all() as Project[];
  res.json(rows.map((r) => ({ ...r, loghi: JSON.parse(r.loghi as unknown as string) })));
});

app.get("/api/projects/:id", (req, res) => {
  const row = db.prepare(`
    SELECT p.*, t.nome as tipologia_nome
    FROM projects p LEFT JOIN tipologie t ON p.tipologia_id = t.id
    WHERE p.id = ?
  `).get(req.params.id) as Project | undefined;
  if (!row) { res.status(404).json({ error: "Progetto non trovato" }); return; }
  res.json({ ...row, loghi: JSON.parse(row.loghi as unknown as string) });
});

app.post("/api/projects", (req, res) => {
  const data = req.body as CreateProjectRequest;
  const id = randomUUID();
  db.prepare(`
    INSERT INTO projects (id, nome, codice_progetto, denominazione_attivita, ente_agenzia, modalita_rendicontazione, tipologia_id, data_inizio, data_fine)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.nome, data.codice_progetto, data.denominazione_attivita ?? "", data.ente_agenzia ?? "", data.modalita_rendicontazione, data.tipologia_id ?? null, data.data_inizio, data.data_fine);

  mkdirSync(join(PROJECTS_DIR, id, "output"), { recursive: true });
  mkdirSync(join(PROJECTS_DIR, id, "logos"), { recursive: true });
  mkdirSync(join(PROJECTS_DIR, id, "buste_paga"), { recursive: true });

  const project = db.prepare(`
    SELECT p.*, t.nome as tipologia_nome
    FROM projects p LEFT JOIN tipologie t ON p.tipologia_id = t.id
    WHERE p.id = ?
  `).get(id) as Project;
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
  const project = db.prepare(`
    SELECT p.*, t.nome as tipologia_nome
    FROM projects p LEFT JOIN tipologie t ON p.tipologia_id = t.id
    WHERE p.id = ?
  `).get(req.params.id) as Project;
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

  // For internal workers, auto-create or link lavoratore
  let lavoratoreId = data.lavoratore_id ?? null;
  if (tipo === "interno" && !lavoratoreId) {
    // Check if a lavoratore with same name already exists
    const existing = db.prepare(
      "SELECT id FROM lavoratori WHERE nome = ? AND cognome = ?",
    ).get(data.nome, data.cognome) as { id: string } | undefined;
    if (existing) {
      lavoratoreId = existing.id;
    } else {
      lavoratoreId = randomUUID();
      db.prepare("INSERT INTO lavoratori (id, nome, cognome) VALUES (?, ?, ?)").run(lavoratoreId, data.nome, data.cognome);
    }
  }

  db.prepare(`
    INSERT INTO persone (id, progetto_id, lavoratore_id, nome, cognome, ruolo, tipo, numero_incarico, costo_orario, ore_previste)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, lavoratoreId, data.nome, data.cognome, data.ruolo, tipo, data.numero_incarico ?? null, data.costo_orario ?? null, data.ore_previste ?? null);
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
  // Return buste paga that have allocations to this project, plus legacy ones with progetto_id
  const rows = db.prepare(`
    SELECT DISTINCT bp.*,
      a.ore as ore_allocate,
      a.persona_id as alloc_persona_id,
      l.nome as lavoratore_nome, l.cognome as lavoratore_cognome
    FROM buste_paga bp
    LEFT JOIN allocazioni_ore a ON a.busta_paga_id = bp.id AND a.progetto_id = ?
    LEFT JOIN lavoratori l ON bp.lavoratore_id = l.id
    WHERE a.progetto_id = ? OR bp.progetto_id = ?
    ORDER BY bp.mese, bp.created_at
  `).all(req.params.id, req.params.id, req.params.id);
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
      parsed = { nome: null, cognome: null, mese: null, ore_lavorate: null, costo_orario: null, totale: null, ore_giornaliere: [], dettaglio_ore: {} };
    }

    // Try to match to a person
    const match = matchPersona(parsed.nome, parsed.cognome, persone);

    const stato = match.confidence === "exact" ? "ok"
      : match.confidence === "partial" ? "revisione_manuale"
      : parsed.nome || parsed.ore_lavorate ? "revisione_manuale"
      : "errore";

    // Find lavoratore_id from matched persona
    const matchedPersona = match.personaId ? persone.find((p) => p.id === match.personaId) : null;
    const lavoratoreId = matchedPersona?.lavoratore_id ?? null;

    const oreGiornaliereJson = parsed.ore_giornaliere.length > 0 ? JSON.stringify(parsed.ore_giornaliere) : null;
    const dettaglioOreJson = Object.keys(parsed.dettaglio_ore).length > 0 ? JSON.stringify(parsed.dettaglio_ore) : null;

    // Skip duplicate: same worker + same month + same project + same filename
    const existingBp = db.prepare(
      "SELECT id FROM buste_paga WHERE lavoratore_id IS ? AND progetto_id IS ? AND mese = ? AND file_name = ?",
    ).get(lavoratoreId, progettoId, parsed.mese ?? "", file.originalname) as { id: string } | undefined;
    if (existingBp) {
      const row = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(existingBp.id) as BustaPaga;
      results.push({ ...row, match_confidence: match.confidence });
      continue;
    }

    db.prepare(`
      INSERT INTO buste_paga (id, lavoratore_id, progetto_id, persona_id, mese, file_path, file_name, ore_estratte, costo_orario_estratto, totale_estratto, nome_estratto, cognome_estratto, ore_giornaliere, dettaglio_ore, stato_parsing)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, lavoratoreId, progettoId,
      match.personaId,
      parsed.mese ?? "",
      destPath,
      file.originalname,
      parsed.ore_lavorate,
      parsed.costo_orario,
      parsed.totale,
      parsed.nome,
      parsed.cognome,
      oreGiornaliereJson,
      dettaglioOreJson,
      stato,
    );

    // Auto-create allocation for this project
    if (match.personaId && parsed.ore_lavorate) {
      db.prepare(`
        INSERT OR IGNORE INTO allocazioni_ore (id, busta_paga_id, progetto_id, persona_id, ore)
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), id, progettoId, match.personaId, parsed.ore_lavorate);
    }

    const row = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(id) as BustaPaga;
    results.push({ ...row, match_confidence: match.confidence });
  }

  // Auto-create timecards only for internal people
  for (const bp of results) {
    if (bp.persona_id && bp.mese && bp.ore_estratte) {
      const persona = persone.find((p) => p.id === bp.persona_id);
      if (persona?.tipo !== "interno") continue;
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

  // If matching to a lavoratore, auto-create timecard for internal people
  if (data.lavoratore_id) {
    const bp = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(req.params.bpId) as BustaPaga;
    const persona = bp.persona_id ? db.prepare("SELECT * FROM persone WHERE id = ?").get(bp.persona_id) as Persona | undefined : undefined;
    if (persona?.tipo === "interno" && bp.mese && bp.ore_estratte) {
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

app.delete("/api/projects/:projId/buste-paga/:bpId", (req, res) => {
  const bp = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(req.params.bpId) as BustaPaga | undefined;
  if (!bp) { res.status(404).json({ error: "Busta paga non trovata" }); return; }
  if (bp.file_path && existsSync(bp.file_path)) unlinkSync(bp.file_path);
  db.prepare("DELETE FROM buste_paga WHERE id = ?").run(req.params.bpId);
  res.json({ ok: true });
});

// ──────────────────────────────────────────────────────────
// TIMECARDS
// ──────────────────────────────────────────────────────────

app.get("/api/projects/:id/timecards", (req, res) => {
  const rows = db.prepare(`
    SELECT t.*, p.nome as persona_nome, p.cognome as persona_cognome, p.ore_previste
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

  // Get all months from payslip allocations + legacy direct uploads
  const mesiRows = db.prepare(`
    SELECT DISTINCT mese FROM (
      SELECT bp.mese FROM buste_paga bp
        JOIN allocazioni_ore a ON a.busta_paga_id = bp.id
        WHERE a.progetto_id = ? AND bp.mese != ''
      UNION
      SELECT bp.mese FROM buste_paga bp
        WHERE bp.progetto_id = ? AND bp.mese != ''
    ) ORDER BY mese
  `).all(progettoId, progettoId) as { mese: string }[];
  const mesi = mesiRows.map((r) => r.mese);

  // Delete old auto-generated docs that haven't been uploaded
  db.prepare("DELETE FROM documenti WHERE progetto_id = ? AND stato = 'mancante'").run(progettoId);

  // Load checklist rules from tipologia
  let rules: ChecklistRules = FSE_PLUS_RULES;
  if (project.tipologia_id) {
    const tipologia = db.prepare("SELECT regole_json FROM tipologie WHERE id = ?").get(project.tipologia_id) as { regole_json: string } | undefined;
    if (tipologia) rules = JSON.parse(tipologia.regole_json);
  }

  // Generate new checklist
  const docs = generateChecklist(progettoId, persone, mesi, project.modalita_rendicontazione as any, rules);

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

// Delete a document
app.delete("/api/projects/:projId/documenti/:docId", (req, res) => {
  const doc = db.prepare("SELECT * FROM documenti WHERE id = ?").get(req.params.docId) as DocumentoRichiesto | undefined;
  if (!doc) { res.status(404).json({ error: "Documento non trovato" }); return; }
  if (doc.file_path && existsSync(doc.file_path)) unlinkSync(doc.file_path);
  db.prepare("DELETE FROM documenti WHERE id = ?").run(req.params.docId);
  res.json({ ok: true });
});

// Link a document to a persona (used after adding unknown person)
app.put("/api/projects/:projId/documenti/:docId/link-persona", (req, res) => {
  const { persona_id } = req.body as { persona_id: string };
  if (!persona_id) { res.status(400).json({ error: "persona_id obbligatorio" }); return; }

  const doc = db.prepare("SELECT * FROM documenti WHERE id = ?").get(req.params.docId) as DocumentoRichiesto | undefined;
  if (!doc) { res.status(404).json({ error: "Documento non trovato" }); return; }

  db.prepare("UPDATE documenti SET persona_id = ? WHERE id = ?").run(persona_id, req.params.docId);

  // Also update matching buste_paga record if exists
  if (doc.file_path) {
    db.prepare("UPDATE buste_paga SET persona_id = ? WHERE file_path = ? AND (persona_id IS NULL OR persona_id = '')").run(persona_id, doc.file_path);
  }

  const row = db.prepare("SELECT * FROM documenti WHERE id = ?").get(req.params.docId);
  res.json(row);
});

// Bulk upload documents with auto-classification
app.post("/api/projects/:id/documenti/upload-bulk", upload.array("files"), async (req, res) => {
  const progettoId = req.params.id as string;
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(progettoId) as Project | undefined;
  if (!project) { res.status(404).json({ error: "Progetto non trovato" }); return; }

  const files = req.files as Express.Multer.File[];
  if (!files?.length) { res.status(400).json({ error: "Nessun file" }); return; }

  const persone = db.prepare("SELECT * FROM persone WHERE progetto_id = ?").all(progettoId) as Persona[];
  const docDir = join(PROJECTS_DIR, progettoId, "documenti");
  mkdirSync(docDir, { recursive: true });

  const CATEGORY_LABELS: Record<string, string> = {
    busta_paga: "Busta paga", timecard: "Timecard", f24: "F24 versamento ritenute",
    bonifico: "Ricevuta bonifico", fattura: "Fattura / Notula", ordine_servizio: "Ordine di servizio",
    prospetto_costo_orario: "Prospetto calcolo costo orario", lettera_incarico: "Lettera d'incarico",
    cv: "CV sottoscritto", relazione_attivita: "Relazione attività", relazione_finale: "Relazione finale",
    dichiarazione_irap: "Dichiarazione IRAP", scheda_finanziaria: "Scheda finanziaria validata",
    registri_presenze: "Registri presenze", non_pertinente: "Non pertinente",
  };

  type ResultItem = DocumentoRichiesto & {
    motivo?: string;
    match_confidence?: string;
    progetto_mismatch?: { nome_doc: string | null; codice_doc: string | null };
    fuori_periodo?: { mese_doc: string; data_inizio: string; data_fine: string };
    split_from?: string;
    unknown_person?: { nome: string; cognome: string };
  };
  const results: ResultItem[] = [];

  // Helper: process a single classified document (shared between single-doc and multi-doc branches)
  function processClassified(
    classified: ClassifiedDocument,
    filePath: string,
    fileName: string,
    splitFrom?: string,
  ): ResultItem {
    const id = randomUUID();

    // Match person
    let personaId: string | null = null;
    let matchConfidence = "none";
    if (classified.persona_nome || classified.persona_cognome) {
      const match = matchPersona(classified.persona_nome, classified.persona_cognome, persone);
      personaId = match.personaId;
      matchConfidence = match.confidence;
    }

    // Unknown person flag
    let unknown_person: { nome: string; cognome: string } | undefined;
    if (matchConfidence === "none" && (classified.persona_nome || classified.persona_cognome)) {
      unknown_person = { nome: classified.persona_nome ?? "", cognome: classified.persona_cognome ?? "" };
    }

    // Project mismatch check
    let progetto_mismatch: { nome_doc: string | null; codice_doc: string | null } | undefined;
    if (classified.progetto_nome || classified.progetto_codice) {
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const nameMatch = !classified.progetto_nome || norm(project!.nome).includes(norm(classified.progetto_nome)) || norm(classified.progetto_nome).includes(norm(project!.nome));
      const codeMatch = !classified.progetto_codice || norm(project!.codice_progetto).includes(norm(classified.progetto_codice)) || norm(classified.progetto_codice).includes(norm(project!.codice_progetto));
      if (!nameMatch || !codeMatch) {
        progetto_mismatch = { nome_doc: classified.progetto_nome, codice_doc: classified.progetto_codice };
      }
    }

    // Timeline check: document month must fall within project dates
    const MONTHLY_CATEGORIES = ["busta_paga", "timecard", "f24", "bonifico", "fattura"];
    let fuori_periodo: { mese_doc: string; data_inizio: string; data_fine: string } | undefined;
    if (classified.mese && MONTHLY_CATEGORIES.includes(classified.categoria) && project!.data_inizio && project!.data_fine) {
      const meseStart = classified.mese; // YYYY-MM
      const projStart = project!.data_inizio.slice(0, 7); // YYYY-MM-DD → YYYY-MM
      const projEnd = project!.data_fine.slice(0, 7);
      if (meseStart < projStart || meseStart > projEnd) {
        fuori_periodo = { mese_doc: classified.mese, data_inizio: project!.data_inizio, data_fine: project!.data_fine };
      }
    }

    // If out of period, do NOT insert — just return warning with file info
    if (fuori_periodo) {
      return {
        id,
        progetto_id: progettoId,
        persona_id: personaId ?? undefined,
        categoria: classified.categoria,
        descrizione: classified.descrizione,
        mese: classified.mese,
        stato: "mancante" as const,
        file_path: filePath,
        file_name: fileName,
        created_at: new Date().toISOString(),
        motivo: classified.motivo,
        match_confidence: matchConfidence,
        progetto_mismatch,
        fuori_periodo,
        split_from: splitFrom,
        unknown_person,
      } as ResultItem;
    }

    // Fulfill existing checklist item or create new
    const existingDoc = db.prepare(
      "SELECT id FROM documenti WHERE progetto_id = ? AND persona_id IS ? AND categoria = ? AND mese IS ? AND stato = 'mancante'",
    ).get(progettoId, personaId, classified.categoria, classified.mese ?? null) as { id: string } | undefined;

    let resultRow: DocumentoRichiesto;
    if (existingDoc) {
      db.prepare("UPDATE documenti SET stato = 'caricato', file_path = ?, file_name = ? WHERE id = ?")
        .run(filePath, fileName, existingDoc.id);
      resultRow = db.prepare("SELECT * FROM documenti WHERE id = ?").get(existingDoc.id) as DocumentoRichiesto;
    } else {
      const label = CATEGORY_LABELS[classified.categoria] ?? classified.categoria;
      const descrizione = classified.mese ? `${label} — ${classified.mese}` : label;
      db.prepare(`
        INSERT INTO documenti (id, progetto_id, persona_id, categoria, descrizione, mese, stato, file_path, file_name)
        VALUES (?, ?, ?, ?, ?, ?, 'caricato', ?, ?)
      `).run(id, progettoId, personaId, classified.categoria, descrizione, classified.mese ?? null, filePath, fileName);
      resultRow = db.prepare("SELECT * FROM documenti WHERE id = ?").get(id) as DocumentoRichiesto;
    }

    return {
      ...resultRow,
      motivo: classified.motivo,
      match_confidence: matchConfidence,
      progetto_mismatch,
      fuori_periodo,
      split_from: splitFrom,
      unknown_person,
    };
  }

  // Helper: handle payslip-specific processing
  async function handlePayslip(classified: ClassifiedDocument, filePath: string, fileName: string, docId: string, currentPersonaId: string | null) {
    let parsed;
    try {
      parsed = await parsePayslip(filePath);
    } catch {
      parsed = { nome: null, cognome: null, mese: null, ore_lavorate: null, costo_orario: null, totale: null, ore_giornaliere: [], dettaglio_ore: {} };
    }

    let personaId = currentPersonaId;
    if (!personaId && (parsed.nome || parsed.cognome)) {
      const payslipMatch = matchPersona(parsed.nome, parsed.cognome, persone);
      if (payslipMatch.personaId) {
        personaId = payslipMatch.personaId;
        db.prepare("UPDATE documenti SET persona_id = ? WHERE id = ?").run(personaId, docId);
      }
    }

    // Resolve lavoratore_id from matched persona
    const matchedPersona = personaId ? persone.find((p) => p.id === personaId) : null;
    const lavoratoreId = matchedPersona?.lavoratore_id ?? null;

    const stato = personaId ? "ok" : (parsed.nome || parsed.ore_lavorate ? "revisione_manuale" : "errore");
    const mese = parsed.mese ?? classified.mese ?? "";

    const oreGiornaliereJson = parsed.ore_giornaliere.length > 0 ? JSON.stringify(parsed.ore_giornaliere) : null;
    const dettaglioOreJson = Object.keys(parsed.dettaglio_ore).length > 0 ? JSON.stringify(parsed.dettaglio_ore) : null;

    // Skip duplicate: same worker + same month + same project + same filename
    const existingBp = db.prepare(
      "SELECT id FROM buste_paga WHERE lavoratore_id IS ? AND progetto_id IS ? AND mese = ? AND file_name = ?",
    ).get(lavoratoreId, progettoId, mese, fileName) as { id: string } | undefined;
    if (existingBp) return;

    const bpId = randomUUID();
    db.prepare(`
      INSERT INTO buste_paga (id, lavoratore_id, progetto_id, persona_id, mese, file_path, file_name, ore_estratte, costo_orario_estratto, totale_estratto, nome_estratto, cognome_estratto, ore_giornaliere, dettaglio_ore, stato_parsing)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bpId, lavoratoreId, progettoId, personaId, mese, filePath, fileName, parsed.ore_lavorate, parsed.costo_orario, parsed.totale, parsed.nome, parsed.cognome, oreGiornaliereJson, dettaglioOreJson, stato);

    // Create allocation for this project
    if (personaId && parsed.ore_lavorate) {
      db.prepare(`
        INSERT OR IGNORE INTO allocazioni_ore (id, busta_paga_id, progetto_id, persona_id, ore)
        VALUES (?, ?, ?, ?, ?)
      `).run(randomUUID(), bpId, progettoId, personaId, parsed.ore_lavorate);
    }

    // Auto-create timecard from allocation
    if (personaId && mese && parsed.ore_lavorate) {
      const persona = persone.find((p) => p.id === personaId);
      if (persona?.tipo === "interno") {
        const existing = db.prepare("SELECT id FROM timecards WHERE persona_id = ? AND progetto_id = ? AND mese = ?").get(personaId, progettoId, mese);
        if (!existing) {
          db.prepare("INSERT INTO timecards (id, persona_id, progetto_id, mese, ore_totali) VALUES (?, ?, ?, ?, ?)").run(randomUUID(), personaId, progettoId, mese, parsed.ore_lavorate);
        }
      }
    }
  }

  for (const file of files) {
    const fileId = randomUUID();
    const destPath = join(docDir, `${fileId}_${file.originalname}`);
    renameSync(file.path, destPath);

    let classResult;
    try {
      classResult = await classifyDocument(destPath);
    } catch {
      classResult = { documenti_multipli: false as const, documento: { categoria: "non_pertinente" as const, persona_nome: null, persona_cognome: null, mese: null, progetto_nome: null, progetto_codice: null, descrizione: "Errore classificazione", motivo: "Errore" } };
    }

    if (classResult.documenti_multipli && classResult.sotto_documenti && classResult.sotto_documenti.length > 1) {
      // MULTI-DOC: split PDF and process each sub-document
      const pageRanges = classResult.sotto_documenti.map((sd) => sd.pagine);
      let splitFiles;
      try {
        splitFiles = await splitPdf(destPath, pageRanges, docDir);
      } catch (err) {
        console.error("[upload-bulk] PDF split failed, processing as single:", err);
        // Fallback: use first sub-document's metadata for the whole file
        const fallback = classResult.sotto_documenti[0];
        const result = processClassified(fallback, destPath, file.originalname);
        results.push(result);
        if (fallback.categoria === "busta_paga" && !result.fuori_periodo) {
          await handlePayslip(fallback, destPath, file.originalname, result.id, result.persona_id ?? null);
        }
        continue;
      }

      for (let i = 0; i < splitFiles.length; i++) {
        const splitFile = splitFiles[i];
        const subDoc = classResult.sotto_documenti[i];
        const result = processClassified(subDoc, splitFile.filePath, splitFile.originalName, file.originalname);
        results.push(result);
        if (subDoc.categoria === "busta_paga" && !result.fuori_periodo) {
          await handlePayslip(subDoc, splitFile.filePath, splitFile.originalName, result.id, result.persona_id ?? null);
        }
      }
    } else {
      // SINGLE-DOC: existing flow
      const classified = classResult.documento ?? { categoria: "non_pertinente" as const, persona_nome: null, persona_cognome: null, mese: null, progetto_nome: null, progetto_codice: null, descrizione: "Errore", motivo: "Errore" };
      const result = processClassified(classified, destPath, file.originalname);
      results.push(result);
      if (classified.categoria === "busta_paga" && !result.fuori_periodo) {
        await handlePayslip(classified, destPath, file.originalname, result.id, result.persona_id ?? null);
      }
    }
  }

  res.json(results);
});

// ──────────────────────────────────────────────────────────
// STATS
// ──────────────────────────────────────────────────────────

app.get("/api/projects/:id/stats", (req, res) => {
  const progettoId = req.params.id;
  const personeCount = (db.prepare("SELECT COUNT(*) as c FROM persone WHERE progetto_id = ?").get(progettoId) as any).c;
  const bpCount = (db.prepare("SELECT COUNT(DISTINCT bp.id) as c FROM buste_paga bp LEFT JOIN allocazioni_ore a ON a.busta_paga_id = bp.id WHERE a.progetto_id = ? OR bp.progetto_id = ?").get(progettoId, progettoId) as any).c;
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
// Recover stale triage items stuck as 'pending' from a previous crash/restart
db.prepare(`
  UPDATE triage_log SET status = 'done', categoria = 'non_pertinente', esito = 'errore',
    motivo = 'Classificazione interrotta (server riavviato)'
  WHERE status = 'pending'
`).run();

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
