import { useEffect, useState } from "react";
import { getProjectStats, getTipologie, updateProject, type ProjectStats } from "../../api/client";
import { RENDICONTAZIONE_LABELS } from "../../types";
import type { Project, RendicontazioneMode, Tipologia } from "../../types";
import { Pencil } from "lucide-react";
import { ProgressBar } from "../../components/ProgressBar";
import styles from "./PanoramicaTab.module.css";

const COLOR_PALETTE = [
  "#fca5a5", "#fdba74", "#fde68a", "#fef08a",
  "#86efac", "#5eead4", "#7dd3fc", "#93c5fd",
  "#a5b4fc", "#c4b5fd", "#f0abfc", "#f9a8d4",
  "#fda4af", "#bbf7d0", "#bae6fd", "#ddd6fe",
  "#fed7aa", "#cffafe", "#d9f99d", "#fbcfe8",
];

interface Props {
  project: Project;
  onProjectUpdated: (p: Project) => void;
}

export default function PanoramicaTab({ project, onProjectUpdated }: Props) {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [tipologie, setTipologie] = useState<Tipologia[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState(project.nome);
  const [codice, setCodice] = useState(project.codice_progetto);
  const [ente, setEnte] = useState(project.ente_agenzia);
  const [attivita, setAttivita] = useState(project.denominazione_attivita);
  const [dataInizio, setDataInizio] = useState(project.data_inizio);
  const [dataFine, setDataFine] = useState(project.data_fine);
  const [modalita, setModalita] = useState(project.modalita_rendicontazione);
  const [tipologiaId, setTipologiaId] = useState(project.tipologia_id ?? "");
  const [color, setColor] = useState(project.color ?? "#3b82f6");

  useEffect(() => {
    getProjectStats(project.id).then(setStats).catch(console.error);
    getTipologie().then(setTipologie).catch(console.error);
  }, [project.id]);

  const startEdit = () => {
    setNome(project.nome);
    setCodice(project.codice_progetto);
    setEnte(project.ente_agenzia);
    setAttivita(project.denominazione_attivita);
    setDataInizio(project.data_inizio);
    setDataFine(project.data_fine);
    setModalita(project.modalita_rendicontazione);
    setTipologiaId(project.tipologia_id ?? "");
    setColor(project.color ?? "#3b82f6");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProject(project.id, {
        nome,
        codice_progetto: codice,
        ente_agenzia: ente,
        denominazione_attivita: attivita,
        data_inizio: dataInizio,
        data_fine: dataFine,
        modalita_rendicontazione: modalita,
        tipologia_id: tipologiaId || undefined,
        color,
      });
      onProjectUpdated(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Dati progetto</h2>
        {!editing && (
          <button onClick={startEdit} className={styles.editButton} title="Modifica">
            <Pencil size={16} />
          </button>
        )}
      </div>

      {editing ? (
        <div className={styles.form}>
          <Field label="Nome progetto" value={nome} onChange={setNome} />
          <Field label="Codice progetto" value={codice} onChange={setCodice} />
          <Field label="Ente / Agenzia" value={ente} onChange={setEnte} />
          <Field label="Denominazione attivita" value={attivita} onChange={setAttivita} />
          <div className={styles.dateRow}>
            <Field label="Data inizio" value={dataInizio} onChange={setDataInizio} type="date" />
            <Field label="Data fine" value={dataFine} onChange={setDataFine} type="date" />
          </div>
          <div>
            <label className={styles.label}>Tipologia</label>
            <select
              value={tipologiaId}
              onChange={(e) => setTipologiaId(e.target.value)}
              className={styles.input}
            >
              <option value="">— Nessuna —</option>
              {tipologie.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={styles.label}>Modalita rendicontazione</label>
            <select
              value={modalita}
              onChange={(e) => setModalita(e.target.value as RendicontazioneMode)}
              className={styles.input}
            >
              {Object.entries(RENDICONTAZIONE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={styles.label}>Colore progetto</label>
            <div className={styles.swatchGrid}>
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.swatch} ${color === c ? styles.swatchSelected : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>
          <div className={styles.buttonRow}>
            <button onClick={handleSave} disabled={saving} className={styles.primaryButton}>
              {saving ? "Salvataggio..." : "Salva"}
            </button>
            <button onClick={() => setEditing(false)} className={styles.secondaryButton}>
              Annulla
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.infoGrid}>
          <div>
            <span className={styles.infoLabel}>Colore:</span>
            <p className={styles.infoValue}>
              <span
                className={styles.colorSwatch}
                style={{ backgroundColor: project.color ?? "#3b82f6" }}
              />
              {project.color ?? "—"}
            </p>
          </div>
          <div>
            <span className={styles.infoLabel}>Tipologia:</span>
            <p className={styles.infoValue}>{project.tipologia_nome || "—"}</p>
          </div>
          <div>
            <span className={styles.infoLabel}>Ente / Agenzia:</span>
            <p className={styles.infoValue}>{project.ente_agenzia || "—"}</p>
          </div>
          <div>
            <span className={styles.infoLabel}>Denominazione attivita:</span>
            <p className={styles.infoValue}>{project.denominazione_attivita || "—"}</p>
          </div>
          <div>
            <span className={styles.infoLabel}>Data inizio:</span>
            <p className={styles.infoValue}>{project.data_inizio || "—"}</p>
          </div>
          <div>
            <span className={styles.infoLabel}>Data fine:</span>
            <p className={styles.infoValue}>{project.data_fine || "—"}</p>
          </div>
        </div>
      )}

      {stats && (
        <>
          <div className={styles.statsGrid}>
            <StatCard label="Persone" value={stats.persone} />
            <StatCard label="Buste paga" value={stats.buste_paga} />
            <StatCard label="Timecard" value={stats.timecards} />
            <StatCard
              label="Documenti"
              value={`${stats.documenti_caricati}/${stats.documenti_totali}`}
            />
          </div>

          {stats.documenti_totali > 0 && (
            <div>
              <ProgressBar
                value={stats.documenti_caricati}
                max={stats.documenti_totali}
                label="Completezza documentazione"
              />
              {stats.documenti_mancanti > 0 && (
                <p className={styles.warningText}>
                  {stats.documenti_mancanti} documenti mancanti
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className={styles.label}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={styles.input} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{label}</p>
    </div>
  );
}
