import { readFileSync } from "fs";
import { parse } from "yaml";
import type { RulesConfig } from "../../shared/types.js";

export function loadRules(configPath: string): RulesConfig {
  const raw = readFileSync(configPath, "utf-8");
  const rules = parse(raw) as RulesConfig;
  if (!rules.categories?.length) {
    throw new Error("Config must have at least one category.");
  }
  return rules;
}
