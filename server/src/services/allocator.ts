import { spawnClaude } from "./claude.js";
import db from "../db.js";
import type { AllocationSuggestion, BustaPaga, Persona, Project } from "../../../shared/types.ts";

interface WorkerAssignment {
  progetto_id: string;
  progetto_nome: string;
  codice_progetto: string;
  ruolo: string;
  costo_orario: number | null;
  data_inizio: string;
  data_fine: string;
}

interface HistoricalAllocation {
  mese: string;
  progetto_nome: string;
  ore: number;
}

export async function suggestAllocation(bustaPagaId: string): Promise<AllocationSuggestion> {
  const bp = db.prepare("SELECT * FROM buste_paga WHERE id = ?").get(bustaPagaId) as BustaPaga | undefined;
  if (!bp) throw new Error("Busta paga non trovata");
  if (!bp.lavoratore_id) throw new Error("Busta paga non collegata a un lavoratore");

  // Get worker's project assignments
  const assignments = db.prepare(`
    SELECT per.progetto_id, p.nome as progetto_nome, p.codice_progetto,
      per.ruolo, per.costo_orario, p.data_inizio, p.data_fine
    FROM persone per
    JOIN projects p ON per.progetto_id = p.id
    WHERE per.lavoratore_id = ? AND per.tipo = 'interno'
  `).all(bp.lavoratore_id) as WorkerAssignment[];

  if (assignments.length === 0) {
    return { allocazioni: [], ore_non_progetto: [], nota: "Nessun progetto assegnato a questo lavoratore." };
  }

  // Get historical allocations for context
  const history = db.prepare(`
    SELECT bp2.mese, p.nome as progetto_nome, a.ore
    FROM allocazioni_ore a
    JOIN buste_paga bp2 ON a.busta_paga_id = bp2.id
    JOIN projects p ON a.progetto_id = p.id
    WHERE bp2.lavoratore_id = ? AND bp2.mese != ? AND bp2.mese != ''
    ORDER BY bp2.mese DESC
    LIMIT 30
  `).all(bp.lavoratore_id, bp.mese) as HistoricalAllocation[];

  const historicalNonProject = db.prepare(`
    SELECT bp2.mese, onp.categoria, onp.ore
    FROM ore_non_progetto onp
    JOIN buste_paga bp2 ON onp.busta_paga_id = bp2.id
    WHERE bp2.lavoratore_id = ? AND bp2.mese != ? AND bp2.mese != ''
    ORDER BY bp2.mese DESC
    LIMIT 20
  `).all(bp.lavoratore_id, bp.mese) as { mese: string; categoria: string; ore: number }[];

  let historyBlock = "";
  if (history.length > 0) {
    const byMonth = new Map<string, string[]>();
    for (const h of history) {
      if (!byMonth.has(h.mese)) byMonth.set(h.mese, []);
      byMonth.get(h.mese)!.push(`${h.progetto_nome}: ${h.ore}h`);
    }
    for (const h of historicalNonProject) {
      if (!byMonth.has(h.mese)) byMonth.set(h.mese, []);
      byMonth.get(h.mese)!.push(`${h.categoria}: ${h.ore}h`);
    }
    historyBlock = `\nNei mesi precedenti, le allocazioni erano:\n`;
    for (const [mese, items] of byMonth) {
      historyBlock += `- ${mese}: ${items.join(", ")}\n`;
    }
  }

  const projectsBlock = assignments.map((a) =>
    `- Progetto: "${a.progetto_nome}" (codice: ${a.codice_progetto}, id: ${a.progetto_id})\n  Ruolo: ${a.ruolo}, Costo orario: ${a.costo_orario ? `€${a.costo_orario}` : "non definito"}\n  Periodo: ${a.data_inizio || "?"} — ${a.data_fine || "?"}`
  ).join("\n");

  const prompt = `Sei un assistente per la rendicontazione di progetti FSE+.

Un lavoratore ha una busta paga per il mese ${bp.mese} con ${bp.ore_estratte ?? "?"} ore totali.

Questo lavoratore è assegnato ai seguenti progetti:
${projectsBlock}
${historyBlock}
Suggerisci come ripartire le ${bp.ore_estratte ?? "?"} ore tra i progetti e le ore non-progetto.
Le categorie non-progetto possibili sono: riunioni, formazione, malattia, ferie, permessi, altro.

Rispondi SOLO con un oggetto JSON valido (nessun testo prima o dopo):
{
  "allocazioni": [
    {"progetto_id": "...", "ore": 40, "motivazione": "..."}
  ],
  "ore_non_progetto": [
    {"categoria": "riunioni", "ore": 8, "motivazione": "..."}
  ],
  "nota": "breve spiegazione"
}`;

  const raw = await spawnClaude(prompt, { maxTurns: 1, timeoutMs: 60_000, allowedTools: [] });

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI non ha restituito JSON valido");
  }

  const result = JSON.parse(jsonMatch[0]) as AllocationSuggestion;

  // Validate totals
  const totalAllocated = result.allocazioni.reduce((s, a) => s + a.ore, 0)
    + result.ore_non_progetto.reduce((s, a) => s + a.ore, 0);
  if (bp.ore_estratte && totalAllocated > bp.ore_estratte * 1.01) {
    // AI over-allocated, scale down proportionally
    const factor = bp.ore_estratte / totalAllocated;
    for (const a of result.allocazioni) a.ore = Math.round(a.ore * factor * 10) / 10;
    for (const a of result.ore_non_progetto) a.ore = Math.round(a.ore * factor * 10) / 10;
  }

  return result;
}
