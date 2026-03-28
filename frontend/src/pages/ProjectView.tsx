import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProject } from "../api/client";
import { RENDICONTAZIONE_LABELS } from "../types";
import type { Project } from "../types";
import PanoramicaTab from "./tabs/PanoramicaTab";
import PersoneTab from "./tabs/PersoneTab";
import TimecardTab from "./tabs/TimecardTab";
import DocumentiTab from "./tabs/DocumentiTab";
import { Breadcrumb } from "../components/Breadcrumb";
import NavControls from "../components/NavControls";
import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, Users, Clock, FileCheck, FolderKanban, Building2, Calendar } from "lucide-react";
import { Badge } from "../components/Badge";
import styles from "./ProjectView.module.css";

const TABS = [
  { id: "panoramica", label: "Panoramica", icon: LayoutDashboard },
  { id: "persone", label: "Persone", icon: Users },
  { id: "documenti", label: "Documenti", icon: FileCheck },
  { id: "timecard", label: "Timecard", icon: Clock },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<TabId>("panoramica");

  useEffect(() => {
    if (id) getProject(id).then(setProject).catch(console.error);
  }, [id]);

  if (!project) return <p className={styles.loading}>Caricamento...</p>;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Progetti", to: "/" },
          { label: project.nome },
        ]}
        end={<NavControls />}
      />

      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.headerTop}>
          <div className={styles.headerIcon}>
            <FolderKanban className={styles.headerIconSvg} />
          </div>
          <div className={styles.headerInfo}>
            <h1 className={styles.projectName}>{project.nome}</h1>
            <p className={styles.projectCode}>{project.codice_progetto}</p>
            <div className={styles.badges}>
              <Badge variant="info">{RENDICONTAZIONE_LABELS[project.modalita_rendicontazione]}</Badge>
              {project.tipologia_nome && <Badge variant="success">{project.tipologia_nome}</Badge>}
            </div>
          </div>
        </div>

        {(project.ente_agenzia || project.data_inizio || project.data_fine) && (
          <>
            <div className={styles.headerDivider} />
            <div className={styles.headerMeta}>
              {project.ente_agenzia && (
                <div className={styles.metaItem}>
                  <Building2 className={styles.metaIcon} />
                  <span className={styles.metaValue}>{project.ente_agenzia}</span>
                </div>
              )}
              {project.data_inizio && (
                <div className={styles.metaItem}>
                  <Calendar className={styles.metaIcon} />
                  <span className={styles.metaValue}>
                    {project.data_inizio}
                    {project.data_fine && ` — ${project.data_fine}`}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>

      <div className={styles.tabBar}>
        <div className={styles.tabList}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
              >
                {isActive && (
                  <motion.div
                    className={styles.tabIndicator}
                    layoutId="tabIndicator"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={styles.tabContent}>
                  <Icon className={styles.tabIcon} />
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "panoramica" && <PanoramicaTab project={project} onProjectUpdated={setProject} />}
          {tab === "persone" && <PersoneTab projectId={project.id} />}
          {tab === "documenti" && <DocumentiTab projectId={project.id} />}
          {tab === "timecard" && <TimecardTab projectId={project.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
