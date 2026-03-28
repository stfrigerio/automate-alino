import { createContext, useContext, useState, useCallback } from "react";

export type NotificationKind = "success" | "warning" | "error" | "info";

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  timestamp: Date;
  read: boolean;
  kind: NotificationKind;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Pick<AppNotification, "title" | "message" | "kind">) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = useCallback((n: Pick<AppNotification, "title" | "message" | "kind">) => {
    setNotifications((prev) => [
      { id: crypto.randomUUID(), timestamp: new Date(), read: false, ...n },
      ...prev,
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
