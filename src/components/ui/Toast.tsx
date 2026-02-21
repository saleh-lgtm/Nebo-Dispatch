"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  isExiting?: boolean;
  onClose: () => void;
}

const variantStyles: Record<
  ToastType,
  {
    borderColor: string;
    backgroundColor: string;
    iconColor: string;
    glowColor: string;
  }
> = {
  success: {
    borderColor: "var(--success)",
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    iconColor: "var(--success)",
    glowColor: "var(--success-glow)",
  },
  error: {
    borderColor: "var(--danger)",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    iconColor: "var(--danger)",
    glowColor: "var(--danger-glow)",
  },
  warning: {
    borderColor: "var(--warning)",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    iconColor: "var(--warning)",
    glowColor: "var(--warning-glow)",
  },
  info: {
    borderColor: "var(--accent)",
    backgroundColor: "rgba(183, 175, 163, 0.1)",
    iconColor: "var(--accent)",
    glowColor: "var(--accent-glow)",
  },
};

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={20} />,
  error: <XCircle size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

export function Toast({ id, message, type, isExiting, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const variant = variantStyles[type];

  // Trigger enter animation after mount
  useEffect(() => {
    // Use requestAnimationFrame to ensure the initial state is rendered first
    const frame = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const containerStyles: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    padding: "1rem",
    borderRadius: "0.5rem",
    backgroundColor: "var(--bg-secondary)",
    border: `1px solid var(--border)`,
    borderLeft: `4px solid ${variant.borderColor}`,
    boxShadow: `0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px ${variant.glowColor}`,
    transform: isExiting
      ? "translateX(120%)"
      : isVisible
        ? "translateX(0)"
        : "translateX(120%)",
    opacity: isExiting ? 0 : isVisible ? 1 : 0,
    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
    pointerEvents: "auto",
    maxWidth: "100%",
    width: "100%",
  };

  const iconContainerStyles: React.CSSProperties = {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: variant.iconColor,
  };

  const messageStyles: React.CSSProperties = {
    flex: 1,
    margin: 0,
    fontSize: "0.875rem",
    lineHeight: 1.5,
    color: "var(--text-primary)",
    wordBreak: "break-word",
  };

  const closeButtonStyles: React.CSSProperties = {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.25rem",
    marginLeft: "0.5rem",
    background: "transparent",
    border: "none",
    borderRadius: "0.25rem",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "color 0.15s ease, background-color 0.15s ease",
  };

  const handleCloseHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = "var(--text-primary)";
    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
  };

  const handleCloseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = "var(--text-secondary)";
    e.currentTarget.style.backgroundColor = "transparent";
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={containerStyles}
      data-toast-id={id}
    >
      <span style={iconContainerStyles} aria-hidden="true">
        {icons[type]}
      </span>
      <p style={messageStyles}>{message}</p>
      <button
        onClick={onClose}
        style={closeButtonStyles}
        onMouseEnter={handleCloseHover}
        onMouseLeave={handleCloseLeave}
        aria-label="Dismiss notification"
        type="button"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default Toast;
