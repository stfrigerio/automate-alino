import { useEffect, useState } from "react";
import { getAppSettings, updateAppSettings } from "../api/client";
import type { ClaudeModel } from "../api/client";
import styles from "./ModelSelector.module.css";

const MODELS: { value: ClaudeModel; label: string; description: string }[] = [
  { value: "haiku", label: "Haiku", description: "Veloce" },
  { value: "sonnet", label: "Sonnet", description: "Bilanciato" },
  { value: "opus", label: "Opus", description: "Potente" },
];

export default function ModelSelector() {
  const [model, setModel] = useState<ClaudeModel>("sonnet");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getAppSettings().then((s) => setModel(s.model));
  }, []);

  const select = async (m: ClaudeModel) => {
    setModel(m);
    setOpen(false);
    await updateAppSettings(m);
  };

  const current = MODELS.find((m) => m.value === model)!;

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        title="Modello AI"
      >
        <span className={styles.dot} />
        <span className={styles.label}>{current.label}</span>
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            {MODELS.map((m) => (
              <button
                key={m.value}
                className={`${styles.option} ${m.value === model ? styles.optionActive : ""}`}
                onClick={() => select(m.value)}
              >
                <span className={styles.optionLabel}>{m.label}</span>
                <span className={styles.optionDesc}>{m.description}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
