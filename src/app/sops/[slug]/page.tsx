import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getSOPBySlug } from "@/lib/sopActions";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, User, FolderOpen } from "lucide-react";

interface Props {
    params: Promise<{ slug: string }>;
}

export default async function SOPDetailPage({ params }: Props) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const { slug } = await params;
    const sop = await getSOPBySlug(slug);

    if (!sop || !sop.isPublished) {
        notFound();
    }

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    // Simple markdown-like rendering
    const renderContent = (content: string) => {
        const lines = content.split("\n");
        const elements: React.JSX.Element[] = [];
        let listItems: string[] = [];
        let listType: "ul" | "ol" | null = null;
        let key = 0;

        const listStyle = {
            paddingLeft: "1.5rem",
            marginBottom: "1rem",
            color: "var(--text-secondary)",
            lineHeight: 1.8,
        };

        const flushList = () => {
            if (listItems.length > 0 && listType) {
                const ListTag = listType;
                elements.push(
                    <ListTag key={key++} style={listStyle}>
                        {listItems.map((item, i) => (
                            <li key={i} style={{ marginBottom: "0.375rem" }}>{item}</li>
                        ))}
                    </ListTag>
                );
                listItems = [];
                listType = null;
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("### ")) {
                flushList();
                elements.push(
                    <h4 key={key++} style={{
                        fontSize: "1.0625rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginTop: "1.5rem",
                        marginBottom: "0.75rem",
                    }}>
                        {trimmed.slice(4)}
                    </h4>
                );
            } else if (trimmed.startsWith("## ")) {
                flushList();
                elements.push(
                    <h3 key={key++} style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        color: "var(--primary)",
                        marginTop: "1.75rem",
                        marginBottom: "0.875rem",
                    }}>
                        {trimmed.slice(3)}
                    </h3>
                );
            } else if (trimmed.startsWith("# ")) {
                flushList();
                elements.push(
                    <h2 key={key++} style={{
                        fontSize: "1.5rem",
                        fontWeight: 600,
                        color: "var(--primary)",
                        marginTop: "2rem",
                        marginBottom: "1rem",
                        paddingBottom: "0.5rem",
                        borderBottom: "1px solid var(--border)",
                    }}>
                        {trimmed.slice(2)}
                    </h2>
                );
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                if (listType !== "ul") {
                    flushList();
                    listType = "ul";
                }
                listItems.push(trimmed.slice(2));
            } else if (/^\d+\.\s/.test(trimmed)) {
                if (listType !== "ol") {
                    flushList();
                    listType = "ol";
                }
                listItems.push(trimmed.replace(/^\d+\.\s/, ""));
            } else if (trimmed === "---" || trimmed === "***") {
                flushList();
                elements.push(
                    <hr key={key++} style={{
                        border: "none",
                        borderTop: "1px solid var(--border)",
                        margin: "1.5rem 0",
                    }} />
                );
            } else if (trimmed.startsWith("```")) {
                // Skip code fence markers
            } else if (trimmed.startsWith("> ")) {
                flushList();
                elements.push(
                    <blockquote key={key++} style={{
                        borderLeft: "3px solid var(--primary)",
                        paddingLeft: "1rem",
                        marginLeft: 0,
                        marginBottom: "1rem",
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                    }}>
                        {trimmed.slice(2)}
                    </blockquote>
                );
            } else if (trimmed === "") {
                flushList();
            } else {
                flushList();
                let formatted = trimmed;
                formatted = formatted.replace(
                    /\*\*(.+?)\*\*/g,
                    '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>'
                );
                formatted = formatted.replace(
                    /\*(.+?)\*/g,
                    '<em>$1</em>'
                );
                formatted = formatted.replace(
                    /`(.+?)`/g,
                    '<code style="background: var(--bg-secondary); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875rem; font-family: monospace;">$1</code>'
                );

                elements.push(
                    <p
                        key={key++}
                        style={{
                            color: "var(--text-secondary)",
                            lineHeight: 1.8,
                            marginBottom: "1rem",
                        }}
                        dangerouslySetInnerHTML={{ __html: formatted }}
                    />
                );
            }
        }

        flushList();
        return elements;
    };

    return (
        <div style={{ padding: "1.5rem", maxWidth: "900px", margin: "0 auto" }}>
            {/* Back Link */}
            <Link
                href="/sops"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.875rem",
                    textDecoration: "none",
                    marginBottom: "1.5rem",
                }}
            >
                <ArrowLeft size={16} />
                Back to SOPs
            </Link>

            {/* Header */}
            <header style={{ marginBottom: "2rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                    <div style={{
                        width: "48px",
                        height: "48px",
                        background: "var(--primary-soft)",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--primary)",
                        flexShrink: 0,
                    }}>
                        <BookOpen size={24} />
                    </div>
                    <h1 style={{ fontSize: "1.75rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {sop.title}
                    </h1>
                </div>

                {sop.description && (
                    <p style={{
                        fontSize: "1.0625rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                        marginBottom: "1rem",
                        maxWidth: "700px",
                    }}>
                        {sop.description}
                    </p>
                )}

                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1.5rem",
                    flexWrap: "wrap",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border)",
                }}>
                    {sop.category && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                            <FolderOpen size={14} />
                            <span>{sop.category}</span>
                        </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        <User size={14} />
                        <span>{sop.createdBy.name || "Admin"}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        <Clock size={14} />
                        <span>Updated {formatDate(sop.updatedAt)}</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <article style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "2rem",
            }}>
                {renderContent(sop.content)}
            </article>
        </div>
    );
}
