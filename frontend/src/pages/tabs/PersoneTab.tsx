import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPersone, createPersona, updatePersona, deletePersona } from "../../api/client";
import { RUOLO_LABELS } from "../../types";
import type { Persona, RuoloPersonale } from "../../types";
import { Trash2, Users, ExternalLink } from "lucide-react";
import EditableText from "../../components/EditableText";
import EditableSelect from "../../components/EditableSelect";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import styles from "./PersoneTab.module.css";

export default function PersoneTab({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const [persone, setPersone] = useState<Persona[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [ruolo, setRuolo] = useState<RuoloPersonale>("docente_interno");
  const [incarico, setIncarico] = useState("");
  const [costo, setCosto] = useState("");
  const [orePreviste, setOrePreviste] = useState("");

  const load = () => getPersone(projectId).then(setPersone);
  useEffect(() => { load(); }, [projectId]);

  const handleAdd = async () => {
    if (!nome.trim() || !cognome.trim()) return;
    await createPersona(projectId, {
      nome: nome.trim(),
      cognome: cognome.trim(),
      ruolo,
      numero_incarico: incarico.trim() || undefined,
      costo_orario: costo ? parseFloat(costo) : undefined,
      ore_previste: orePreviste ? parseFloat(orePreviste) : undefined,
    });
    setNome(""); setCognome(""); setIncarico(""); setCosto(""); setOrePreviste("");
    setShowForm(false);
    load();
  };

  const patch = async (id: string, data: Parameters<typeof updatePersona>[2]) => {
    await updatePersona(projectId, id, data);
    load();
  };

  const handleDelete = async (id: string) => {
    await deletePersona(projectId, id);
    load();
  };

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.title}>Persone ({persone.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className={styles.addButton}>
          + Aggiungi persona
        </button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <div className={styles.gridTwo}>
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className={styles.input} />
            <input type="text" placeholder="Cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.gridThree}>
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value as RuoloPersonale)} className={styles.input}>
              {Object.entries(RUOLO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input type="text" placeholder="N. incarico" value={incarico} onChange={(e) => setIncarico(e.target.value)} className={styles.input} />
            <input type="text" placeholder="Costo orario (EUR)" value={costo} onChange={(e) => setCosto(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.gridTwo}>
            <input type="number" placeholder="Ore previste" value={orePreviste} onChange={(e) => setOrePreviste(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.formButtons}>
            <button onClick={handleAdd} className={styles.saveButton}>Salva</button>
            <button onClick={() => setShowForm(false)} className={styles.cancelButton}>Annulla</button>
          </div>
        </div>
      )}

      {persone.length === 0 ? (
        <EmptyState icon={Users}>Nessuna persona aggiunta.</EmptyState>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr className={styles.tableHead}>
              <th className={styles.th}>Cognome</th>
              <th className={styles.th}>Nome</th>
              <th className={styles.th}>Ruolo</th>
              <th className={styles.th}>Tipo</th>
              <th className={styles.th}>N. Incarico</th>
              <th className={styles.thRight}>Ore prev.</th>
              <th className={styles.thRight}>Costo/h</th>
              <th className={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {persone.map((p) => (
              <tr key={p.id} className={styles.row}>
                <td className={styles.td}>
                  <EditableText value={p.cognome} onSave={(v) => patch(p.id, { cognome: v })} />
                </td>
                <td className={styles.td}>
                  <EditableText value={p.nome} onSave={(v) => patch(p.id, { nome: v })} />
                </td>
                <td className={styles.td}>
                  <EditableSelect value={p.ruolo} options={RUOLO_LABELS} onSave={(v) => patch(p.id, { ruolo: v })} />
                </td>
                <td className={styles.td}>
                  <Badge variant={p.tipo === "interno" ? "success" : "accent"}>
                    {p.tipo}
                  </Badge>
                </td>
                <td className={styles.td}>
                  <EditableText value={p.numero_incarico ?? ""} onSave={(v) => patch(p.id, { numero_incarico: v || undefined })} />
                </td>
                <td className={styles.td}>
                  <EditableText
                    value={p.ore_previste != null ? String(p.ore_previste) : ""}
                    onSave={(v) => patch(p.id, { ore_previste: v ? parseFloat(v) : undefined })}
                    alignRight
                  />
                </td>
                <td className={styles.td}>
                  <EditableText
                    value={p.costo_orario != null ? p.costo_orario.toFixed(2) : ""}
                    onSave={(v) => patch(p.id, { costo_orario: v ? parseFloat(v) : undefined })}
                    alignRight
                  />
                </td>
                <td className={styles.tdActions}>
                  {p.lavoratore_id && (
                    <button
                      onClick={() => navigate(`/lavoratori/${p.lavoratore_id}`)}
                      className={styles.navButton}
                      title="Vai alla scheda lavoratore"
                    >
                      <ExternalLink size={14} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(p.id)} className={styles.deleteButton} title="Rimuovi">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
