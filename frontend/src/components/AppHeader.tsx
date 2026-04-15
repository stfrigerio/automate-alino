import { Breadcrumb } from "./Breadcrumb";
import NavControls from "./NavControls";
import { useBreadcrumbCrumbs } from "../context/BreadcrumbContext";
import styles from "./AppHeader.module.css";

export default function AppHeader() {
  const crumbs = useBreadcrumbCrumbs();

  return (
    <header className={styles.header}>
      <Breadcrumb items={crumbs} />
      <NavControls />
    </header>
  );
}
