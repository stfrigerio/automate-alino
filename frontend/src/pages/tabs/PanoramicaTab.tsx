import { useEffect, useState } from "react";
import { getProjectStats, type ProjectStats } from "../../api/client";
import type { Project } from "../../types";

export default function PanoramicaTab({ project }: { project: Project }) {
  const [stats, setStats] = useState<ProjectStats | null>(null);

  useEffect(() => {
    getProjectStats(project.id).then(setStats).catch(console.error);
  }, [project.id]);

  return (
    <div className="space-y-6">
      {/* Project Info */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Ente / Agenzia:</span>
          <p className="font-medium">{project.ente_agenzia || "—"}</p>
        </div>
        <div>
          <span className="text-gray-500">Denominazione attivita:</span>
          <p className="font-medium">{project.denominazione_attivita || "—"}</p>
        </div>
        <div>
          <span className="text-gray-500">Data inizio:</span>
          <p className="font-medium">{project.data_inizio || "—"}</p>
        </div>
        <div>
          <span className="text-gray-500">Data fine:</span>
          <p className="font-medium">{project.data_fine || "—"}</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <>
          <div className="grid grid-cols-4 gap-4">
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
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Completezza documentazione</span>
                <span className="font-medium">{stats.completezza}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${stats.completezza}%` }}
                />
              </div>
              {stats.documenti_mancanti > 0 && (
                <p className="text-sm text-amber-600 mt-2">
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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
