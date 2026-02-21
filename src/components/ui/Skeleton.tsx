"use client";

interface SkeletonProps {
    variant?: "text" | "title" | "avatar" | "card" | "custom";
    width?: string;
    height?: string;
    className?: string;
    count?: number;
}

export default function Skeleton({
    variant = "text",
    width,
    height,
    className = "",
    count = 1,
}: SkeletonProps) {
    const getStyles = () => {
        switch (variant) {
            case "title":
                return { width: width || "60%", height: height || "1.5rem" };
            case "avatar":
                return { width: width || "3rem", height: height || "3rem", borderRadius: "50%" };
            case "card":
                return { width: width || "100%", height: height || "8rem" };
            case "custom":
                return { width, height };
            default:
                return { width: width || "100%", height: height || "1rem" };
        }
    };

    const styles = getStyles();

    if (count > 1) {
        return (
            <div className="flex flex-col gap-2">
                {Array.from({ length: count }).map((_, i) => (
                    <div
                        key={i}
                        className={`skeleton ${className}`}
                        style={styles}
                    />
                ))}
            </div>
        );
    }

    return <div className={`skeleton ${className}`} style={styles} />;
}

export function SkeletonCard() {
    return (
        <div className="glass-card">
            <div className="flex items-center gap-4 mb-4">
                <Skeleton variant="avatar" />
                <div className="flex-1">
                    <Skeleton variant="title" className="mb-2" />
                    <Skeleton width="40%" />
                </div>
            </div>
            <Skeleton count={3} />
        </div>
    );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="glass-card">
            <div className="flex gap-4 mb-4 pb-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <Skeleton width="20%" />
                <Skeleton width="25%" />
                <Skeleton width="15%" />
                <Skeleton width="20%" />
                <Skeleton width="10%" />
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3">
                    <Skeleton width="20%" />
                    <Skeleton width="25%" />
                    <Skeleton width="15%" />
                    <Skeleton width="20%" />
                    <Skeleton width="10%" />
                </div>
            ))}
        </div>
    );
}
