import { useState, useEffect } from "react";
import { DropZone } from "./components/DropZone";
import { ResultsTable } from "./components/ResultsTable";
import { uploadFiles, getCategories, confirmResults } from "./api/client";
import type { FileResult, Category } from "./types";

type Phase = "idle" | "uploading" | "review" | "confirming" | "done";

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<FileResult[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const handleUpload = async (files: File[]) => {
    setPhase("uploading");
    setError(null);
    try {
      const data = await uploadFiles(files);
      setResults(data);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setPhase("idle");
    }
  };

  const handleCategoryChange = (id: string, category: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, category } : r)),
    );
  };

  const handleConfirm = async () => {
    setPhase("confirming");
    try {
      await confirmResults(results);
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-bold mb-2">File Classifier</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Upload documents to classify and organize them automatically.
        </p>

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
            categories={categories}
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
              Classify more files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
