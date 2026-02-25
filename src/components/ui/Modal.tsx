"use client";

import { useEffect, useRef, ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    showCloseButton?: boolean;
}

const sizeStyles: Record<string, string> = {
    sm: "300px",
    md: "450px",
    lg: "600px",
    xl: "800px",
};

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    showCloseButton = true,
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            previousActiveElement.current = document.activeElement as HTMLElement;
            modalRef.current?.focus();
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
            previousActiveElement.current?.focus();
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
        >
            <div
                ref={modalRef}
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: sizeStyles[size], width: "90%" }}
                tabIndex={-1}
            >
                {(title || showCloseButton) && (
                    <div
                        className="flex items-center justify-between"
                        style={{
                            padding: "1rem 1.5rem",
                            borderBottom: "1px solid var(--border)",
                        }}
                    >
                        {title && (
                            <h2
                                id="modal-title"
                                className="font-display"
                                style={{ fontSize: "1.25rem", margin: 0 }}
                            >
                                {title}
                            </h2>
                        )}
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="btn btn-ghost btn-icon"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                )}
                <div style={{ padding: "1.5rem", maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>{children}</div>
            </div>
        </div>
    );
}
