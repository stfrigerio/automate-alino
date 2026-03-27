import Database, { type Database as DatabaseType } from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";

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

  CREATE TABLE IF NOT EXISTS persone (
    id TEXT PRIMARY KEY,
    progetto_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
    persona_id TEXT REFERENCES persone(id) ON DELETE SET NULL,
    progetto_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mese TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL DEFAULT '',
    ore_estratte REAL,
    nome_estratto TEXT,
    cognome_estratto TEXT,
    stato_parsing TEXT NOT NULL DEFAULT 'pending'
      CHECK(stato_parsing IN ('pending', 'ok', 'errore', 'revisione_manuale')),
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
`);

export default db;
