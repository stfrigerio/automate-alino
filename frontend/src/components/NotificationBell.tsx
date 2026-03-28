import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import styles from "./NotificationBell.module.css";

function formatTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "Adesso";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return date.toLocaleDateString("it-IT");
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        className={styles.bellButton}
        onClick={handleToggle}
        aria-label="Notifiche"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <>
            <div className={styles.backdrop} onClick={() => setOpen(false)} />
            <div className={styles.panel} style={{ top: panelPos.top, right: panelPos.right }}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Notifiche</span>
                <div className={styles.panelActions}>
                  {unreadCount > 0 && (
                    <button className={styles.actionButton} onClick={markAllRead} title="Segna tutto come letto">
                      <CheckCheck size={14} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button className={styles.actionButton} onClick={clearAll} title="Elimina tutto">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className={styles.empty}>
                  <BellOff size={20} />
                  <span>Nessuna notifica</span>
                </div>
              ) : (
                <div className={styles.list}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`${styles.item} ${!n.read ? styles.itemUnread : ""} ${styles[`item-${n.kind}`]}`}
                    >
                      <div className={styles.itemHeader}>
                        <span className={styles.itemTitle}>{n.title}</span>
                        <span className={styles.itemTime}>{formatTime(n.timestamp)}</span>
                      </div>
                      {n.message && <p className={styles.itemMessage}>{n.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
