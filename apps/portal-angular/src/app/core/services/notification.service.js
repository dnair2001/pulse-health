/** Carries one-off banners across route changes, e.g. after scheduling succeeds. */
export function NotificationService() {
  let current = null;
  const listeners = [];

  function notify() {
    listeners.forEach((listener) => listener(current));
  }

  return {
    /** Subscribes to changes; returns an unsubscribe function, mirroring an Observable's. */
    subscribe(listener) {
      listeners.push(listener);
      listener(current);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    },

    success(text) {
      current = { variant: 'success', text };
      notify();
    },

    error(text) {
      current = { variant: 'error', text };
      notify();
    },

    clear() {
      current = null;
      notify();
    },
  };
}
