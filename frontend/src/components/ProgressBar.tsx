import { motion } from "motion/react";
import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showPercent?: boolean;
  successWhenFull?: boolean;
}

export function ProgressBar({ value, max, label, showPercent = true, successWhenFull = true }: ProgressBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const isFull = pct >= 100 && successWhenFull;

  return (
    <div className={styles.wrapper}>
      {(label || showPercent) && (
        <div className={styles.header}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercent && <span className={styles.value}>{pct}%</span>}
        </div>
      )}
      <div className={styles.track}>
        <motion.div
          className={`${styles.fill} ${isFull ? styles.fillSuccess : ""}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
    </div>
  );
}
