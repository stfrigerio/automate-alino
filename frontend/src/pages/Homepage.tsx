import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import ProjectList from "./ProjectList";
import LavoratoriList from "./LavoratoriList";
import DocumentTriage from "./DocumentTriage";
import { useBreadcrumb } from "../context/BreadcrumbContext";
import styles from "./Homepage.module.css";

export default function Homepage() {
  useBreadcrumb([{ label: "Home", to: "/" }]);

  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <DocumentTriage />
      </section>
      <hr className={styles.divider} />
      <section className={styles.section}>
        <ProjectList />
      </section>
      <hr className={styles.divider} />
      <section className={styles.section}>
        <LavoratoriList />
      </section>
      <hr className={styles.divider} />
      <section className={styles.section}>
        <Link to="/documenti" className={styles.docCard}>
          <FileText size={20} className={styles.docCardIcon} />
          <div>
            <div className={styles.docCardTitle}>Archivio Documenti</div>
            <div className={styles.docCardSub}>Visualizza, cerca e gestisci tutti i documenti processati</div>
          </div>
          <span className={styles.docCardArrow}>&rarr;</span>
        </Link>
      </section>
    </div>
  );
}
