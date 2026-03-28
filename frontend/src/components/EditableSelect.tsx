import styles from "./EditableSelect.module.css";

interface EditableSelectProps<T extends string> {
  value: T;
  options: Record<T, string>;
  onSave: (value: T) => void;
}

export default function EditableSelect<T extends string>({ value, options, onSave }: EditableSelectProps<T>) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as T;
    if (next !== value) onSave(next);
  };

  return (
    <div className={styles.wrapper}>
      <select
        className={styles.select}
        value={value}
        onChange={handleChange}
      >
        {Object.entries(options).map(([k, label]) => (
          <option key={k} value={k}>{label as string}</option>
        ))}
      </select>
    </div>
  );
}
