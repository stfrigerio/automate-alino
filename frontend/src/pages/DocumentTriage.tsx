import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  triageDocuments,
  triageStatus,
  triageHistory,
  commitTriageDocument,
  dismissTriageDocument,
  deleteTriageDocument,
  linkTriageLavoratore,
  createLavoratore,
  getProjects,
} from "../api/client";
import type { TriageResult } from "../api/client";
import type { Project, Lavoratore } from "../types";
import { DropZone } from "../components/DropZone";
import { Badge } from "../components/Badge";
import { Check, AlertTriangle, X, FolderOpen, Loader2, ChevronDown, Trash2, Plus } from "lucide-react";
import styles from "./DocumentTriage.module.css";

const CATEGORY_LABELS: Record<string, string> = {
  busta_paga: "Busta paga",
  timecard: "Timecard",
  f24: "F24",
  bonifico: "Bonifico",
  fattura: "Fattura",
  ordine_servizio: "Ordine di servizio",
  prospetto_costo_orario: "Prospetto costo orario",
  lettera_incarico: "Lettera d'incarico",
  cv: "CV",
  relazione_attivita: "Relazione attività",
  relazione_finale: "Relazione finale",
  dichiarazione_irap: "Dichiarazione IRAP",
  scheda_finanziaria: "Scheda finanziaria",
  registri_presenze: "Registri presenze",
  non_pertinente: "Non pertinente",
};

