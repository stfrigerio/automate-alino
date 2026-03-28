import type { ReactNode, ElementType } from "react";
import { motion } from "motion/react";
import { Inbox } from "lucide-react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon?: ElementType;
  children: ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, children }: EmptyStateProps) {
  return (
    <motion.div
      className={styles.empty}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Icon className={styles.icon} />
      <p className={styles.text}>{children}</p>
    </motion.div>
  );
}
