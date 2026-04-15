import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { triageHistory, bulkDeleteTriageDocuments, deleteTriageDocument, triageFileUrl } from "../api/client";
import type { TriageResult } from "../api/client";
import { Badge } from "../components/Badge";
import { useBreadcrumb } from "../context/BreadcrumbContext";
import { Trash2, ChevronDown, X, FileText } from "lucide-react";
import styles from "./DocumentiArchivio.module.css";

const CATEGORY_LABELS: Record<string, string> = {
  busta_paga: "Busta paga", timecard: "Timecard", f24: "F24", bonifico: "Bonifico",
  fattura: "Fattura", ordine_servizio: "Ordine di servizio", prospetto_costo_orario: "Prospetto costo orario",
  lettera_incarico: "Lettera d'incarico", cv: "CV", relazione_attivita: "Relazione attività",
  relazione_finale: "Relazione finale", dichiarazione_irap: "Dichiarazione IRAP",
  scheda_finanziaria: "Scheda finanziaria", registri_presenze: "Registri presenze",
  non_pertinente: "Non pertinente", pending: "In corso",
};

const ESITO_BADGE: Record<string, { text: string; variant: "success" | "warning" | "error" | "neutral" }> = {
  auto_assegnato: { text: "Auto", variant: "success" },
  assegnato_manuale: { text: "Manuale", variant: "success" },
  non_pertinente: { text: "N/A", variant: "neutral" },
  ignorato: { text: "Ignorato", variant: "neutral" },
  errore: { text: "Errore", variant: "error" },
  pending: { text: "In corso", variant: "warning" },
};

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function DocumentiArchivio() {
  useBreadcrumb([{ label: "Home", to: "/" }, { label: "Archivio Documenti" }]);

  const [docs, setDocs] = useState<TriageResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewingDoc, setViewingDoc] = useState<{ id: string; name: string } | null>(null);

  const load = () => triageHistory().then(setDocs);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await deleteTriageDocument(id);
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    if (expandedId === id) setExpandedId(null);
    load();
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    await bulkDeleteTriageDocuments([...selected]);
    setSelected(new Set());
    setExpandedId(null);
    load();
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === docs.length) setSelected(new Set());
    else setSelected(new Set(docs.map((d) => d.id)));
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Archivio Documenti</h1>
          <p className={styles.subtitle}>{docs.length} documenti</p>
        </div>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete} className={styles.bulkDelete}>
            <Trash2 size={14} />
            Elimina {selected.size} selezionat{selected.size === 1 ? "o" : "i"}
          </button>
        )}
      </div>

      {docs.length === 0 ? (
        <p className={styles.empty}>Nessun documento nell'archivio.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCheck}>
                  <input
                    type="checkbox"
                    checked={selected.size === docs.length && docs.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className={styles.th}>Categoria</th>
                <th className={styles.th}>Persona</th>
                <th className={styles.th}>Mese</th>
                <th className={styles.th}>Progetto</th>
                <th className={styles.th}>Codice</th>
                <th className={styles.th}>Esito</th>
                <th className={styles.th}>File</th>
                <th className={styles.th}>Data</th>
                <th className={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const esito = ESITO_BADGE[d.esito] ?? ESITO_BADGE.pending;
                const persona = [d.persona_nome, d.persona_cognome].filter(Boolean).join(" ");
                const isExpanded = expandedId === d.id;
                const hasMotivo = !!d.motivo;
                const isSelected = selected.has(d.id);

                return (
                  <>
                    <tr
                      key={d.id}
                      className={`${styles.row} ${isExpanded ? styles.rowExpanded : ""} ${isSelected ? styles.rowSelected : ""} ${hasMotivo ? styles.rowClickable : ""}`}
                      onClick={() => hasMotivo && setExpandedId(isExpanded ? null : d.id)}
                    >
                      <td className={styles.tdCheck} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(d.id)} />
                      </td>
                      <td className={styles.td}>
                        <Badge variant="neutral">{CATEGORY_LABELS[d.categoria] ?? d.categoria}</Badge>
                      </td>
                      <td className={styles.td}>
                        {d.matched_lavoratore_id ? (
                          <Link to={`/lavoratori/${d.matched_lavoratore_id}`} className={styles.pill} onClick={(e) => e.stopPropagation()}>
                            <span className={styles.pillDot} />
                            {d.matched_lavoratore_nome || persona}
                          </Link>
                        ) : persona ? (
                          <span className={styles.pillMuted}>
                            <span className={styles.pillDotMuted} />
                            {persona}
                          </span>
                        ) : "—"}
                      </td>
                      <td className={styles.td}>{d.mese || "—"}</td>
                      <td className={styles.td}>
                        {d.matched_project_id ? (
                          <Link to={`/projects/${d.matched_project_id}`} className={styles.pill} onClick={(e) => e.stopPropagation()}>
                            <span className={styles.pillDot} />
                            {d.matched_project_nome}
                          </Link>
                        ) : d.progetto_nome_doc ? (
                          <span className={styles.pillError}>
                            <span className={styles.pillDotError} />
                            {d.progetto_nome_doc}
                          </span>
                        ) : "—"}
                      </td>
                      <td className={styles.tdCode}>{d.progetto_codice_doc || "—"}</td>
                      <td className={styles.td}>
                        <Badge variant={esito.variant}>{esito.text}</Badge>
                      </td>
                      <td className={styles.tdFile}>
                        <button
                          className={styles.fileButton}
                          onClick={(e) => { e.stopPropagation(); setViewingDoc({ id: d.id, name: d.file_name }); }}
                          title={d.file_name}
                        >
                          <FileText size={12} />
                          {d.file_name}
                        </button>
                      </td>
                      <td className={styles.tdDate}>{formatDate(d.created_at)}</td>
                      <td className={styles.tdActions}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                          className={styles.deleteButton}
                          title="Elimina"
                        >
                          <Trash2 size={14} />
                        </button>
                        {hasMotivo && (
                          <ChevronDown size={22} className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`} />
                        )}
                      </td>
                    </tr>
                    {isExpanded && d.motivo && (
                      <tr key={`${d.id}-detail`} className={styles.detailRow}>
                        <td colSpan={10} className={styles.detailCell}>
                          <div className={styles.detailContent}>{d.motivo}</div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Document viewer modal */}
      {viewingDoc && (
        <div className={styles.overlay} onClick={() => setViewingDoc(null)}>
          <div className={styles.viewer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.viewerHeader}>
              <span className={styles.viewerTitle}>{viewingDoc.name}</span>
              <button onClick={() => setViewingDoc(null)} className={styles.viewerClose}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.viewerBody}>
              {/\.(pdf|docx?|xlsx?)$/i.test(viewingDoc.name) ? (
                <iframe
                  src={triageFileUrl(viewingDoc.id)}
                  className={styles.viewerIframe}
                  title={viewingDoc.name}
                />
              ) : /\.(jpe?g|png|gif|webp)$/i.test(viewingDoc.name) ? (
                <img
                  src={triageFileUrl(viewingDoc.id)}
                  className={styles.viewerImage}
                  alt={viewingDoc.name}
                />
              ) : (
                <div className={styles.viewerFallback}>
                  <p>Anteprima non disponibile per questo tipo di file.</p>
                  <a href={triageFileUrl(viewingDoc.id)} download={viewingDoc.name} className={styles.viewerDownload}>
                    Scarica file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
