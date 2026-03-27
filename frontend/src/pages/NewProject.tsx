import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, uploadLogos, createPersona } from "../api/client";
import { RUOLO_LABELS } from "../types";
import type { RendicontazioneMode, RuoloPersonale, CreatePersonaRequest } from "../types";

type Step = 1 | 2 | 3;

const RENDICONTAZIONE_OPTIONS: { value: RendicontazioneMode; label: string; desc: string }[] = [
  { value: "staff_40", label: "Staff + 40%", desc: "Solo costi diretti di personale + 40% forfait per altri costi" },
  { value: "forfettario_7", label: "Forfettizzazione 7%", desc: "Tutti i costi diretti + 7% forfait costi indiretti" },
  { value: "costi_reali", label: "Costi reali", desc: "Tutti i costi diretti e indiretti documentati" },
];

export default function NewProject() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

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
      const project = await createProject({
        nome,
        codice_progetto: codice,
        denominazione_attivita: attivita,
        ente_agenzia: ente,
        modalita_rendicontazione: modalita,
        data_inizio: dataInizio,
        data_fine: dataFine,
      });
      setProjectId(project.id);
      setStep(2);
    } catch (e) {
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
    setSaving(true);
    setError(null);
    try {
      for (const p of persone) {
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
      <h1 className="text-2xl font-bold mb-2">Nuovo Progetto</h1>
      <p className="text-sm text-gray-500 mb-8">
        Step {step} di 3 —{" "}
        {step === 1 ? "Dati progetto" : step === 2 ? "Loghi" : "Persone"}
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* ── STEP 1: Dati Progetto ── */}
      {step === 1 && (
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome progetto *
            </label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" placeholder="es. Corso Web Developer 2025" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Codice progetto *
            </label>
            <input type="text" value={codice} onChange={(e) => setCodice(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" placeholder="es. FSE+2024-TOS-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ente / Agenzia capofila
            </label>
            <input type="text" value={ente} onChange={(e) => setEnte(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Denominazione attivita
            </label>
            <input type="text" value={attivita} onChange={(e) => setAttivita(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inizio</label>
              <input type="date" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data fine</label>
              <input type="date" value={dataFine} onChange={(e) => setDataFine(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modalita di rendicontazione *
            </label>
            <div className="space-y-2">
              {RENDICONTAZIONE_OPTIONS.map((opt) => (
                <label key={opt.value} className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${modalita === opt.value ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="modalita" value={opt.value} checked={modalita === opt.value} onChange={() => setModalita(opt.value)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleStep1} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium mt-4">
            {saving ? "Creazione..." : "Avanti"}
          </button>
        </div>
      )}

      {/* ── STEP 2: Loghi ── */}
      {step === 2 && (
        <div className="space-y-4 max-w-xl">
          <p className="text-sm text-gray-600">
            Carica i loghi delle realta partecipanti (PNG/SVG, max 5). Verranno usati nelle timecard.
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setLogoFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
          {logoFiles.length > 0 && (
            <div className="flex gap-4 mt-2">
              {logoFiles.map((f, i) => (
                <div key={i} className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1">
                  {f.name}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={handleStep2} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              {saving ? "Upload..." : "Avanti"}
            </button>
            <button onClick={() => { setLogoFiles([]); setStep(3); }} className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 text-sm">
              Salta
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Persone ── */}
      {step === 3 && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-sm text-gray-600">
            Aggiungi le persone coinvolte nel progetto. Potrai aggiungerne altre in seguito.
          </p>

          {persone.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left p-2 font-medium text-gray-600">Nome</th>
                  <th className="text-left p-2 font-medium text-gray-600">Ruolo</th>
                  <th className="text-left p-2 font-medium text-gray-600">N. Incarico</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {persone.map((p, i) => (
                  <tr key={p._key} className="border-b border-gray-100">
                    <td className="p-2">{p.cognome} {p.nome}</td>
                    <td className="p-2 text-gray-500">{RUOLO_LABELS[p.ruolo]}</td>
                    <td className="p-2 text-gray-500">{p.numero_incarico ?? "—"}</td>
                    <td className="p-2">
                      <button onClick={() => setPersone(persone.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs">
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="Nome" value={pNome} onChange={(e) => setPNome(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
              <input type="text" placeholder="Cognome" value={pCognome} onChange={(e) => setPCognome(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <select value={pRuolo} onChange={(e) => setPRuolo(e.target.value as RuoloPersonale)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
                {Object.entries(RUOLO_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input type="text" placeholder="N. incarico" value={pIncarico} onChange={(e) => setPIncarico(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
              <input type="text" placeholder="Costo orario" value={pCosto} onChange={(e) => setPCosto(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            <button type="button" onClick={addPersona} className="bg-white border border-gray-300 rounded px-4 py-1.5 text-sm hover:bg-gray-100">
              + Aggiungi persona
            </button>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={handleFinish} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
              {saving ? "Salvataggio..." : "Crea Progetto"}
            </button>
            <button onClick={() => navigate("/")} className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 text-sm">
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
