import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, uploadLogos, createPersona, getTipologie, createCustomTipologia } from "../api/client";
import { RUOLO_LABELS } from "../types";
import type { RendicontazioneMode, RuoloPersonale, CreatePersonaRequest, Tipologia, ChecklistRules } from "../types";
import { Trash2, Upload, ChevronDown } from "lucide-react";
import { Breadcrumb } from "../components/Breadcrumb";
import NavControls from "../components/NavControls";
import styles from "./NewProject.module.css";

type Step = 1 | 2 | 3;

const RENDICONTAZIONE_OPTIONS: { value: RendicontazioneMode; label: string; desc: string }[] = [
  { value: "staff_40", label: "Staff + 40%", desc: "Costi diretti personale + 40% forfait" },
  { value: "forfettario_7", label: "Forfettizzazione 7%", desc: "Costi diretti + 7% forfait indiretti" },
  { value: "costi_reali", label: "Costi reali", desc: "Tutti i costi documentati" },
];

function DocPreview({ tipologia }: { tipologia: Tipologia }) {
  const [open, setOpen] = useState(false);
  const rules: ChecklistRules | null = useMemo(() => {
    try { return JSON.parse(tipologia.regole_json); }
    catch { return null; }
  }, [tipologia.regole_json]);

  if (!rules) return null;

  const uniqueDocs = (templates: ChecklistRules["docs_interno"]) =>
    templates.map((t) => t.descrizione);

  return (
    <div className={styles.docPreview}>
      <button type="button" onClick={() => setOpen(!open)} className={styles.docPreviewToggle}>
        <span>Documenti richiesti</span>
        <ChevronDown size={14} className={`${styles.docPreviewChevron} ${open ? styles.docPreviewChevronOpen : ""}`} />
      </button>
      {open && (
        <div className={styles.docPreviewContent}>
          <div className={styles.docPreviewSection}>
            <span className={styles.docPreviewLabel}>Personale interno</span>
            <ul className={styles.docPreviewList}>
              {uniqueDocs(rules.docs_interno).map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
          <div className={styles.docPreviewSection}>
            <span className={styles.docPreviewLabel}>Personale esterno</span>
            <ul className={styles.docPreviewList}>
              {uniqueDocs(rules.docs_esterno).map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
          <div className={styles.docPreviewSection}>
            <span className={styles.docPreviewLabel}>Progetto</span>
            <ul className={styles.docPreviewList}>
              {uniqueDocs(rules.docs_progetto).map((d) => <li key={d}>{d}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Tipologie
  const [tipologie, setTipologie] = useState<Tipologia[]>([]);
  const [tipologiaId, setTipologiaId] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customPdf, setCustomPdf] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    getTipologie().then((list) => {
      setTipologie(list);
      const fse = list.find((t) => t.codice === "fse_plus");
      if (fse) setTipologiaId(fse.id);
    });
  }, []);

  // Step 1
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");
  const [ente, setEnte] = useState("");
  const [attivita, setAttivita] = useState("");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [modalita, setModalita] = useState<RendicontazioneMode>("staff_40");

  // Step 2
  const [logoFiles, setLogoFiles] = useState<File[]>([]);

  // Step 3
  const [persone, setPersone] = useState<(CreatePersonaRequest & { _key: number })[]>([]);
  const [pNome, setPNome] = useState("");
  const [pCognome, setPCognome] = useState("");
  const [pRuolo, setPRuolo] = useState<RuoloPersonale>("docente_interno");
  const [pIncarico, setPIncarico] = useState("");
  const [pCosto, setPCosto] = useState("");

  const selectedTipologia = tipologie.find((t) => t.id === tipologiaId);

  const handleStep1 = async () => {
    if (!nome.trim() || !codice.trim()) {
      setError("Nome e codice progetto sono obbligatori.");
      return;
    }
    if (dataInizio && dataFine && dataInizio > dataFine) {
      setError("La data di inizio non può essere successiva alla data di fine.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let finalTipologiaId = tipologiaId;

      if (isCustom && customPdf && customName.trim()) {
        setExtracting(true);
        const tipologia = await createCustomTipologia(customName.trim(), customPdf);
        finalTipologiaId = tipologia.id;
        setExtracting(false);
      }

      const project = await createProject({
        nome,
        codice_progetto: codice,
        denominazione_attivita: attivita,
        ente_agenzia: ente,
        modalita_rendicontazione: modalita,
        tipologia_id: finalTipologiaId || undefined,
        data_inizio: dataInizio,
        data_fine: dataFine,
      });
      setProjectId(project.id);
      setStep(2);
    } catch (e) {
      setExtracting(false);
      setError(e instanceof Error ? e.message : "Errore nella creazione");
    } finally {
      setSaving(false);
    }
  };

  const handleStep2 = async () => {
    if (projectId && logoFiles.length > 0) {
      setSaving(true);
      try {
        await uploadLogos(projectId, logoFiles);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore upload loghi");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setStep(3);
  };

  const addPersona = () => {
    if (!pNome.trim() || !pCognome.trim()) return;
    setPersone([
      ...persone,
      {
        _key: Date.now(),
        nome: pNome.trim(),
        cognome: pCognome.trim(),
        ruolo: pRuolo,
        numero_incarico: pIncarico.trim() || undefined,
        costo_orario: pCosto ? parseFloat(pCosto) : undefined,
      },
    ]);
    setPNome("");
    setPCognome("");
    setPIncarico("");
    setPCosto("");
  };

  const handleFinish = async () => {
    if (!projectId) return;
    const pending = pNome.trim() && pCognome.trim();
    const allPersone = pending
      ? [...persone, { _key: Date.now(), nome: pNome.trim(), cognome: pCognome.trim(), ruolo: pRuolo, numero_incarico: pIncarico.trim() || undefined, costo_orario: pCosto ? parseFloat(pCosto) : undefined }]
      : persone;
    setSaving(true);
    setError(null);
    try {
      for (const p of allPersone) {
        const { _key, ...data } = p;
        await createPersona(projectId, data);
      }
      navigate(`/projects/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio persone");
      setSaving(false);
    }
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Progetti", to: "/" },
          { label: "Nuovo Progetto" },
        ]}
        end={<NavControls />}
      />
      <h1 className={styles.title}>Nuovo Progetto</h1>
      <p className={styles.stepInfo}>
        Step {step} di 3 —{" "}
        {step === 1 ? "Dati progetto" : step === 2 ? "Loghi" : "Persone"}
      </p>

      {error && <div className={styles.error}>{error}</div>}

      {/* ── STEP 1: Dati Progetto ── */}
      {step === 1 && (
        <div className={styles.form}>
          <div className={styles.gridTwo}>
            <div className={styles.field}>
              <label className={styles.label}>Nome progetto *</label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className={styles.input} placeholder="es. Corso Web Developer 2025" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Codice progetto *</label>
              <input type="text" value={codice} onChange={(e) => setCodice(e.target.value)} className={styles.input} placeholder="es. FSE+2024-TOS-001" />
            </div>
          </div>
          <div className={styles.gridTwo}>
            <div className={styles.field}>
              <label className={styles.label}>Ente / Agenzia</label>
              <input type="text" value={ente} onChange={(e) => setEnte(e.target.value)} className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Attivita</label>
              <input type="text" value={attivita} onChange={(e) => setAttivita(e.target.value)} className={styles.input} />
            </div>
          </div>
          <div className={styles.gridTwo}>
            <div className={styles.field}>
              <label className={styles.label}>Data inizio</label>
              <input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} className={styles.input} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Data fine</label>
              <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} className={styles.input} />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tipologia *</label>
            <div className={styles.radioGroup}>
              {tipologie.filter((t) => t.builtin).map((t) => (
                <label key={t.id} className={`${styles.radioOption} ${!isCustom && tipologiaId === t.id ? styles.radioOptionSelected : ""}`}>
                  <input type="radio" name="tipologia" checked={!isCustom && tipologiaId === t.id} onChange={() => { setTipologiaId(t.id); setIsCustom(false); }} className={styles.radioInput} />
                  <div style={{ flex: 1 }}>
                    <div className={styles.radioLabel}>{t.nome}</div>
                    <div className={styles.radioDesc}>{t.descrizione}</div>
                    {!isCustom && tipologiaId === t.id && <DocPreview tipologia={t} />}
                  </div>
                </label>
              ))}
              <label className={`${styles.radioOption} ${isCustom ? styles.radioOptionSelected : ""}`}>
                <input type="radio" name="tipologia" checked={isCustom} onChange={() => setIsCustom(true)} className={styles.radioInput} />
                <div style={{ flex: 1 }}>
                  <div className={styles.radioLabel}>Personalizzata</div>
                  <div className={styles.radioDesc}>Carica un PDF o DOCX con le regole — le estraiamo automaticamente</div>
                  {isCustom && (
                    <div className={styles.customTipologia}>
                      <input type="text" placeholder="Nome tipologia" value={customName} onChange={(e) => setCustomName(e.target.value)} className={styles.inputSmall} />
                      <label className={styles.uploadLabel}>
                        <Upload size={14} />
                        <span>{customPdf ? customPdf.name : "Scegli PDF/DOCX regole..."}</span>
                        <input type="file" accept=".pdf,.docx" onChange={(e) => setCustomPdf(e.target.files?.[0] ?? null)} style={{ display: "none" }} />
                      </label>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Modalita costi *</label>
            <div className={styles.modalitaRow}>
              {RENDICONTAZIONE_OPTIONS.map((opt) => (
                <label key={opt.value} className={`${styles.modalitaOption} ${modalita === opt.value ? styles.modalitaOptionSelected : ""}`}>
                  <input type="radio" name="modalita" value={opt.value} checked={modalita === opt.value} onChange={() => setModalita(opt.value)} className={styles.radioInput} />
                  <div>
                    <div className={styles.radioLabel}>{opt.label}</div>
                    <div className={styles.radioDesc}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button onClick={handleStep1} disabled={saving || extracting} className={styles.primaryButton}>
            {extracting ? "Estrazione regole dal PDF..." : saving ? "Creazione..." : "Avanti"}
          </button>
        </div>
      )}

      {/* ── STEP 2: Loghi ── */}
      {step === 2 && (
        <div className={styles.form}>
          <p className={styles.stepDesc}>
            Carica i loghi delle realta partecipanti (PNG/SVG, max 5). Verranno usati nelle timecard.
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setLogoFiles(Array.from(e.target.files ?? []))}
          />
          {logoFiles.length > 0 && (
            <div className={styles.fileList}>
              {logoFiles.map((f, i) => (
                <div key={i} className={styles.fileChip}>{f.name}</div>
              ))}
            </div>
          )}
          <div className={styles.buttonRow}>
            <button onClick={handleStep2} disabled={saving} className={styles.primaryButton}>
              {saving ? "Upload..." : "Avanti"}
            </button>
            <button onClick={() => { setLogoFiles([]); setStep(3); }} className={styles.secondaryButton}>
              Salta
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Persone ── */}
      {step === 3 && (
        <div className={styles.formWide}>
          <p className={styles.stepDesc}>
            Aggiungi le persone coinvolte nel progetto. Potrai aggiungerne altre in seguito.
          </p>

          {persone.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr className={styles.tableHead}>
                  <th className={styles.th}>Nome</th>
                  <th className={styles.th}>Ruolo</th>
                  <th className={styles.th}>N. Incarico</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {persone.map((p, i) => (
                  <tr key={p._key} className={styles.tableRow}>
                    <td className={styles.td}>{p.cognome} {p.nome}</td>
                    <td className={styles.tdMuted}>{RUOLO_LABELS[p.ruolo]}</td>
                    <td className={styles.tdMuted}>{p.numero_incarico ?? "—"}</td>
                    <td className={styles.td}>
                      <button onClick={() => setPersone(persone.filter((_, j) => j !== i))} className={styles.deleteButton} title="Rimuovi">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={styles.addPersonForm}>
            <div className={styles.gridTwo}>
              <input type="text" placeholder="Nome" value={pNome} onChange={(e) => setPNome(e.target.value)} className={styles.inputSmall} />
              <input type="text" placeholder="Cognome" value={pCognome} onChange={(e) => setPCognome(e.target.value)} className={styles.inputSmall} />
            </div>
            <div className={styles.gridThree}>
              <select value={pRuolo} onChange={(e) => setPRuolo(e.target.value as RuoloPersonale)} className={styles.inputSmall}>
                {Object.entries(RUOLO_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input type="text" placeholder="N. incarico" value={pIncarico} onChange={(e) => setPIncarico(e.target.value)} className={styles.inputSmall} />
              <input type="text" placeholder="Costo orario" value={pCosto} onChange={(e) => setPCosto(e.target.value)} className={styles.inputSmall} />
            </div>
            <button type="button" onClick={addPersona} className={styles.addButton}>
              + Aggiungi persona
            </button>
          </div>

          <div className={styles.buttonRowBottom}>
            <button onClick={handleFinish} disabled={saving} className={styles.primaryButton}>
              {saving ? "Salvataggio..." : "Crea Progetto"}
            </button>
            <button onClick={() => navigate("/")} className={styles.secondaryButton}>
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
