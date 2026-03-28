import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type Variant = "success" | "warning" | "error" | "info" | "neutral" | "accent";

interface BadgeProps {
  variant: Variant;
  children: ReactNode;
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {children}
    </span>
  );
}
