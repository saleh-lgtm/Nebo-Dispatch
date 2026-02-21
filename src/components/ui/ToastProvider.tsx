"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";
import { Toast, ToastType } from "./Toast";

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  isExiting?: boolean;
}

interface ToastContextType {
  toasts: ToastData[];
  addToast: (
    message: string,
    type?: ToastType,
    duration?: number
  ) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 5000;
const EXIT_ANIMATION_DURATION = 300;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear any existing timer for this toast
    const existingTimer = timersRef.current.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }

    // First, mark the toast as exiting for animation
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, isExiting: true } : toast
      )
    );

    // Then remove after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, EXIT_ANIMATION_DURATION);
  }, []);

  const addToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      duration: number = DEFAULT_DURATION
    ): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      setToasts((prev) => {
        // Remove oldest toasts if we're at the limit
        const newToasts = [...prev];
        while (newToasts.length >= MAX_TOASTS) {
          const oldestToast = newToasts.shift();
          if (oldestToast) {
            const timer = timersRef.current.get(oldestToast.id);
            if (timer) {
              clearTimeout(timer);
              timersRef.current.delete(oldestToast.id);
            }
          }
        }
        return [...newToasts, { id, message, type, duration }];
      });

      // Set up auto-dismiss timer
      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const containerStyles: React.CSSProperties = {
    position: "fixed",
    bottom: "1.5rem",
    right: "1.5rem",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column-reverse",
    gap: "0.75rem",
    maxWidth: "400px",
    width: "100%",
    pointerEvents: "none",
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div
        style={containerStyles}
        role="region"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            isExiting={toast.isExiting}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
      {/* Accessible live region for screen readers */}
      <div
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        {toasts.length > 0 && !toasts[toasts.length - 1].isExiting && (
          <span>
            {toasts[toasts.length - 1].type}: {toasts[toasts.length - 1].message}
          </span>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastContext must be used within a ToastProvider");
  }
  return context;
}

export { ToastContext };
export default ToastProvider;
