import { useCallback, useState } from "react";
import { motion } from "motion/react";
import styles from "./DropZone.module.css";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  label?: string;
  sublabel?: string;
  accept?: string;
}

export function DropZone({
  onFilesSelected,
  disabled,
  label = "Trascina i file qui o clicca per selezionare",
  sublabel = "PDF, immagini, file di testo",
  accept,
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
    if (accept) input.accept = accept;
    input.onchange = () => {
      if (input.files?.length) {
        onFilesSelected(Array.from(input.files));
      }
    };
    input.click();
  }, [onFilesSelected, disabled, accept]);

  const cls = [
    styles.dropzone,
    isDragging && styles.dragging,
    disabled && styles.disabled,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={cls}
      animate={{ scale: isDragging ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <p className={styles.label}>{label}</p>
      <p className={styles.sublabel}>{sublabel}</p>
    </motion.div>
  );
}
