import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Breadcrumb } from "./Breadcrumb";
import NavControls from "./NavControls";
import { useBreadcrumbCrumbs } from "../context/BreadcrumbContext";
import styles from "./AppHeader.module.css";

export default function AppHeader() {
  const crumbs = useBreadcrumbCrumbs();
  const { pathname } = useLocation();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <Breadcrumb items={crumbs} />
          </motion.div>
        </AnimatePresence>
        <NavControls />
      </div>
    </header>
  );
}
