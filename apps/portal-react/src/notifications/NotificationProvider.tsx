import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type NotificationVariant = 'success' | 'error' | 'info';

export interface Notification {
  variant: NotificationVariant;
  text: string;
}

interface NotificationContextValue {
  notification: Notification | null;
  success: (text: string) => void;
  error: (text: string) => void;
  clear: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/** Carries one-off banners across route changes, e.g. after scheduling succeeds. */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null);

  const success = useCallback((text: string) => setNotification({ variant: 'success', text }), []);
  const error = useCallback((text: string) => setNotification({ variant: 'error', text }), []);
  const clear = useCallback(() => setNotification(null), []);

  const value = useMemo(
    () => ({ notification, success, error, clear }),
    [notification, success, error, clear],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used inside a NotificationProvider');
  }
  return context;
}
