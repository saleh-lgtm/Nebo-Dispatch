"use client";

import { ReactNode } from "react";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral";

interface BadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    icon?: ReactNode;
    size?: "sm" | "md";
}

export default function Badge({
    children,
    variant = "neutral",
    icon,
    size = "md",
}: BadgeProps) {
    const sizeStyles = {
        sm: { padding: "0.125rem 0.375rem", fontSize: "0.625rem" },
        md: { padding: "0.25rem 0.5rem", fontSize: "0.75rem" },
    };

    return (
        <span
            className={`badge badge-${variant} flex items-center gap-1`}
            style={{
                ...sizeStyles[size],
                borderRadius: "9999px",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.025em",
            }}
        >
            {icon && <span style={{ display: "flex" }}>{icon}</span>}
            {children}
        </span>
    );
}

export function RoleBadge({ role }: { role: string }) {
    const variants: Record<string, BadgeVariant> = {
        SUPER_ADMIN: "danger",
        ADMIN: "info",
        DISPATCHER: "success",
    };

    return (
        <Badge variant={variants[role] || "neutral"}>
            {role.replace("_", " ")}
        </Badge>
    );
}

export function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, BadgeVariant> = {
        ACTIVE: "success",
        INACTIVE: "neutral",
        PENDING: "warning",
        APPROVED: "success",
        REJECTED: "danger",
        COMPLETED: "success",
        IN_PROGRESS: "info",
    };

    return (
        <Badge variant={variants[status] || "neutral"}>
            {status.replace("_", " ")}
        </Badge>
    );
}
