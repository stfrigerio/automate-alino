import { useEffect, useState } from "react";
import {
  getDocumenti,
  generaChecklist,
  getPersone,
  uploadDocumentiBulk,
  deleteDocumento,
  createPersona,
  linkDocumentoPersona,
} from "../../api/client";
import { DropZone } from "../../components/DropZone";
import { ProgressBar } from "../../components/ProgressBar";
import { EmptyState } from "../../components/EmptyState";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Circle, CircleCheck, ShieldCheck, Trash2, FolderOpen, FileCheck } from "lucide-react";
import { RUOLO_LABELS } from "../../types";
import type { DocumentoRichiesto, Persona, RuoloPersonale } from "../../types";
import styles from "./DocumentiTab.module.css";

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

type UploadResult = DocumentoRichiesto & {
  motivo?: string;
  match_confidence?: string;
  progetto_mismatch?: { nome_doc: string | null; codice_doc: string | null };
  fuori_periodo?: { mese_doc: string; data_inizio: string; data_fine: string };
  split_from?: string;
  unknown_person?: { nome: string; cognome: string };
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function DocIcon({ stato }: { stato: string }) {
  if (stato === "verificato")
    return <ShieldCheck className={`${styles.docIcon} ${styles.docIconVerified}`} />;
  if (stato === "caricato")
    return <CircleCheck className={`${styles.docIcon} ${styles.docIconLoaded}`} />;
  return <Circle className={`${styles.docIcon} ${styles.docIconMissing}`} />;
}

export default function DocumentiTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<DocumentoRichiesto[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, currentFile: "" });
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [dismissedUnknowns, setDismissedUnknowns] = useState<Set<string>>(new Set());
  const [addingPersonaKey, setAddingPersonaKey] = useState<string | null>(null);
  const [addPersonaRuolo, setAddPersonaRuolo] = useState<RuoloPersonale>("docente_interno");
  const [addingInProgress, setAddingInProgress] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const load = () => {
    getDocumenti(projectId).then(setDocs);
    getPersone(projectId).then(setPersone);
  };
  useEffect(load, [projectId]);

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    setUploadResults([]);
    setUploadProgress({ done: 0, total: files.length, currentFile: files[0]?.name ?? "" });
    const allResults: UploadResult[] = [];
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ done: i, total: files.length, currentFile: files[i].name });
      try {
        const results = await uploadDocumentiBulk(projectId, [files[i]]);
        allResults.push(...results);
        setUploadResults([...allResults]);
      } catch (e) {
        allResults.push({ id: `err-${i}`, progetto_id: projectId, categoria: "non_pertinente", descrizione: "Errore", stato: "mancante", file_name: files[i].name, created_at: "", motivo: e instanceof Error ? e.message : "Errore upload" } as UploadResult);
        setUploadResults([...allResults]);
      }
    }
    setUploadProgress({ done: files.length, total: files.length, currentFile: "" });
    load();
    setUploading(false);
  };

  const handleGenera = async () => {
    setGenerating(true);
    try {
      const result = await generaChecklist(projectId);
      setDocs(result);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (docId: string) => {
    await deleteDocumento(projectId, docId);
    load();
  };

  const personaName = (id: string | undefined) => {
    if (!id) return null;
    const p = persone.find((p) => p.id === id);
    return p ? `${p.cognome} ${p.nome}` : null;
  };

  // Separate checklist items from ad-hoc uploads
  const checklistDocs = docs.filter((d) => d.categoria !== "non_pertinente");
  const uploadedDocs = docs.filter((d) => d.stato !== "mancante");

  // Group checklist items by persona
  const grouped = new Map<string, DocumentoRichiesto[]>();
  const projectDocs: DocumentoRichiesto[] = [];
  for (const doc of checklistDocs) {
    if (doc.persona_id) {
      const key = doc.persona_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(doc);
    } else {
      projectDocs.push(doc);
    }
  }

  const totalDocs = checklistDocs.length;
  const mancanti = checklistDocs.filter((d) => d.stato === "mancante").length;
  const caricati = totalDocs - mancanti;

  const nonPertinenti = uploadResults.filter((r) => r.categoria === "non_pertinente");
  const classified = uploadResults.filter((r) => r.categoria !== "non_pertinente");
  const mismatched = uploadResults.filter((r) => r.progetto_mismatch);
  const outOfPeriod = uploadResults.filter((r) => r.fuori_periodo);

  // Group unknown persons by name to avoid duplicates
  const unknownPersonMap = new Map<string, { nome: string; cognome: string; docIds: string[] }>();
  for (const r of uploadResults) {
    if (r.unknown_person && !dismissedUnknowns.has(r.id)) {
      const key = `${r.unknown_person.cognome}|${r.unknown_person.nome}`;
      if (!unknownPersonMap.has(key)) {
        unknownPersonMap.set(key, { nome: r.unknown_person.nome, cognome: r.unknown_person.cognome, docIds: [] });
      }
      unknownPersonMap.get(key)!.docIds.push(r.id);
    }
  }
  const unknownPersons = Array.from(unknownPersonMap.values());

  const handleAddUnknownPersona = async (nome: string, cognome: string, docIds: string[]) => {
    setAddingInProgress(true);
    try {
      const persona = await createPersona(projectId, { nome, cognome, ruolo: addPersonaRuolo });
      for (const docId of docIds) {
        await linkDocumentoPersona(projectId, docId, persona.id);
      }
      setAddingPersonaKey(null);
      setDismissedUnknowns((prev) => { const next = new Set(prev); docIds.forEach((id) => next.add(id)); return next; });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore");
    } finally {
      setAddingInProgress(false);
    }
  };

  const dismissUnknown = (docIds: string[]) => {
    setDismissedUnknowns((prev) => { const next = new Set(prev); docIds.forEach((id) => next.add(id)); return next; });
  };

  return (
    <div className={styles.container}>
      <DropZone
        onFilesSelected={handleUpload}
        disabled={uploading}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        label={uploading ? `Classificazione ${uploadProgress.done + 1}/${uploadProgress.total} — ${uploadProgress.currentFile}` : "Trascina documenti qui"}
        sublabel={uploading ? `${uploadProgress.done} completati su ${uploadProgress.total}` : "Buste paga, F24, timecard, fatture, CV... Claude li classificherà automaticamente"}
      />

      {/* Project mismatch warning */}
      {mismatched.length > 0 && (
        <div className={styles.mismatchBanner}>
          <div className={styles.mismatchIcon}>!!</div>
          <div>
            <h3 className={styles.mismatchTitle}>
              Progetto non corrispondente
            </h3>
            <p className={styles.mismatchDesc}>
              I seguenti documenti sembrano appartenere a un progetto diverso da quello corrente:
            </p>
            {mismatched.map((r) => (
              <div key={r.id} className={styles.mismatchItem}>
                <strong>{r.file_name}</strong>
                {r.progetto_mismatch?.nome_doc && (
                  <span> — Progetto nel doc: <em>{r.progetto_mismatch.nome_doc}</em></span>
                )}
                {r.progetto_mismatch?.codice_doc && (
                  <span> — Codice nel doc: <em>{r.progetto_mismatch.codice_doc}</em></span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline mismatch warning */}
      {outOfPeriod.length > 0 && (
        <div className={styles.mismatchBanner}>
          <div className={styles.mismatchIcon}>!!</div>
          <div>
            <h3 className={styles.mismatchTitle}>
              Documenti fuori dal periodo del progetto
            </h3>
            <p className={styles.mismatchDesc}>
              I seguenti documenti hanno un mese che non rientra nel periodo del progetto:
            </p>
            {outOfPeriod.map((r) => (
              <div key={r.id} className={styles.mismatchItem}>
                <strong>{r.file_name}</strong>
                <span> — Mese documento: <em>{r.fuori_periodo!.mese_doc}</em></span>
                <span> — Periodo progetto: <em>{r.fuori_periodo!.data_inizio.slice(0, 7)} → {r.fuori_periodo!.data_fine.slice(0, 7)}</em></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unknown persons warning */}
      {unknownPersons.length > 0 && (
        <div className={styles.unknownBanner}>
          <div className={styles.unknownIcon}>?</div>
          <div style={{ flex: 1 }}>
            <h3 className={styles.unknownTitle}>Persone non trovate nel progetto</h3>
            <p className={styles.unknownDesc}>
              Questi documenti menzionano persone non presenti nell'elenco del progetto:
            </p>
            {unknownPersons.map(({ nome, cognome, docIds }) => {
              const key = `${cognome}|${nome}`;
              return (
                <div key={key} className={styles.unknownItem}>
                  <strong>{cognome} {nome}</strong>
                  <span className={styles.unknownDocCount}>{docIds.length} {docIds.length === 1 ? "documento" : "documenti"}</span>
                  {addingPersonaKey === key ? (
                    <div className={styles.unknownActions}>
                      <select
                        value={addPersonaRuolo}
                        onChange={(e) => setAddPersonaRuolo(e.target.value as RuoloPersonale)}
                        className={styles.unknownSelect}
                      >
                        {Object.entries(RUOLO_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAddUnknownPersona(nome, cognome, docIds)}
                        disabled={addingInProgress}
                        className={styles.unknownConfirmButton}
                      >
                        {addingInProgress ? "..." : "Conferma"}
                      </button>
                      <button onClick={() => setAddingPersonaKey(null)} className={styles.unknownCancelButton}>
                        Annulla
                      </button>
                    </div>
                  ) : (
                    <div className={styles.unknownActions}>
                      <button onClick={() => setAddingPersonaKey(key)} className={styles.unknownAddButton}>
                        Aggiungi al progetto
                      </button>
                      <button onClick={() => dismissUnknown(docIds)} className={styles.unknownDismissButton}>
                        Non pertinente
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload results */}
      {uploadResults.length > 0 && (
        <div className={styles.uploadResults}>
          <h3 className={styles.title}>Risultati classificazione</h3>
          {classified.length > 0 && (
            <div className={styles.resultList}>
              {classified.map((r) => (
                <div key={r.id} className={styles.resultItem}>
                  <span className={styles.resultBadge}>
                    {CATEGORY_LABELS[r.categoria] ?? r.categoria}
                  </span>
                  <span className={styles.resultFile}>{r.file_name}</span>
                  {r.split_from && <span className={styles.splitBadge}>da {r.split_from}</span>}
                  {r.persona_id && (
                    <span className={styles.resultPersona}>
                      → {personaName(r.persona_id)}
                    </span>
                  )}
                  {r.unknown_person && !r.persona_id && (
                    <span className={styles.resultUnknown}>
                      ? {r.unknown_person.cognome} {r.unknown_person.nome}
                    </span>
                  )}
                  {r.mese && <span className={styles.resultMese}>{r.mese}</span>}
                  {r.motivo && <span className={styles.resultMotivo}>{r.motivo}</span>}
                </div>
              ))}
            </div>
          )}
          {nonPertinenti.length > 0 && (
            <div className={styles.nonPertinenti}>
              <h4 className={styles.nonPertinentiTitle}>
                Documenti non pertinenti ({nonPertinenti.length})
              </h4>
              {nonPertinenti.map((r) => (
                <div key={r.id} className={styles.nonPertinentiItem}>
                  <span className={styles.resultFile}>{r.file_name}</span>
                  <span className={styles.resultMotivo}>{r.motivo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Uploaded documents table */}
      {uploadedDocs.length > 0 && (
        <div>
          <h2 className={styles.title}>Documenti caricati ({uploadedDocs.length})</h2>
          <table className={styles.uploadsTable}>
            <thead>
              <tr>
                <th className={styles.uploadsTh}>File</th>
                <th className={styles.uploadsTh}>Categoria</th>
                <th className={styles.uploadsTh}>Persona</th>
                <th className={styles.uploadsTh}>Mese</th>
                <th className={styles.uploadsTh}></th>
              </tr>
            </thead>
            <tbody>
              {uploadedDocs.map((doc) => (
                <tr key={doc.id} className={styles.uploadsRow}>
                  <td className={styles.uploadsTdFile}>{doc.file_name}</td>
                  <td className={styles.uploadsTd}>
                    <span className={styles.categoryBadge}>
                      {CATEGORY_LABELS[doc.categoria] ?? doc.categoria}
                    </span>
                  </td>
                  <td className={styles.uploadsTd}>
                    {doc.persona_id ? personaName(doc.persona_id) : "—"}
                  </td>
                  <td className={styles.uploadsTd}>{doc.mese || "—"}</td>
                  <td className={styles.uploadsTdActions}>
                    <button onClick={() => handleDelete(doc.id)} className={styles.deleteButton} title="Elimina">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Checklist header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Checklist Documenti</h2>
          {totalDocs > 0 && (
            <p className={styles.subtitle}>
              {caricati} di {totalDocs} caricati
              {mancanti > 0 && (
                <span className={styles.missingCount}>({mancanti} mancanti)</span>
              )}
            </p>
          )}
        </div>
        <button onClick={handleGenera} disabled={generating} className={styles.generateButton}>
          {generating ? "Generazione..." : "Genera / Aggiorna Checklist"}
        </button>
      </div>

      {totalDocs > 0 && (
        <ProgressBar value={caricati} max={totalDocs} label="Completezza documentazione" />
      )}

      {totalDocs === 0 && (
        <EmptyState icon={FolderOpen}>
          Nessun documento nella checklist. Aggiungi persone e carica documenti, poi genera la checklist.
        </EmptyState>
      )}

      {/* Per-persona grouped cards */}
      {Array.from(grouped.entries()).map(([personaId, personaDocs]) => {
        const name = personaName(personaId) ?? "Persona sconosciuta";
        const loaded = personaDocs.filter((d) => d.stato !== "mancante").length;
        const isCollapsed = collapsed.has(personaId);
        return (
          <div key={personaId} className={styles.group}>
            <button type="button" className={styles.groupHeader} onClick={() => toggleGroup(personaId)}>
              <div className={styles.groupAvatar}>{getInitials(name)}</div>
              <span className={styles.groupName}>{name}</span>
              <span className={styles.groupCount}>
                {loaded}/{personaDocs.length}
              </span>
              <ChevronDown size={20} className={`${styles.chevron} ${isCollapsed ? styles.chevronCollapsed : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  className={styles.docList}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                >
                  {personaDocs.map((doc) => (
                    <div key={doc.id} className={styles.docItem}>
                      <DocIcon stato={doc.stato} />
                      <span className={`${styles.docText} ${doc.stato === "mancante" ? styles.docTextMissing : styles.docTextLoaded}`}>
                        {doc.descrizione}
                      </span>
                      {doc.file_name && (
                        <span className={styles.docFileName}>{doc.file_name}</span>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Project-level documents */}
      {projectDocs.length > 0 && (
        <div className={styles.group}>
          <button type="button" className={styles.groupHeader} onClick={() => toggleGroup("__project__")}>
            <div className={`${styles.groupAvatar} ${styles.groupAvatarProject}`}>
              <FileCheck size={14} />
            </div>
            <span className={styles.groupName}>Documenti di Progetto</span>
            <span className={styles.groupCount}>
              {projectDocs.filter((d) => d.stato !== "mancante").length}/{projectDocs.length}
            </span>
            <ChevronDown size={20} className={`${styles.chevron} ${collapsed.has("__project__") ? styles.chevronCollapsed : ""}`} />
          </button>
          <AnimatePresence initial={false}>
            {!collapsed.has("__project__") && (
              <motion.div
                className={styles.docList}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              >
                {projectDocs.map((doc) => (
                  <div key={doc.id} className={styles.docItem}>
                    <DocIcon stato={doc.stato} />
                    <span className={`${styles.docText} ${doc.stato === "mancante" ? styles.docTextMissing : styles.docTextLoaded}`}>
                      {doc.descrizione}
                    </span>
                    {doc.file_name && (
                      <span className={styles.docFileName}>{doc.file_name}</span>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
