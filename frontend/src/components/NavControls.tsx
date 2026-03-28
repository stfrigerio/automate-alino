import ModelSelector from "./ModelSelector";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import styles from "./NavControls.module.css";

export default function NavControls() {
  return (
    <div className={styles.controls}>
      <ModelSelector />
      <NotificationBell />
      <ThemeToggle />
    </div>
  );
}
