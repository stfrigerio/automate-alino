import type { ElementType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import styles from "./Breadcrumb.module.css";

export interface Crumb {
  label: string;
  to?: string;
  icon?: ElementType;
}

interface BreadcrumbProps {
  items: Crumb[];
  end?: ReactNode;
}

export function Breadcrumb({ items, end }: BreadcrumbProps) {
  return (
    <div className={styles.row}>
    <nav className={styles.nav}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isFirst = i === 0;
        const Icon = item.icon ?? (isFirst ? Home : undefined);

        return (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <ChevronRight className={styles.separator} />}
            {isLast || !item.to ? (
              <span className={styles.current}>
                {Icon && <Icon className={styles.currentIcon} />}
                {item.label}
              </span>
            ) : (
              <Link
                to={item.to}
                className={`${styles.link} ${isFirst && !item.label ? styles.iconOnly : ""}`}
              >
                {Icon && <Icon className={styles.linkIcon} />}
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
    {end != null && <div className={styles.endSlot}>{end}</div>}
    </div>
  );
}
