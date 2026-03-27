import { useEffect, useState } from "react";
import { getDocumenti, generaChecklist, getPersone } from "../../api/client";
import type { DocumentoRichiesto, Persona } from "../../types";

export default function DocumentiTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<DocumentoRichiesto[]>([]);
  const [persone, setPersone] = useState<Persona[]>([]);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    getDocumenti(projectId).then(setDocs);
    getPersone(projectId).then(setPersone);
  };
  useEffect(load, [projectId]);

  const handleGenera = async () => {
    setGenerating(true);
    try {
      const result = await generaChecklist(projectId);
      setDocs(result);
    } finally {
      setGenerating(false);
    }
  };

  const personaName = (id: string | undefined) => {
    if (!id) return null;
    const p = persone.find((p) => p.id === id);
    return p ? `${p.cognome} ${p.nome}` : null;
  };

  // Group by persona
  const grouped = new Map<string, DocumentoRichiesto[]>();
  const projectDocs: DocumentoRichiesto[] = [];
  for (const doc of docs) {
    if (doc.persona_id) {
      const key = doc.persona_id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(doc);
    } else {
      projectDocs.push(doc);
    }
  }

  const totalDocs = docs.length;
  const mancanti = docs.filter((d) => d.stato === "mancante").length;
  const caricati = totalDocs - mancanti;

  const STATUS_ICON: Record<string, string> = {
    mancante: "[ ]",
    caricato: "[x]",
    verificato: "[v]",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Checklist Documenti</h2>
          {totalDocs > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              {caricati} di {totalDocs} caricati
              {mancanti > 0 && (
                <span className="text-amber-600 ml-2">
                  ({mancanti} mancanti)
                </span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={handleGenera}
          disabled={generating}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? "Generazione..." : "Genera / Aggiorna Checklist"}
        </button>
      </div>

      {totalDocs > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${totalDocs > 0 ? Math.round((caricati / totalDocs) * 100) : 0}%` }}
          />
        </div>
      )}

      {totalDocs === 0 && (
        <p className="text-gray-500 text-sm">
          Nessun documento nella checklist. Aggiungi persone e carica buste paga, poi genera la checklist.
        </p>
      )}

      {/* Per-persona documents */}
      {Array.from(grouped.entries()).map(([personaId, personaDocs]) => (
        <div key={personaId}>
          <h3 className="font-medium text-sm text-gray-700 mb-2 bg-gray-50 px-3 py-2 rounded">
            {personaName(personaId) ?? "Persona sconosciuta"}
          </h3>
          <ul className="space-y-1 ml-2">
            {personaDocs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 text-sm py-1">
                <span className={`font-mono text-xs ${doc.stato === "mancante" ? "text-red-500" : "text-green-600"}`}>
                  {STATUS_ICON[doc.stato]}
                </span>
                <span className={doc.stato === "mancante" ? "text-gray-600" : "text-gray-800"}>
                  {doc.descrizione}
                </span>
                {doc.file_name && (
                  <span className="text-xs text-gray-400 ml-auto">{doc.file_name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {/* Project-level documents */}
      {projectDocs.length > 0 && (
        <div>
          <h3 className="font-medium text-sm text-gray-700 mb-2 bg-gray-50 px-3 py-2 rounded">
            Documenti di Progetto
          </h3>
          <ul className="space-y-1 ml-2">
            {projectDocs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 text-sm py-1">
                <span className={`font-mono text-xs ${doc.stato === "mancante" ? "text-red-500" : "text-green-600"}`}>
                  {STATUS_ICON[doc.stato]}
                </span>
                <span className={doc.stato === "mancante" ? "text-gray-600" : "text-gray-800"}>
                  {doc.descrizione}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
