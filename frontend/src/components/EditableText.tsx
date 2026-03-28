import { useRef, useState } from "react";
import styles from "./EditableText.module.css";

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  alignRight?: boolean;
}

export default function EditableText({ value, onSave, placeholder = "—", alignRight }: EditableTextProps) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const original = useRef(value);

  // Sync when parent value changes (e.g. after reload)
  if (value !== original.current) {
    original.current = value;
    setDraft(value);
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { ref.current?.blur(); }
    if (e.key === "Escape") { setDraft(value); ref.current?.blur(); }
  };

  return (
    <div className={styles.wrapper}>
      <input
        ref={ref}
        className={`${styles.input} ${alignRight ? styles.alignRight : ""}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}
