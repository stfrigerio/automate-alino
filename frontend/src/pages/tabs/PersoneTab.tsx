import { useEffect, useState } from "react";
import { getPersone, createPersona, deletePersona } from "../../api/client";
import { RUOLO_LABELS } from "../../types";
import type { Persona, RuoloPersonale } from "../../types";

export default function PersoneTab({ projectId }: { projectId: string }) {
  const [persone, setPersone] = useState<Persona[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [ruolo, setRuolo] = useState<RuoloPersonale>("docente_interno");
  const [incarico, setIncarico] = useState("");
  const [costo, setCosto] = useState("");

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
    });
    setNome(""); setCognome(""); setIncarico(""); setCosto("");
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await deletePersona(projectId, id);
    load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold">Persone ({persone.length})</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">
          + Aggiungi persona
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            <input type="text" placeholder="Cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value as RuoloPersonale)} className="border border-gray-300 rounded px-3 py-1.5 text-sm">
              {Object.entries(RUOLO_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input type="text" placeholder="N. incarico" value={incarico} onChange={(e) => setIncarico(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            <input type="text" placeholder="Costo orario (EUR)" value={costo} onChange={(e) => setCosto(e.target.value)} className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Salva</button>
            <button onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-1.5 rounded text-sm hover:bg-gray-100">Annulla</button>
          </div>
        </div>
      )}

      {persone.length === 0 ? (
        <p className="text-gray-500 text-sm">Nessuna persona aggiunta.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left p-2 font-medium text-gray-600">Nome</th>
              <th className="text-left p-2 font-medium text-gray-600">Ruolo</th>
              <th className="text-left p-2 font-medium text-gray-600">Tipo</th>
              <th className="text-left p-2 font-medium text-gray-600">N. Incarico</th>
              <th className="text-right p-2 font-medium text-gray-600">Costo/h</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {persone.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2 font-medium">{p.cognome} {p.nome}</td>
                <td className="p-2 text-gray-500">{RUOLO_LABELS[p.ruolo]}</td>
                <td className="p-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.tipo === "interno" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                    {p.tipo}
                  </span>
                </td>
                <td className="p-2 text-gray-500">{p.numero_incarico ?? "—"}</td>
                <td className="p-2 text-right text-gray-500">
                  {p.costo_orario ? `${p.costo_orario.toFixed(2)} EUR` : "—"}
                </td>
                <td className="p-2 text-right">
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-600 text-xs">Rimuovi</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
