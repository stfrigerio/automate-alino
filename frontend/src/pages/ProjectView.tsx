import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getProject } from "../api/client";
import { RENDICONTAZIONE_LABELS } from "../types";
import type { Project } from "../types";
import PanoramicaTab from "./tabs/PanoramicaTab";
import PersoneTab from "./tabs/PersoneTab";
import BustePagaTab from "./tabs/BustePagaTab";
import TimecardTab from "./tabs/TimecardTab";
import DocumentiTab from "./tabs/DocumentiTab";

const TABS = [
  { id: "panoramica", label: "Panoramica" },
  { id: "persone", label: "Persone" },
  { id: "buste-paga", label: "Buste Paga" },
  { id: "timecard", label: "Timecard" },
  { id: "documenti", label: "Documenti" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<TabId>("panoramica");

  useEffect(() => {
    if (id) getProject(id).then(setProject).catch(console.error);
  }, [id]);

  if (!project) return <p className="text-gray-500">Caricamento...</p>;

  return (
    <div>
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; Tutti i progetti
      </Link>

      <div className="flex items-start justify-between mt-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.nome}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {project.codice_progetto}
            <span className="mx-2">&middot;</span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
              {RENDICONTAZIONE_LABELS[project.modalita_rendicontazione]}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === "panoramica" && <PanoramicaTab project={project} />}
      {tab === "persone" && <PersoneTab projectId={project.id} />}
      {tab === "buste-paga" && <BustePagaTab projectId={project.id} />}
      {tab === "timecard" && <TimecardTab projectId={project.id} />}
      {tab === "documenti" && <DocumentiTab projectId={project.id} />}
    </div>
  );
}
