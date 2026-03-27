import { useEffect, useState } from "react";
import { getTimecards } from "../../api/client";
import type { Timecard } from "../../types";

type TimecardRow = Timecard & { persona_nome: string; persona_cognome: string };

const STATO_BADGE: Record<string, { cls: string; label: string }> = {
  bozza: { cls: "bg-gray-100 text-gray-600", label: "Bozza" },
  generata: { cls: "bg-blue-100 text-blue-700", label: "Generata" },
  firmata: { cls: "bg-green-100 text-green-700", label: "Firmata" },
};

export default function TimecardTab({ projectId }: { projectId: string }) {
  const [timecards, setTimecards] = useState<TimecardRow[]>([]);

  useEffect(() => {
    getTimecards(projectId).then(setTimecards);
  }, [projectId]);

  if (timecards.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        Nessuna timecard. Le timecard vengono create automaticamente quando carichi le buste paga.
      </p>
    );
  }

  return (
    <div>
      <h2 className="font-semibold mb-4">Timecard ({timecards.length})</h2>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left p-2 font-medium text-gray-600">Persona</th>
            <th className="text-left p-2 font-medium text-gray-600">Mese</th>
            <th className="text-right p-2 font-medium text-gray-600">Ore totali</th>
            <th className="text-right p-2 font-medium text-gray-600">Righe compilate</th>
            <th className="text-left p-2 font-medium text-gray-600">Stato</th>
          </tr>
        </thead>
        <tbody>
          {timecards.map((tc) => {
            const badge = STATO_BADGE[tc.stato] ?? STATO_BADGE.bozza;
            const oreRighe = tc.righe.reduce((sum, r) => sum + r.ore, 0);
            return (
              <tr key={tc.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-2 font-medium">
                  {tc.persona_cognome} {tc.persona_nome}
                </td>
                <td className="p-2 text-gray-500">{tc.mese}</td>
                <td className="p-2 text-right">{tc.ore_totali}</td>
                <td className="p-2 text-right">
                  <span className={oreRighe < tc.ore_totali ? "text-amber-600" : "text-green-600"}>
                    {oreRighe} / {tc.ore_totali}
                  </span>
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
    </div>
  );
}
