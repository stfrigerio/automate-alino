import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, uploadLogo } from "../api/client";
import { PersonList } from "../components/PersonList";

interface PersonEntry {
  name: string;
  role?: string;
}

export default function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [signatories, setSignatories] = useState<PersonEntry[]>([]);
  const [workers, setWorkers] = useState<PersonEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (workers.length === 0) {
      setError("Add at least one worker.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const project = await createProject({ name, signatories, workers });
      if (logo) {
        await uploadLogo(project.id, logo);
      }
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">New Project</h1>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 w-full text-sm"
            placeholder="e.g. Cantiere Via Roma"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logo (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>

        <PersonList
          label="Signatories (who signs timecards)"
          people={signatories}
          onChange={setSignatories}
        />

        <PersonList
          label="Workers (people on the project)"
          people={workers}
          onChange={setWorkers}
        />

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? "Creating..." : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
