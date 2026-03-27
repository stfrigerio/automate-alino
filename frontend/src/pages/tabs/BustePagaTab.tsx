import { useEffect, useState } from "react";
import {
  getBustePaga,
  uploadBustePaga,
  getPersone,
  updateBustaPaga,
} from "../../api/client";
import { DropZone } from "../../components/DropZone";
import type { BustaPaga, Persona } from "../../types";

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  ok: { cls: "bg-green-100 text-green-700", label: "OK" },
  revisione_manuale: { cls: "bg-amber-100 text-amber-700", label: "Da verificare" },
  errore: { cls: "bg-red-100 text-red-700", label: "Errore" },
  pending: { cls: "bg-gray-100 text-gray-600", label: "In attesa" },
};

export default function BustePagaTab({ projectId }: { projectId: string }) {
  const [bustePaga, setBustePaga] = useState<BustaPaga[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    getBustePaga(projectId).then(setBustePaga);
    getPersone(projectId).then(setPersone);
  };
  useEffect(load, [projectId]);

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    try {
      await uploadBustePaga(projectId, files);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore upload");
    } finally {
      setUploading(false);
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
    <div className="space-y-6">
      <DropZone
        onFilesSelected={handleUpload}
        disabled={uploading}
        label={uploading ? "Analisi in corso..." : "Trascina le buste paga PDF qui"}
        sublabel="Il sistema estrarra automaticamente nome, ore e mese"
      />

      {bustePaga.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left p-2 font-medium text-gray-600">File</th>
              <th className="text-left p-2 font-medium text-gray-600">Nome estratto</th>
              <th className="text-left p-2 font-medium text-gray-600">Persona abbinata</th>
              <th className="text-left p-2 font-medium text-gray-600">Mese</th>
              <th className="text-right p-2 font-medium text-gray-600">Ore</th>
              <th className="text-left p-2 font-medium text-gray-600">Stato</th>
            </tr>
          </thead>
          <tbody>
            {bustePaga.map((bp) => {
              const badge = STATUS_BADGE[bp.stato_parsing] ?? STATUS_BADGE.pending;
              return (
                <tr key={bp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-2 truncate max-w-48">{bp.file_name}</td>
                  <td className="p-2 text-gray-500">
                    {bp.nome_estratto || bp.cognome_estratto
                      ? `${bp.nome_estratto ?? ""} ${bp.cognome_estratto ?? ""}`.trim()
                      : "—"}
                  </td>
                  <td className="p-2">
                    <select
                      value={bp.persona_id ?? ""}
                      onChange={(e) => handleMatch(bp.id, e.target.value)}
                      className={`border rounded px-2 py-1 text-sm ${!bp.persona_id ? "border-amber-300 bg-amber-50" : "border-gray-300"}`}
                    >
                      <option value="">— Seleziona —</option>
                      {persone.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.cognome} {p.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-gray-500">{bp.mese || "—"}</td>
                  <td className="p-2 text-right font-medium">
                    {bp.ore_estratte != null ? bp.ore_estratte : "—"}
                  </td>
                  <td className="p-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
