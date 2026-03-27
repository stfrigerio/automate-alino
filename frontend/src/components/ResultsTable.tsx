import type { FileResult, Category } from "../types";

interface ResultsTableProps {
  results: FileResult[];
  categories: Category[];
  onCategoryChange: (id: string, category: string) => void;
  onConfirm: () => void;
  onReset: () => void;
  confirming: boolean;
}

export function ResultsTable({
  results,
  categories,
  onCategoryChange,
  onConfirm,
  onReset,
  confirming,
}: ResultsTableProps) {
  return (
    <div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left p-3 font-medium text-gray-600">File</th>
            <th className="text-left p-3 font-medium text-gray-600">
              Assigned to
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr
              key={result.id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="p-3 text-sm">{result.filename}</td>
              <td className="p-3">
                <select
                  value={result.category}
                  onChange={(e) =>
                    onCategoryChange(result.id, e.target.value)
                  }
                  className={`border rounded px-2 py-1 text-sm ${
                    result.category === "unclassified"
                      ? "border-amber-300 bg-amber-50"
                      : "border-gray-300"
                  }`}
                >
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="unclassified">Unclassified</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {confirming ? "Filing..." : "Confirm & File"}
        </button>
        <button
          onClick={onReset}
          disabled={confirming}
          className="border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
