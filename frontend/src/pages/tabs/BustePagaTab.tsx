import { useEffect, useState } from "react";
import {
  getBustePaga,
  uploadBustePaga,
  getPersone,
  updateBustaPaga,
  deleteBustaPaga,
  getLavoratore,
} from "../../api/client";
import { DropZone } from "../../components/DropZone";
import { AllocationModal } from "../../components/AllocationModal";
import type { BustaPaga, Persona } from "../../types";
import { Trash2, SplitSquareHorizontal } from "lucide-react";
import { Badge } from "../../components/Badge";
import { AnimatePresence, motion } from "motion/react";
import styles from "./BustePagaTab.module.css";

type BadgeVariant = "success" | "warning" | "error" | "neutral";

const STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  ok: { variant: "success", label: "OK" },
  revisione_manuale: { variant: "warning", label: "Da verificare" },
  errore: { variant: "error", label: "Errore" },
  pending: { variant: "neutral", label: "In attesa" },
};

interface CostMismatch {
  bpId: string;
  nome: string;
  costoEstratto: number;
  costoDb: number;
}

type BustaPagaWithAlloc = BustaPaga & { ore_allocate?: number; lavoratore_nome?: string; lavoratore_cognome?: string; alloc_persona_id?: string };

interface AllocModalState {
  bustaPagaId: string;
  lavoratoreNome: string;
  mese: string;
  oreTotali: number;
  progetti: { progetto_id: string; progetto_nome: string; codice_progetto: string; persona_id: string; costo_orario: number | null }[];
}

