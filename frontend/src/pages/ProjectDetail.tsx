import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getProject, uploadFiles, confirmResults } from "../api/client";
import { DropZone } from "../components/DropZone";
import { ResultsTable } from "../components/ResultsTable";
import type { Project, FileResult } from "../types";

type Phase = "idle" | "uploading" | "review" | "confirming" | "done";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<FileResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) getProject(id).then(setProject).catch(console.error);
  }, [id]);

  if (!project) return <p className="text-gray-500">Loading...</p>;

  const handleUpload = async (files: File[]) => {
    setPhase("uploading");
    setError(null);
    try {
      const data = await uploadFiles(project.id, files);
      setResults(data);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("idle");
    }
  };

  const handleCategoryChange = (fileId: string, category: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === fileId ? { ...r, category } : r)),
    );
  };

  const handleConfirm = async () => {
    setPhase("confirming");
    try {
      await confirmResults(project.id, results);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to file documents");
      setPhase("review");
    }
  };

  const handleReset = () => {
    setResults([]);
    setPhase("idle");
    setError(null);
  };

  return (
    <div>
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        &larr; All projects
      </Link>

      <h1 className="text-2xl font-bold mt-4 mb-2">{project.name}</h1>

      <div className="flex gap-8 text-sm text-gray-500 mb-8">
        <span>{project.workers.length} worker(s)</span>
        <span>{project.signatories.length} signatory(ies)</span>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {phase === "idle" && <DropZone onFilesSelected={handleUpload} />}

      {phase === "uploading" && (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">Classifying files...</p>
          <p className="text-sm mt-1">This may take a moment</p>
        </div>
      )}

      {(phase === "review" || phase === "confirming") && (
        <ResultsTable
          results={results}
          workers={project.workers}
          onCategoryChange={handleCategoryChange}
          onConfirm={handleConfirm}
          onReset={handleReset}
          confirming={phase === "confirming"}
        />
      )}

      {phase === "done" && (
        <div className="text-center py-16">
          <p className="text-green-700 text-lg mb-4">
            All files have been filed.
          </p>
          <button
            onClick={handleReset}
            className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-100 text-sm"
          >
            Upload more files
          </button>
        </div>
      )}
    </div>
  );
}
