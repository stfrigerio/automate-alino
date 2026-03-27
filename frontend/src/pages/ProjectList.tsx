import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProjects } from "../api/client";
import { RENDICONTAZIONE_LABELS } from "../types";
import type { Project } from "../types";

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Progetti</h1>
        <Link
          to="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          Nuovo Progetto
        </Link>
      </div>

      {loading && <p className="text-gray-500">Caricamento...</p>}

      {!loading && projects.length === 0 && (
        <p className="text-gray-500">
          Nessun progetto. Creane uno per iniziare.
        </p>
      )}

      <div className="grid gap-4">
        {projects.map((p) => (
          <Link
            key={p.id}
            to={`/projects/${p.id}`}
            className="block border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-lg">{p.nome}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {p.codice_progetto}
                </p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                {RENDICONTAZIONE_LABELS[p.modalita_rendicontazione]}
              </span>
            </div>
            {p.ente_agenzia && (
              <p className="text-sm text-gray-400 mt-2">{p.ente_agenzia}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