export default function BustePagaTab({ projectId }: { projectId: string }) {
  const [bustePaga, setBustePaga] = useState<BustaPagaWithAlloc[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [uploading, setUploading] = useState(false);
  const [costMismatch, setCostMismatch] = useState<CostMismatch | null>(null);
  const [allocModal, setAllocModal] = useState<AllocModalState | null>(null);

  const load = () => {
    getBustePaga(projectId).then(setBustePaga);
    getPersone(projectId).then(setPersone);
  };
  useEffect(load, [projectId]);

  const checkCostMismatch = (bpList: BustaPaga[], personeList: Persona[]) => {
    for (const bp of bpList) {
      if (bp.costo_orario_estratto != null && bp.persona_id) {
        const persona = personeList.find((p) => p.id === bp.persona_id);
        if (persona?.costo_orario != null && persona.costo_orario !== bp.costo_orario_estratto) {
          const nome = `${bp.nome_estratto ?? ""} ${bp.cognome_estratto ?? ""}`.trim() || "Sconosciuto";
          setCostMismatch({
            bpId: bp.id,
            nome,
            costoEstratto: bp.costo_orario_estratto,
            costoDb: persona.costo_orario,
          });
          return;
        }
      }
    }
  };

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    try {
      const uploaded = await uploadBustePaga(projectId, files);
      const [freshBp, freshPersone] = await Promise.all([
        getBustePaga(projectId),
        getPersone(projectId),
      ]);
      setBustePaga(freshBp);
      setPersone(freshPersone);
      checkCostMismatch(uploaded, freshPersone);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (bpId: string) => {
    await deleteBustaPaga(projectId, bpId);
    load();
  };

  const openAllocation = async (bp: BustaPagaWithAlloc) => {
    if (!bp.lavoratore_id) return;
    try {
      const lav = await getLavoratore(bp.lavoratore_id);
      setAllocModal({
        bustaPagaId: bp.id,
        lavoratoreNome: `${lav.cognome} ${lav.nome}`,
        mese: bp.mese,
        oreTotali: bp.ore_estratte ?? 0,
        progetti: lav.progetti.map((p) => ({
          progetto_id: p.id,
          progetto_nome: p.progetto_nome,
          codice_progetto: p.codice_progetto,
          persona_id: p.persona_id,
          costo_orario: p.costo_orario,
        })),
      });
    } catch {
      // fallback: no allocation modal
    }
  };

  const handleMatch = async (bpId: string, personaId: string) => {
    await updateBustaPaga(projectId, bpId, {
      persona_id: personaId || undefined,
      stato_parsing: personaId ? "ok" : "revisione_manuale",
    });
    load();
  };

  return (
    <div className={styles.container}>
      <DropZone
        onFilesSelected={handleUpload}
        disabled={uploading}
        label={uploading ? "Analisi in corso..." : "Trascina le buste paga PDF qui"}
        sublabel="Il sistema estrarra automaticamente nome, ore e mese"
      />

      {bustePaga.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHead}>
              <th className={styles.th}>File</th>
              <th className={styles.th}>Nome estratto</th>
              <th className={styles.th}>Persona abbinata</th>
              <th className={styles.th}>Mese</th>
              <th className={styles.thRight}>Ore totali</th>
              <th className={styles.thRight}>Ore progetto</th>
              <th className={styles.thRight}>Costo/h</th>
              <th className={styles.th}>Stato</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {bustePaga.map((bp) => {
              const badge = STATUS_BADGE[bp.stato_parsing] ?? STATUS_BADGE.pending;
              return (
                <tr key={bp.id} className={styles.row}>
                  <td className={styles.tdFile}>{bp.file_name}</td>
                  <td className={styles.tdMuted}>
                    {bp.nome_estratto || bp.cognome_estratto
                      ? `${bp.nome_estratto ?? ""} ${bp.cognome_estratto ?? ""}`.trim()
                      : "—"}
                  </td>
                  <td className={styles.td}>
                    <select
                      value={bp.persona_id ?? ""}
                      onChange={(e) => handleMatch(bp.id, e.target.value)}
                      className={!bp.persona_id ? styles.selectUnmatched : styles.selectMatched}
                    >
                      <option value="">— Seleziona —</option>
                      {persone.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.cognome} {p.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={styles.tdMuted}>{bp.mese || "—"}</td>
                  <td className={styles.tdRight}>
                    {bp.ore_estratte != null ? bp.ore_estratte : "—"}
                  </td>
                  <td className={styles.tdRight}>
                    {bp.ore_allocate != null ? bp.ore_allocate : "—"}
                  </td>
                  <td className={styles.tdRight}>
                    {bp.costo_orario_estratto != null ? `€ ${bp.costo_orario_estratto.toFixed(2)}` : "—"}
                  </td>
                  <td className={styles.td}>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                  <td className={styles.tdActions}>
                    {bp.lavoratore_id && (
                      <button onClick={() => openAllocation(bp)} className={styles.allocButton} title="Alloca ore">
                        <SplitSquareHorizontal size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(bp.id)} className={styles.deleteButton} title="Elimina">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <AnimatePresence>
        {costMismatch && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <h3 className={styles.modalTitle}>Costo orario diverso</h3>
              <p className={styles.modalBody}>
                Il costo orario estratto dalla busta paga di <strong>{costMismatch.nome}</strong> non corrisponde a quello salvato nel sistema.
              </p>
              <div className={styles.compareRow}>
                <div className={`${styles.compareCard} ${styles.compareCardWarning}`}>
                  <div className={styles.compareLabel}>Busta paga</div>
                  <div className={styles.compareValue}>€ {costMismatch.costoEstratto.toFixed(2)}</div>
                </div>
                <div className={`${styles.compareCard} ${styles.compareCardInfo}`}>
                  <div className={styles.compareLabel}>Sistema</div>
                  <div className={styles.compareValue}>€ {costMismatch.costoDb.toFixed(2)}</div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button onClick={() => setCostMismatch(null)} className={styles.modalButton}>
                  Ho capito
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {allocModal && (
        <AllocationModal
          bustaPagaId={allocModal.bustaPagaId}
          lavoratoreNome={allocModal.lavoratoreNome}
          mese={allocModal.mese}
          oreTotali={allocModal.oreTotali}
          progetti={allocModal.progetti}
          onClose={() => setAllocModal(null)}
          onSaved={() => { setAllocModal(null); load(); }}
        />
      )}
    </div>
  );
}
