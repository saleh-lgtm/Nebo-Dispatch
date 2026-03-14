"use client";

import { X } from "lucide-react";
import styles from "./Contacts.module.css";

interface TagBadgeProps {
    name: string;
    color: string;
    size?: "sm" | "md";
    onRemove?: () => void;
}

export default function TagBadge({ name, color, size = "sm", onRemove }: TagBadgeProps) {
    // Calculate contrasting text color
    const getContrastColor = (hexColor: string) => {
        const hex = hexColor.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? "#000000" : "#ffffff";
    };

    const textColor = getContrastColor(color);

    return (
        <span
            className={`${styles.tagBadge} ${size === "md" ? styles.tagBadgeMd : ""}`}
            style={{ backgroundColor: color, color: textColor }}
        >
            {name}
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className={styles.tagRemove}
                    aria-label={`Remove ${name} tag`}
                >
                    <X size={12} />
                </button>
            )}
        </span>
    );
}
