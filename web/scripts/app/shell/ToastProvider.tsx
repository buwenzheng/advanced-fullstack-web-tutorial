import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from './toast-context';

interface ToastItem {
  id: number;
  message: string;
  leaving: boolean;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<number[]>([]);

  const notify = useCallback((message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, leaving: false }]);
    const leave = window.setTimeout(() => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    }, 2400);
    const remove = window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2620);
    timers.current.push(leave, remove);
  }, []);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-host" id="toast-host" role="status" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className="toast"
            style={item.leaving ? { opacity: 0, transform: 'translateY(6px)' } : undefined}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
