import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Plus, Trash2, Sparkles, Save, Loader2 } from "lucide-react";
import {
  getGlobalBustaPaga,
  saveAllocazioni,
  suggestAllocazione,
} from "../api/client";
import type {
  CategoriaOreNonProgetto,
  SaveAllocazioniRequest,
} from "../types";
import { ORE_NON_PROGETTO_LABELS } from "../helpers";
import styles from "./AllocationModal.module.css";

const CATEGORIE = Object.keys(ORE_NON_PROGETTO_LABELS) as CategoriaOreNonProgetto[];

interface ProgettoAssignment {
  progetto_id: string;
  progetto_nome: string;
  codice_progetto: string;
  persona_id: string;
  costo_orario: number | null;
}

interface AllocationModalProps {
  bustaPagaId: string;
  lavoratoreNome: string;
  mese: string;
  oreTotali: number;
  progetti: ProgettoAssignment[];
  onClose: () => void;
  onSaved: () => void;
}

interface ProjectAlloc {
  progetto_id: string;
  persona_id: string;
  ore: number;
}

interface NonProjectRow {
  key: number;
  categoria: CategoriaOreNonProgetto;
  ore: number;
}

export function AllocationModal({
  bustaPagaId,
  lavoratoreNome,
  mese,
  oreTotali,
  progetti,
  onClose,
  onSaved,
}: AllocationModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [projectAllocs, setProjectAllocs] = useState<ProjectAlloc[]>([]);
  const [nonProjectRows, setNonProjectRows] = useState<NonProjectRow[]>([]);
  const [nextKey, setNextKey] = useState(0);

  // Load existing allocations
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getGlobalBustaPaga(bustaPagaId)
      .then((bp) => {
        if (cancelled) return;

        // Initialize project allocations from existing data or defaults
        const allocMap = new Map(
          bp.allocazioni.map((a) => [a.progetto_id, a.ore])
        );
        setProjectAllocs(
          progetti.map((p) => ({
            progetto_id: p.progetto_id,
            persona_id: p.persona_id,
            ore: allocMap.get(p.progetto_id) ?? 0,
          }))
        );

        // Initialize non-project rows
        let k = 0;
        if (bp.ore_non_progetto.length > 0) {
          setNonProjectRows(
            bp.ore_non_progetto.map((onp) => ({
              key: k++,
              categoria: onp.categoria,
              ore: onp.ore,
            }))
          );
        } else {
          setNonProjectRows([]);
        }
        setNextKey(k);
      })
      .catch(() => {
        // On error, initialize with defaults
        setProjectAllocs(
          progetti.map((p) => ({
            progetto_id: p.progetto_id,
            persona_id: p.persona_id,
            ore: 0,
          }))
        );
        setNonProjectRows([]);
        setNextKey(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bustaPagaId, progetti]);

  // Computed totals
  const oreAllocate = projectAllocs.reduce((s, a) => s + a.ore, 0);
  const oreNonProgetto = nonProjectRows.reduce((s, r) => s + r.ore, 0);
  const oreRimanenti = oreTotali - oreAllocate - oreNonProgetto;

  const updateProjectOre = useCallback(
    (progettoId: string, ore: number) => {
      setProjectAllocs((prev) =>
        prev.map((a) => (a.progetto_id === progettoId ? { ...a, ore } : a))
      );
    },
    []
  );

  const updateNonProjectRow = useCallback(
    (key: number, field: "categoria" | "ore", value: CategoriaOreNonProgetto | number) => {
      setNonProjectRows((prev) =>
        prev.map((r) =>
          r.key === key ? { ...r, [field]: value } : r
        )
      );
    },
    []
  );

  const addNonProjectRow = useCallback(() => {
    setNonProjectRows((prev) => [
      ...prev,
      { key: nextKey, categoria: "riunioni", ore: 0 },
    ]);
    setNextKey((k) => k + 1);
  }, [nextKey]);

  const removeNonProjectRow = useCallback((key: number) => {
    setNonProjectRows((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const suggestion = await suggestAllocazione(bustaPagaId);

      // Apply project suggestions
      const suggestMap = new Map(
        suggestion.allocazioni.map((a) => [a.progetto_id, a.ore])
      );
      setProjectAllocs((prev) =>
        prev.map((pa) => ({
          ...pa,
          ore: suggestMap.get(pa.progetto_id) ?? pa.ore,
        }))
      );

      // Apply non-project suggestions
      let k = nextKey;
      const newNpRows: NonProjectRow[] = suggestion.ore_non_progetto.map(
        (onp) => ({
          key: k++,
          categoria: onp.categoria,
          ore: onp.ore,
        })
      );
      setNonProjectRows(newNpRows);
      setNextKey(k);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore suggerimento IA");
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: SaveAllocazioniRequest = {
        allocazioni: projectAllocs
          .filter((a) => a.ore > 0)
          .map((a) => ({
            progetto_id: a.progetto_id,
            persona_id: a.persona_id,
            ore: a.ore,
          })),
        ore_non_progetto: nonProjectRows
          .filter((r) => r.ore > 0)
          .map((r) => ({
            categoria: r.categoria,
            ore: r.ore,
          })),
      };
      await saveAllocazioni(bustaPagaId, data);
      onSaved();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const remainingClass =
    oreRimanenti === 0
      ? styles.remainingBalanced
      : oreRimanenti < 0
        ? styles.remainingOver
        : styles.remainingUnder;

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h3 className={styles.title}>
                Allocazione ore — {lavoratoreNome}
              </h3>
              <div className={styles.subtitle}>
                <span>{mese}</span>
                <span>&middot;</span>
                <span>{oreTotali} ore totali</span>
              </div>
            </div>
            <button
              className={styles.closeButton}
              onClick={onClose}
              title="Chiudi"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          {loading ? (
            <div className={styles.loadingContainer}>
              <Loader2 size={20} className={styles.spinner} />
            </div>
          ) : (
            <div className={styles.body}>
              {/* Project allocations */}
              <div>
                <div className={styles.sectionTitle}>Ore progetto</div>
                <div className={styles.projectRows}>
                  {progetti.map((p) => {
                    const alloc = projectAllocs.find(
                      (a) => a.progetto_id === p.progetto_id
                    );
                    const ore = alloc?.ore ?? 0;
                    const costoTotale =
                      p.costo_orario != null ? ore * p.costo_orario : null;

                    return (
                      <div key={p.progetto_id} className={styles.projectRow}>
                        <div>
                          <div className={styles.projectName}>
                            {p.progetto_nome}
                          </div>
                          <div className={styles.projectCode}>
                            {p.codice_progetto}
                          </div>
                        </div>
                        <input
                          type="number"
                          className={styles.hoursInput}
                          min={0}
                          step={0.5}
                          value={ore || ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateProjectOre(
                              p.progetto_id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                        <div className={styles.costDisplay}>
                          {p.costo_orario != null
                            ? `${ore} x ${p.costo_orario.toFixed(2)} = ${costoTotale!.toFixed(2)}`
                            : "Costo n/d"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Non-project hours */}
              <div className={styles.nonProjectSection}>
                <div className={styles.nonProjectHeader}>
                  <div className={styles.sectionTitle}>Ore non progetto</div>
                  <button
                    className={styles.addRowButton}
                    onClick={addNonProjectRow}
                  >
                    <Plus size={14} />
                    Aggiungi
                  </button>
                </div>
                {nonProjectRows.length === 0 ? (
                  <div className={styles.emptyHint}>
                    Nessuna ora non-progetto. Clicca "Aggiungi" per inserire
                    ferie, malattia, ecc.
                  </div>
                ) : (
                  <div className={styles.nonProjectRows}>
                    {nonProjectRows.map((row) => (
                      <div key={row.key} className={styles.nonProjectRow}>
                        <select
                          className={styles.categorySelect}
                          value={row.categoria}
                          onChange={(e) =>
                            updateNonProjectRow(
                              row.key,
                              "categoria",
                              e.target.value as CategoriaOreNonProgetto
                            )
                          }
                        >
                          {CATEGORIE.map((cat) => (
                            <option key={cat} value={cat}>
                              {ORE_NON_PROGETTO_LABELS[cat]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          className={styles.hoursInput}
                          min={0}
                          step={0.5}
                          value={row.ore || ""}
                          placeholder="0"
                          onChange={(e) =>
                            updateNonProjectRow(
                              row.key,
                              "ore",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                        <button
                          className={styles.removeRowButton}
                          onClick={() => removeNonProjectRow(row.key)}
                          title="Rimuovi"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Totals bar */}
          {!loading && (
            <div className={styles.totalsBar}>
              <div className={styles.totalItem}>
                Allocate:{" "}
                <span className={styles.totalValue}>{oreAllocate}</span>
              </div>
              <div className={styles.totalItem}>
                Non-progetto:{" "}
                <span className={styles.totalValue}>{oreNonProgetto}</span>
              </div>
              <div className={styles.totalItem}>
                Rimanenti:{" "}
                <span className={remainingClass}>{oreRimanenti}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={styles.footer}>
            <button
              className={styles.suggestButton}
              onClick={handleSuggest}
              disabled={suggesting || loading}
            >
              {suggesting ? (
                <Loader2 size={14} className={styles.spinner} />
              ) : (
                <Sparkles size={14} />
              )}
              Suggerisci con IA
            </button>
            <div className={styles.footerSpacer} />
            <button className={styles.cancelButton} onClick={onClose}>
              Annulla
            </button>
            <button
              className={styles.confirmButton}
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <Loader2 size={14} className={styles.spinner} />
              ) : (
                <Save size={14} />
              )}
              Salva
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
