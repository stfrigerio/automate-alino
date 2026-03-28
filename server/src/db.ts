import Database, { type Database as DatabaseType } from "better-sqlite3";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { join } from "path";
import { BUILTIN_TIPOLOGIE } from "./services/checklist-rules.ts";

const ROOT = join(import.meta.dirname, "../..");
const DATA_DIR = join(ROOT, "data");
mkdirSync(DATA_DIR, { recursive: true });

export const db: DatabaseType = new Database(join(DATA_DIR, "fse.db"));

// Enable WAL mode and foreign keys
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    codice_progetto TEXT NOT NULL,
    denominazione_attivita TEXT NOT NULL DEFAULT '',
    ente_agenzia TEXT NOT NULL DEFAULT '',
    modalita_rendicontazione TEXT NOT NULL DEFAULT 'staff_40'
      CHECK(modalita_rendicontazione IN ('staff_40', 'forfettario_7', 'costi_reali')),
    data_inizio TEXT NOT NULL DEFAULT '',
    data_fine TEXT NOT NULL DEFAULT '',
    loghi TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lavoratori (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    codice_fiscale TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS persone (
    id TEXT PRIMARY KEY,
    progetto_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    lavoratore_id TEXT REFERENCES lavoratori(id) ON DELETE SET NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    ruolo TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('interno', 'esterno')),
    numero_incarico TEXT,
    costo_orario REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS buste_paga (
    id TEXT PRIMARY KEY,
    lavoratore_id TEXT REFERENCES lavoratori(id) ON DELETE SET NULL,
    persona_id TEXT REFERENCES persone(id) ON DELETE SET NULL,
    progetto_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    mese TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL DEFAULT '',
    ore_estratte REAL,
    costo_orario_estratto REAL,
    totale_estratto REAL,
    nome_estratto TEXT,
    cognome_estratto TEXT,
    stato_parsing TEXT NOT NULL DEFAULT 'pending'
      CHECK(stato_parsing IN ('pending', 'ok', 'errore', 'revisione_manuale')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS allocazioni_ore (
    id TEXT PRIMARY KEY,
    busta_paga_id TEXT NOT NULL REFERENCES buste_paga(id) ON DELETE CASCADE,
    progetto_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    persona_id TEXT NOT NULL REFERENCES persone(id) ON DELETE CASCADE,
    ore REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(busta_paga_id, progetto_id)
  );

  CREATE TABLE IF NOT EXISTS ore_non_progetto (
    id TEXT PRIMARY KEY,
    busta_paga_id TEXT NOT NULL REFERENCES buste_paga(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL CHECK(categoria IN (
      'riunioni','formazione','malattia','ferie','permessi','altro'
    )),
    ore REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS timecards (
    id TEXT PRIMARY KEY,
    persona_id TEXT NOT NULL REFERENCES persone(id) ON DELETE CASCADE,
    progetto_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mese TEXT NOT NULL,
    righe TEXT NOT NULL DEFAULT '[]',
    ore_totali REAL NOT NULL DEFAULT 0,
    stato TEXT NOT NULL DEFAULT 'bozza'
      CHECK(stato IN ('bozza', 'generata', 'firmata')),
    file_pdf_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(persona_id, progetto_id, mese)
  );

  CREATE TABLE IF NOT EXISTS tipologie (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    codice TEXT NOT NULL UNIQUE,
    builtin INTEGER NOT NULL DEFAULT 0,
    descrizione TEXT NOT NULL DEFAULT '',
    regole_json TEXT NOT NULL DEFAULT '{}',
    source_pdf_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documenti (
    id TEXT PRIMARY KEY,
    progetto_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    persona_id TEXT REFERENCES persone(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL,
    descrizione TEXT NOT NULL,
    mese TEXT,
    stato TEXT NOT NULL DEFAULT 'mancante'
      CHECK(stato IN ('mancante', 'caricato', 'verificato')),
    file_path TEXT,
    file_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS triage_log (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    categoria TEXT NOT NULL,
    persona_nome TEXT,
    persona_cognome TEXT,
    mese TEXT,
    progetto_nome_doc TEXT,
    progetto_codice_doc TEXT,
    matched_project_id TEXT,
    matched_project_nome TEXT,
    matched_lavoratore_id TEXT,
    matched_lavoratore_nome TEXT,
    needs_action TEXT NOT NULL DEFAULT 'none',
    motivo TEXT,
    esito TEXT NOT NULL DEFAULT 'pending'
      CHECK(esito IN ('pending', 'auto_assegnato', 'assegnato_manuale', 'non_pertinente', 'ignorato', 'errore')),
    committed_project_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK(status IN ('pending', 'done')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Migrations ──────────────────────────────────────────────

// Add tipologia_id and color to projects
const projCols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
const projColNames = new Set(projCols.map((c) => c.name));
if (!projColNames.has("tipologia_id")) {
  db.exec("ALTER TABLE projects ADD COLUMN tipologia_id TEXT REFERENCES tipologie(id)");
}
if (!projColNames.has("color")) {
  db.exec("ALTER TABLE projects ADD COLUMN color TEXT");
}

// Seed built-in tipologie
const seedTipologia = db.prepare(`
  INSERT OR IGNORE INTO tipologie (id, nome, codice, builtin, descrizione, regole_json)
  VALUES (?, ?, ?, 1, ?, ?)
`);
for (const t of BUILTIN_TIPOLOGIE) {
  seedTipologia.run(randomUUID(), t.nome, t.codice, t.descrizione, JSON.stringify(t.regole));
}

// Backfill existing projects without tipologia
const fseRow = db.prepare("SELECT id FROM tipologie WHERE codice = 'fse_plus'").get() as { id: string } | undefined;
if (fseRow) {
  db.prepare("UPDATE projects SET tipologia_id = ? WHERE tipologia_id IS NULL").run(fseRow.id);
}

// ── Migration: lavoratori + cross-project buste paga ──────
// Add lavoratore_id to persone if missing (for databases created before this migration)
const personeCols = db.prepare("PRAGMA table_info(persone)").all() as { name: string }[];
const personeColNames = new Set(personeCols.map((c) => c.name));
if (!personeColNames.has("lavoratore_id")) {
  db.exec("ALTER TABLE persone ADD COLUMN lavoratore_id TEXT REFERENCES lavoratori(id) ON DELETE SET NULL");
}
if (!personeColNames.has("ore_previste")) {
  db.exec("ALTER TABLE persone ADD COLUMN ore_previste REAL");
}

// Add lavoratore_id to buste_paga if missing
const bpCols = db.prepare("PRAGMA table_info(buste_paga)").all() as { name: string }[];
const bpColNames = new Set(bpCols.map((c) => c.name));
if (!bpColNames.has("lavoratore_id")) {
  db.exec("ALTER TABLE buste_paga ADD COLUMN lavoratore_id TEXT REFERENCES lavoratori(id) ON DELETE SET NULL");
}
if (!bpColNames.has("costo_orario_estratto")) {
  db.exec("ALTER TABLE buste_paga ADD COLUMN costo_orario_estratto REAL");
}
if (!bpColNames.has("totale_estratto")) {
  db.exec("ALTER TABLE buste_paga ADD COLUMN totale_estratto REAL");
}
// Migrate: make progetto_id nullable on buste_paga (was NOT NULL in old schema)
const bpProgCol = (db.prepare("PRAGMA table_info(buste_paga)").all() as { name: string; notnull: number }[])
  .find((c) => c.name === "progetto_id");
if (bpProgCol && bpProgCol.notnull === 1) {
  db.exec(`
    CREATE TABLE buste_paga_new AS SELECT * FROM buste_paga;
    DROP TABLE buste_paga;
    CREATE TABLE buste_paga (
      id TEXT PRIMARY KEY,
      lavoratore_id TEXT REFERENCES lavoratori(id) ON DELETE SET NULL,
      persona_id TEXT REFERENCES persone(id) ON DELETE SET NULL,
      progetto_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      mese TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      ore_estratte REAL,
      costo_orario_estratto REAL,
      totale_estratto REAL,
      nome_estratto TEXT,
      cognome_estratto TEXT,
      ore_giornaliere TEXT,
      dettaglio_ore TEXT,
      stato_parsing TEXT NOT NULL DEFAULT 'pending'
        CHECK(stato_parsing IN ('pending', 'ok', 'errore', 'revisione_manuale')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO buste_paga SELECT id, lavoratore_id, persona_id, progetto_id, mese, file_path, file_name, ore_estratte, costo_orario_estratto, totale_estratto, nome_estratto, cognome_estratto, ore_giornaliere, dettaglio_ore, stato_parsing, created_at FROM buste_paga_new;
    DROP TABLE buste_paga_new;
  `);
}

if (!bpColNames.has("ore_giornaliere")) {
  db.exec("ALTER TABLE buste_paga ADD COLUMN ore_giornaliere TEXT");
}
if (!bpColNames.has("dettaglio_ore")) {
  db.exec("ALTER TABLE buste_paga ADD COLUMN dettaglio_ore TEXT");
}

// Backfill: create lavoratori from existing internal persone and link them
const hasLavoratori = db.prepare(
  "SELECT COUNT(*) as n FROM lavoratori"
).get() as { n: number };
const hasInternalPersone = db.prepare(
  "SELECT COUNT(*) as n FROM persone WHERE tipo = 'interno' AND lavoratore_id IS NULL"
).get() as { n: number };

if (hasLavoratori.n === 0 && hasInternalPersone.n > 0) {
  const migrate = db.transaction(() => {
    // Group unique internal workers by (nome, cognome)
    const uniqueWorkers = db.prepare(
      "SELECT DISTINCT nome, cognome FROM persone WHERE tipo = 'interno'"
    ).all() as { nome: string; cognome: string }[];

    for (const w of uniqueWorkers) {
      const lavId = randomUUID();
      db.prepare("INSERT INTO lavoratori (id, nome, cognome) VALUES (?, ?, ?)").run(lavId, w.nome, w.cognome);
      db.prepare(
        "UPDATE persone SET lavoratore_id = ? WHERE nome = ? AND cognome = ? AND tipo = 'interno'"
      ).run(lavId, w.nome, w.cognome);
    }

    // Link buste_paga to lavoratori via their persona
    db.exec(`
      UPDATE buste_paga SET lavoratore_id = (
        SELECT p.lavoratore_id FROM persone p WHERE p.id = buste_paga.persona_id
      ) WHERE persona_id IS NOT NULL AND lavoratore_id IS NULL
    `);

    // Backfill allocazioni_ore from existing buste_paga
    const existingBp = db.prepare(`
      SELECT id, progetto_id, persona_id, ore_estratte
      FROM buste_paga
      WHERE progetto_id IS NOT NULL AND persona_id IS NOT NULL AND ore_estratte IS NOT NULL
    `).all() as { id: string; progetto_id: string; persona_id: string; ore_estratte: number }[];

    const insertAlloc = db.prepare(`
      INSERT OR IGNORE INTO allocazioni_ore (id, busta_paga_id, progetto_id, persona_id, ore)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const bp of existingBp) {
      insertAlloc.run(randomUUID(), bp.id, bp.progetto_id, bp.persona_id, bp.ore_estratte);
    }
  });
  migrate();
}

// Migration: allocazioni_giornaliere
const giornCols = db.prepare("PRAGMA table_info(allocazioni_giornaliere)").all() as { name: string }[];
if (giornCols.length === 0) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS allocazioni_giornaliere (
      id TEXT PRIMARY KEY,
      busta_paga_id TEXT NOT NULL REFERENCES buste_paga(id) ON DELETE CASCADE,
      progetto_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      persona_id TEXT REFERENCES persone(id) ON DELETE CASCADE,
      categoria_non_progetto TEXT CHECK(categoria_non_progetto IN ('riunioni','formazione','malattia','ferie','permessi','altro')),
      giorno INTEGER NOT NULL,
      ore REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(busta_paga_id, giorno)
    )
  `);
}

export default db;
