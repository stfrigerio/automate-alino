import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProjects } from "../api/client";
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
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          to="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          New Project
        </Link>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && projects.length === 0 && (
        <p className="text-gray-500">
          No projects yet. Create one to get started.
        </p>
      )}

      <div className="grid gap-4">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="block border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
          >
            <h2 className="font-semibold">{project.name}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {project.workers.length} worker(s) &middot;{" "}
              {project.signatories.length} signatory(ies)
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