export default function DocumentTriage() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<TriageResult[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [committed, setCommitted] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [assignProject, setAssignProject] = useState<Record<string, string>>({});
  const [addingPerson, setAddingPerson] = useState<string | null>(null); // triage id being processed
  const [history, setHistory] = useState<TriageResult[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const itemIdsRef = useRef<string[]>([]);

  // Load history on mount
  useEffect(() => {
    triageHistory().then(setHistory);
  }, []);

  // Poll for classification results
  const pollResults = useCallback(async () => {
    if (itemIdsRef.current.length === 0) return;
    try {
      const updated = await triageStatus(itemIdsRef.current);
      setResults(updated);

      const allDone = updated.every((r) => r.status === "done");
      if (allDone && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setUploading(false);

        // Auto-commit items that need no action
        for (const r of updated) {
          if (r.needs_action === "none" && r.categoria !== "non_pertinente" && r.categoria !== "pending") {
            try {
              await commitTriageDocument(r.id, {
                file_path: r.file_path,
                file_name: r.file_name,
                categoria: r.categoria,
                mese: r.mese,
                persona_nome: r.persona_nome,
                persona_cognome: r.persona_cognome,
                project_id: r.matched_project_id,
                lavoratore_id: r.matched_lavoratore_id,
              });
              setCommitted((prev) => new Set(prev).add(r.id));
            } catch { /* ignore */ }
          }
        }
        triageHistory().then(setHistory);
      }
    } catch { /* ignore poll errors */ }
  }, []);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    setResults([]);
    setCommitted(new Set());
    setDismissed(new Set());
    try {
      const [{ items }, projs] = await Promise.all([
        triageDocuments(files),
        getProjects(),
      ]);
      setResults(items);
      setProjects(projs);
      itemIdsRef.current = items.map((r) => r.id);

      // Start polling
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(pollResults, 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore upload");
      setUploading(false);
    }
  };

  const handleCommit = async (r: TriageResult, projectId: string) => {
    try {
      await commitTriageDocument(r.id, {
        file_path: r.file_path,
        file_name: r.file_name,
        categoria: r.categoria,
        mese: r.mese,
        persona_nome: r.persona_nome,
        persona_cognome: r.persona_cognome,
        project_id: projectId,
        lavoratore_id: r.matched_lavoratore_id,
      });
      setCommitted((prev) => new Set(prev).add(r.id));
      triageHistory().then(setHistory);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore");
    }
  };

  const handleDismiss = async (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    await dismissTriageDocument(id);
    triageHistory().then(setHistory);
  };

  const handleDeleteHistory = async (id: string) => {
    await deleteTriageDocument(id);
    triageHistory().then(setHistory);
  };

  const pendingItems = results.filter((r) => r.status === "pending");
  const doneItems = results.filter((r) => r.status === "done");
  const autoCommitted = doneItems.filter((r) => committed.has(r.id) && r.needs_action === "none");
  const needsAction = doneItems.filter((r) => !committed.has(r.id) && !dismissed.has(r.id) && r.needs_action !== "none");
  const unknownPersons = doneItems.filter((r) =>
    !committed.has(r.id) && !dismissed.has(r.id) &&
    (r.persona_nome || r.persona_cognome) && !r.matched_lavoratore_id &&
    r.categoria !== "non_pertinente",
  );
  const nonPertinenti = doneItems.filter((r) => r.categoria === "non_pertinente");
  const manuallyCommitted = doneItems.filter((r) => committed.has(r.id) && r.needs_action !== "none");

  const handleAddPerson = async (r: TriageResult) => {
    setAddingPerson(r.id);
    try {
      const lav = await createLavoratore({ nome: r.persona_nome || "", cognome: r.persona_cognome || "" });
      await linkTriageLavoratore(r.id, lav.id);
      setCommitted((prev) => new Set(prev).add(r.id));
      triageHistory().then(setHistory);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore");
    } finally {
      setAddingPerson(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Documenti</h1>
      </div>

      <DropZone
        onFilesSelected={handleUpload}
        disabled={uploading}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        label={uploading ? "Classificazione in corso..." : "Trascina qualsiasi documento qui"}
        sublabel="Buste paga, F24, timecard, fatture, CV... verranno classificati e assegnati automaticamente"
      />

      {/* Pending classification */}
      {pendingItems.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Loader2 size={18} className={styles.spinner} />
            Classificazione in corso ({pendingItems.length} di {results.length})
          </h2>
          <div className={styles.resultList}>
            {pendingItems.map((r) => (
              <div key={r.id} className={styles.resultItem}>
                <Loader2 size={14} className={styles.spinner} />
                <span className={styles.resultFile}>{r.file_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items needing user action */}
      {needsAction.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <AlertTriangle size={18} className={styles.warningIcon} />
            Richiede azione ({needsAction.length})
          </h2>
          <div className={styles.cardList}>
            {needsAction.map((r) => (
              <div key={r.id} className={styles.actionCard}>
                <div className={styles.cardHeader}>
                  <Badge variant="warning">
                    {CATEGORY_LABELS[r.categoria] ?? r.categoria}
                  </Badge>
                  <span className={styles.cardFile}>{r.file_name}</span>
                  <button onClick={() => handleDismiss(r.id)} className={styles.dismissButton} title="Ignora">
                    <X size={14} />
                  </button>
                </div>

                <div className={styles.cardMeta}>
                  {r.persona_nome && <span>Persona: <strong>{r.persona_nome} {r.persona_cognome}</strong></span>}
                  {r.mese && <span>Mese: <strong>{r.mese}</strong></span>}
                </div>

                {r.needs_action === "project_not_found" && (
                  <div className={styles.cardAlert}>
                    <p>Progetto nel documento: <strong>{r.progetto_nome_doc || r.progetto_codice_doc}</strong></p>
                    <p>Nessun progetto corrispondente trovato. Assegna a un progetto esistente o creane uno nuovo:</p>
                  </div>
                )}

                {(r.needs_action === "assign_project" || r.needs_action === "project_not_found") && (
                  <div className={styles.cardAction}>
                    <select
                      value={assignProject[r.id] ?? ""}
                      onChange={(e) => setAssignProject((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className={styles.projectSelect}
                    >
                      <option value="">— Seleziona progetto —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.codice_progetto})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => assignProject[r.id] && handleCommit(r, assignProject[r.id])}
                      disabled={!assignProject[r.id]}
                      className={styles.commitButton}
                    >
                      Assegna
                    </button>
                    {r.needs_action === "project_not_found" && (
                      <>
                        <span className={styles.cardActionSep}>oppure</span>
                        <button
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set("triage_id", r.id);
                            if (r.progetto_nome_doc) params.set("prefill_nome", r.progetto_nome_doc);
                            if (r.progetto_codice_doc) params.set("prefill_codice", r.progetto_codice_doc);
                            navigate(`/projects/new?${params.toString()}`);
                          }}
                          className={styles.createProjectButton}
                        >
                          <Plus size={14} />
                          Crea nuovo progetto
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unknown persons */}
      {unknownPersons.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <AlertTriangle size={18} className={styles.warningIcon} />
            Persone non trovate ({unknownPersons.length})
          </h2>
          <div className={styles.cardList}>
            {unknownPersons.map((r) => {
              const name = [r.persona_nome, r.persona_cognome].filter(Boolean).join(" ");
              return (
                <div key={r.id} className={styles.actionCard}>
                  <div className={styles.cardHeader}>
                    <Badge variant="warning">{CATEGORY_LABELS[r.categoria] ?? r.categoria}</Badge>
                    <span className={styles.cardFile}>{r.file_name}</span>
                    <button onClick={() => handleDismiss(r.id)} className={styles.dismissButton} title="Ignora">
                      <X size={14} />
                    </button>
                  </div>
                  <div className={styles.cardMeta}>
                    <span>Persona nel documento: <strong>{name}</strong></span>
                    {r.mese && <span>Mese: <strong>{r.mese}</strong></span>}
                  </div>
                  <div className={styles.cardAction}>
                    <button
                      onClick={() => handleAddPerson(r)}
                      disabled={addingPerson === r.id}
                      className={styles.commitButton}
                    >
                      {addingPerson === r.id ? "Aggiunta..." : `Aggiungi "${name}" come lavoratore`}
                    </button>
                    <button onClick={() => handleDismiss(r.id)} className={styles.dismissTextButton}>
                      Ignora
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto-committed items */}
      {autoCommitted.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Check size={18} className={styles.successIcon} />
            Processati automaticamente ({autoCommitted.length})
          </h2>
          <div className={styles.resultList}>
            {autoCommitted.map((r) => (
              <div key={r.id} className={styles.resultItem}>
                <Badge variant="success">{CATEGORY_LABELS[r.categoria] ?? r.categoria}</Badge>
                <span className={styles.resultFile}>{r.file_name}</span>
                {r.matched_lavoratore_nome && <span className={styles.resultMeta}>→ {r.matched_lavoratore_nome}</span>}
                {r.matched_project_nome && <span className={styles.resultMeta}>→ {r.matched_project_nome}</span>}
                {r.mese && <span className={styles.resultMeta}>{r.mese}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manually committed */}
      {manuallyCommitted.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Check size={18} className={styles.successIcon} />
            Assegnati manualmente ({manuallyCommitted.length})
          </h2>
          <div className={styles.resultList}>
            {manuallyCommitted.map((r) => (
              <div key={r.id} className={styles.resultItem}>
                <Badge variant="success">{CATEGORY_LABELS[r.categoria] ?? r.categoria}</Badge>
                <span className={styles.resultFile}>{r.file_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-pertinent */}
      {nonPertinenti.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <FolderOpen size={18} className={styles.mutedIcon} />
            Non pertinenti ({nonPertinenti.length})
          </h2>
          <div className={styles.resultList}>
            {nonPertinenti.map((r) => (
              <div key={r.id} className={`${styles.resultItem} ${styles.resultItemMuted}`}>
                <span className={styles.resultFile}>{r.file_name}</span>
                <span className={styles.resultMotivo}>{r.motivo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible history */}
      {history.length > 0 && (
        <details className={styles.historyDetails}>
          <summary className={styles.historySummary}>
            <ChevronDown size={16} className={styles.historyChevron} />
            Storico documenti
            <span className={styles.historyCount}>{history.length}</span>
          </summary>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th className={styles.historyTh}>Data</th>
                <th className={styles.historyTh}>File</th>
                <th className={styles.historyTh}>Categoria</th>
                <th className={styles.historyTh}>Progetto</th>
                <th className={styles.historyTh}>Esito</th>
                <th className={styles.historyTh}></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => {
                const esitoLabel: Record<string, { text: string; variant: "success" | "warning" | "error" | "neutral" }> = {
                  auto_assegnato: { text: "Auto", variant: "success" },
                  assegnato_manuale: { text: "Manuale", variant: "success" },
                  non_pertinente: { text: "N/A", variant: "neutral" },
                  ignorato: { text: "Ignorato", variant: "neutral" },
                  errore: { text: "Errore", variant: "error" },
                  pending: { text: "...", variant: "warning" },
                };
                const esito = esitoLabel[h.esito] ?? esitoLabel.pending;
                const projectMatched = h.matched_project_nome;
                const projectInDoc = h.progetto_nome_doc || h.progetto_codice_doc;
                return (
                  <tr key={h.id} className={styles.historyRow}>
                    <td className={styles.historyTd}>{h.created_at?.slice(5, 16).replace("T", " ")}</td>
                    <td className={styles.historyTdFile}>{h.file_name}</td>
                    <td className={styles.historyTd}>{CATEGORY_LABELS[h.categoria] ?? h.categoria}</td>
                    <td className={styles.historyTd}>
                      {projectMatched ? (
                        <span className={styles.projectMatch}>{projectMatched}</span>
                      ) : projectInDoc ? (
                        <span className={styles.projectMismatch}>{projectInDoc}</span>
                      ) : "—"}
                    </td>
                    <td className={styles.historyTd}>
                      <Badge variant={esito.variant}>{esito.text}</Badge>
                    </td>
                    <td className={styles.historyTd}>
                      <button onClick={() => handleDeleteHistory(h.id)} className={styles.historyDelete} title="Elimina">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className={styles.historyFooter}>
            <Link to="/documenti" className={styles.historyLink}>Vedi tutto →</Link>
          </div>
        </details>
      )}
    </div>
  );
}
