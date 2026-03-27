import { useState } from "react";

interface PersonEntry {
  name: string;
  role?: string;
  hints?: string[];
}

interface PersonListProps {
  label: string;
  people: PersonEntry[];
  onChange: (people: PersonEntry[]) => void;
}

export function PersonList({ label, people, onChange }: PersonListProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const add = () => {
    if (!name.trim()) return;
    onChange([...people, { name: name.trim(), role: role.trim() || undefined }]);
    setName("");
    setRole("");
  };

  const remove = (idx: number) => {
    onChange(people.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      {people.length > 0 && (
        <ul className="mb-3 space-y-1">
          {people.map((p, i) => (
            <li
              key={i}
              className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm"
            >
              <span>
                {p.name}
                {p.role && (
                  <span className="text-gray-400 ml-2">({p.role})</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1"
        />
        <input
          type="text"
          placeholder="Role (optional)"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-40"
        />
        <button
          type="button"
          onClick={add}
          className="bg-gray-100 border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-200"
        >
          Add
        </button>
      </div>
    </div>
  );
}
