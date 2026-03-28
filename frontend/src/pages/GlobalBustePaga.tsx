import { useEffect, useState, useRef, useCallback } from "react";
import {
  getGlobalBustePaga,
  deleteGlobalBustaPaga,
  getLavoratore,
  getGiornaliere,
  saveGiornaliere,
} from "../api/client";
import type { BustaPaga, OreGiornaliere, DettaglioOre, AllocazioneGiornaliera } from "../types";
import { useNotifications } from "../context/NotificationContext";
import { Badge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { ProgressBar } from "../components/ProgressBar";
import { DailyGrid } from "../components/DailyGrid";
import type { ProgettoOption, AllocazioneDayState } from "../components/DailyGrid";
import { Trash2, FileText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import styles from "./GlobalBustePaga.module.css";

type BadgeVariant = "success" | "warning" | "error" | "neutral";

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  ok: { variant: "success", label: "OK" },
  revisione_manuale: { variant: "warning", label: "Da verificare" },
  errore: { variant: "error", label: "Errore" },
  pending: { variant: "neutral", label: "In elaborazione" },
};

type GlobalBustaPaga = BustaPaga & {
  lavoratore_nome?: string;
  lavoratore_cognome?: string;
  ore_allocate: number;
  ore_non_progetto: number;
};

function parseOreGiornaliere(raw?: string | null): OreGiornaliere[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function parseDettaglioOre(raw?: string | null): DettaglioOre | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const DETTAGLIO_LABELS: Record<string, string> = {
  ore_ordinarie: "Ordinarie",
  ore_straordinario: "Straordinario",
  ore_festivita: "Festività",
  ore_assenza: "Assenza",
};

function DettaglioOreSummary({ dettaglio }: { dettaglio: DettaglioOre }) {
  const entries = Object.entries(dettaglio).filter(([, v]) => v != null && v > 0) as [string, number][];
  if (entries.length === 0) return null;

  return (
    <div className={styles.dettaglio}>
      <div className={styles.dettaglioHeader}>Dettaglio ore</div>
      <div className={styles.dettaglioList}>
        {entries.map(([key, value]) => (
          <div key={key} className={styles.dettaglioItem}>
            <span className={styles.dettaglioLabel}>{DETTAGLIO_LABELS[key] ?? key}</span>
            <span className={styles.dettaglioValue}>{value}h</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildAllocazioniMap(giornaliere: AllocazioneGiornaliera[]): Map<number, AllocazioneDayState> {
  const map = new Map<number, AllocazioneDayState>();
  for (const g of giornaliere) {
    map.set(g.giorno, {
      progetto_id: g.progetto_id,
      persona_id: g.persona_id,
      categoria_non_progetto: g.categoria_non_progetto,
    });
  }
  return map;
}

export default function GlobalBustePaga({ lavoratoreId }: { lavoratoreId?: string } = {}) {
  const { addNotification } = useNotifications();
  const [bustePaga, setBustePaga] = useState<GlobalBustaPaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, ProgettoOption[]>>({});
  const [giornaliereMap, setGiornaliereMap] = useState<Record<string, AllocazioneGiornaliera[]>>({});
  const [savingDay, setSavingDay] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPendingRef = useRef(0);
  const originalTitleRef = useRef(document.title);

  const load = useCallback(() => {
    getGlobalBustePaga(lavoratoreId ? { lavoratore_id: lavoratoreId } : undefined)
      .then(setBustePaga)
      .finally(() => setLoading(false));
  }, [lavoratoreId]);

  // Poll while any row is pending + update tab title on completion
  useEffect(() => {
    const pendingCount = bustePaga.filter((bp) => bp.stato_parsing === "pending").length;
    const prevPending = prevPendingRef.current;

    if (pendingCount > 0 && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (pendingCount === 0 && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (prevPending > 0 && pendingCount < prevPending) {
      const justFinished = prevPending - pendingCount;
      document.title = `(${justFinished}) Elaborazione completata`;
      addNotification({
        kind: "success",
        title: justFinished === 1 ? "Busta paga elaborata" : `${justFinished} buste paga elaborate`,
        message: "L'estrazione dei dati è completata. Puoi ora allocare le ore.",
      });
    }
    prevPendingRef.current = pendingCount;

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [bustePaga, load, addNotification]);

  // Restore original title when user focuses the tab
  useEffect(() => {
    const restore = () => { document.title = originalTitleRef.current; };
    window.addEventListener("focus", restore);
    return () => window.removeEventListener("focus", restore);
  }, []);

  useEffect(load, [load]);

  // Load lavoratore projects + giornaliere when expanding
  useEffect(() => {
    if (!expandedId) return;
    const bp = bustePaga.find((b) => b.id === expandedId);
    if (!bp?.lavoratore_id) return;
    if (expandedProjects[expandedId] !== undefined) return;

    Promise.all([
      getLavoratore(bp.lavoratore_id),
      getGiornaliere(expandedId),
    ]).then(([lav, giornaliere]) => {
      const progetti: ProgettoOption[] = lav.progetti.map((p) => ({
        progetto_id: p.id,
        progetto_nome: p.progetto_nome,
        codice_progetto: p.codice_progetto,
        persona_id: p.persona_id,
        color: p.color,
      }));
      setExpandedProjects((prev) => ({ ...prev, [expandedId]: progetti }));
      setGiornaliereMap((prev) => ({ ...prev, [expandedId]: giornaliere }));
    });
  }, [expandedId, bustePaga, expandedProjects]);

  const handleDelete = async (id: string) => {
    await deleteGlobalBustaPaga(id);
    load();
  };

  const handleAllocaGiorno = async (bp: GlobalBustaPaga, giorno: number, alloc: AllocazioneDayState | null) => {
    const oreGiornaliere = parseOreGiornaliere(bp.ore_giornaliere);
    const dayData = oreGiornaliere.find((g) => g.giorno === giorno);
    const ore = dayData ? dayData.ordinarie + dayData.straordinario : 0;

    const existing = giornaliereMap[bp.id] ?? [];
    const filtered = existing.filter((g) => g.giorno !== giorno);
    const updated = alloc && ore > 0
      ? [...filtered, { giorno, ore, ...alloc }]
      : filtered;

    const allocazioni = updated.map((g) => ({
      giorno: g.giorno,
      ore: g.ore,
      progetto_id: g.progetto_id,
      persona_id: g.persona_id,
      categoria_non_progetto: g.categoria_non_progetto,
    }));

    setSavingDay(true);
    try {
      const result = await saveGiornaliere(bp.id, { allocazioni });
      setGiornaliereMap((prev) => ({ ...prev, [bp.id]: result }));
      load();
    } finally {
      setSavingDay(false);
    }
  };

  const lavoratoreLabel = (bp: GlobalBustaPaga) => {
    const parts = [bp.lavoratore_nome, bp.lavoratore_cognome].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const estratto = [bp.nome_estratto, bp.cognome_estratto].filter(Boolean);
    return estratto.length > 0 ? estratto.join(" ") : "—";
  };

  if (loading) return <p className={styles.loading}>Caricamento...</p>;

  return (
    <div className={styles.page}>
      {!lavoratoreId && (
        <div className={styles.header}>
          <h1 className={styles.title}>Buste Paga</h1>
        </div>
      )}

      {bustePaga.length === 0 ? (
        <EmptyState icon={FileText}>
          Nessuna busta paga caricata.
        </EmptyState>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.tableHead}>
                <th className={styles.th}></th>
                <th className={styles.th}>Lavoratore</th>
                <th className={styles.th}>Mese</th>
                <th className={styles.thRight}>Ore Totali</th>
                <th className={styles.thRight}>Ore Allocate</th>
                <th className={styles.thRight}>Ore Non Progetto</th>
                <th className={styles.thRight}>Rimanenti</th>
                <th className={styles.th}>Allocazione</th>
                <th className={styles.th}>Stato</th>
                <th className={styles.th}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {bustePaga.map((bp, i) => {
                const isPending = bp.stato_parsing === "pending";
                const oreTotal = bp.ore_estratte ?? 0;
                const allocated = bp.ore_allocate + bp.ore_non_progetto;
                const rimanenti = oreTotal - allocated;
                const badge = STATUS_BADGE[bp.stato_parsing] ?? STATUS_BADGE.pending;
                const oreGiornaliere = parseOreGiornaliere(bp.ore_giornaliere);
                const dettaglio = parseDettaglioOre(bp.dettaglio_ore);
                const hasDetail = oreGiornaliere.length > 0 || dettaglio;
                const isExpanded = expandedId === bp.id;

                return (
                  <motion.tr
                    key={bp.id}
                    className={`${styles.row} ${isPending ? styles.rowPending : ""}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                  >
                    <td className={styles.tdExpand}>
                      {isPending ? (
                        <Loader2 size={14} className={styles.spinner} />
                      ) : hasDetail ? (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : bp.id)}
                          className={styles.expandButton}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      ) : null}
                    </td>
                    <td className={styles.tdName}>
                      {isPending ? bp.file_name : lavoratoreLabel(bp)}
                    </td>
                    <td className={styles.tdMuted}>{bp.mese || "\u2014"}</td>
                    <td className={styles.tdRight}>
                      {bp.ore_estratte != null ? bp.ore_estratte : "\u2014"}
                    </td>
                    <td className={styles.tdRight}>{isPending ? "\u2014" : bp.ore_allocate}</td>
                    <td className={styles.tdRight}>{isPending ? "\u2014" : bp.ore_non_progetto}</td>
                    <td className={styles.tdRight}>
                      {isPending ? "\u2014" : (
                        <span className={rimanenti > 0 ? styles.rimanentiWarning : styles.rimanentiOk}>
                          {rimanenti}
                        </span>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles.progressCell}`}>
                      {!isPending && (
                        <ProgressBar
                          value={allocated}
                          max={oreTotal}
                          showPercent={false}
                        />
                      )}
                    </td>
                    <td className={styles.td}>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className={styles.tdActions}>
                      <button
                        onClick={() => handleDelete(bp.id)}
                        className={styles.deleteButton}
                        title="Elimina"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          <AnimatePresence>
            {bustePaga.map((bp) => {
              const oreGiornaliere = parseOreGiornaliere(bp.ore_giornaliere);
              const dettaglio = parseDettaglioOre(bp.dettaglio_ore);
              if (expandedId !== bp.id || (!oreGiornaliere.length && !dettaglio)) return null;

              return (
                <motion.div
                  key={`detail-${bp.id}`}
                  className={styles.detailPanel}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className={styles.detailContent}>
                    {oreGiornaliere.length > 0 && bp.mese && (
                      <DailyGrid
                        mese={bp.mese}
                        oreGiornaliere={oreGiornaliere}
                        progetti={expandedProjects[bp.id] ?? []}
                        allocazioniMap={buildAllocazioniMap(giornaliereMap[bp.id] ?? [])}
                        onAllocaGiorno={(giorno, alloc) => handleAllocaGiorno(bp, giorno, alloc)}
                        saving={savingDay}
                      />
                    )}
                    {dettaglio && <DettaglioOreSummary dettaglio={dettaglio} />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
