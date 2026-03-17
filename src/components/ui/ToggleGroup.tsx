"use client";

import styles from "./ToggleGroup.module.css";

export interface ToggleOption {
  value: string;
  label: string;
  /** Custom color for the active state (e.g., market colors) */
  color?: string;
}

interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
}

/**
 * Shared toggle button group for mutually-exclusive selections.
 *
 * Usage:
 *   <ToggleGroup
 *     options={[{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }]}
 *     value={selected}
 *     onChange={setSelected}
 *   />
 *
 *   // With custom colors (e.g., market selector):
 *   <ToggleGroup
 *     options={[
 *       { value: "DFW", label: "DFW", color: "#E8553A" },
 *       { value: "AUS", label: "AUS", color: "#2D9CDB" },
 *     ]}
 *     value={market}
 *     onChange={setMarket}
 *   />
 */
export default function ToggleGroup({
  options,
  value,
  onChange,
  size = "md",
  fullWidth = false,
  className = "",
}: ToggleGroupProps) {
  const groupClasses = [
    styles.group,
    size === "sm" ? styles.sm : "",
    fullWidth ? styles.fullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={groupClasses} role="radiogroup">
      {options.map((option) => {
        const isActive = option.value === value;
        const hasColor = isActive && option.color;

        const buttonClasses = [
          styles.button,
          isActive ? (hasColor ? styles.activeColored : styles.active) : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={buttonClasses}
            style={hasColor ? ({ "--toggle-color": option.color } as React.CSSProperties) : undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
