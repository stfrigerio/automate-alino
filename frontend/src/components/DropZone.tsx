import { useCallback, useState } from "react";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  sublabel?: string;
}

export function DropZone({
  onFilesSelected,
  disabled,
  label = "Trascina i file qui o clicca per selezionare",
  sublabel = "PDF, immagini, file di testo",
}: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onFilesSelected(files);
    },
    [onFilesSelected],
  );

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => {
      if (input.files?.length) {
        onFilesSelected(Array.from(input.files));
      }
    };
    input.click();
  }, [onFilesSelected, disabled]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
        ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <p className="text-lg text-gray-600">{label}</p>
      <p className="text-sm text-gray-400 mt-2">{sublabel}</p>
    </div>
  );
}
