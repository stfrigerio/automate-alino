import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProjects } from "../api/client";
import { RENDICONTAZIONE_LABELS } from "../types";
import type { Project } from "../types";
import { motion } from "motion/react";
import styles from "./ProjectList.module.css";

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>Progetti</h1>
        <Link to="/projects/new" className={styles.newButton}>
          Nuovo Progetto
        </Link>
      </div>

      {loading && <p className={styles.empty}>Caricamento...</p>}

      {!loading && projects.length === 0 && (
        <p className={styles.empty}>
          Nessun progetto. Creane uno per iniziare.
        </p>
      )}

      <div className={styles.grid}>
        {projects.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Link to={`/projects/${p.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <h2 className={styles.cardName}>{p.nome}</h2>
                  <p className={styles.cardCode}>{p.codice_progetto}</p>
                </div>
                <div className={styles.cardBadges}>
                  {p.tipologia_nome && (
                    <span className={styles.cardBadgeTipologia}>{p.tipologia_nome}</span>
                  )}
                  <span className={styles.cardBadge}>
                    {RENDICONTAZIONE_LABELS[p.modalita_rendicontazione]}
                  </span>
                </div>
              </div>
              {p.ente_agenzia && (
                <p className={styles.cardEnte}>{p.ente_agenzia}</p>
              )}
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
