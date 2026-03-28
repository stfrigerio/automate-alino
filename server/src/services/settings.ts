import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../../..");
const SETTINGS_PATH = join(ROOT, "data", "settings.json");

export type ClaudeModel = "haiku" | "sonnet" | "opus";

interface Settings {
  model: ClaudeModel;
}

const DEFAULTS: Settings = { model: "sonnet" };

function load(): Settings {
  if (!existsSync(SETTINGS_PATH)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: Settings) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

let _settings: Settings = load();

export function getSettings(): Settings {
  return _settings;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  _settings = { ..._settings, ...patch };
  save(_settings);
  return _settings;
}
