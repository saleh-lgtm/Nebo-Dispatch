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
        const elements: JSX.Element[] = [];
        let listItems: string[] = [];
        let listType: "ul" | "ol" | null = null;
        let key = 0;

        const flushList = () => {
            if (listItems.length > 0 && listType) {
                const ListTag = listType;
                elements.push(
                    <ListTag
                        key={key++}
                        style={{
                            paddingLeft: "1.5rem",
                            marginBottom: "1rem",
                            color: "var(--text-secondary)",
                            lineHeight: 1.8,
                        }}
                    >
                        {listItems.map((item, i) => (
                            <li key={i} style={{ marginBottom: "0.25rem" }}>
                                {item}
                            </li>
                        ))}
                    </ListTag>
                );
                listItems = [];
                listType = null;
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();

            // Headers
            if (trimmed.startsWith("### ")) {
                flushList();
                elements.push(
                    <h4
                        key={key++}
                        className="font-display"
                        style={{
                            fontSize: "1.125rem",
                            color: "var(--text-primary)",
                            marginTop: "1.5rem",
                            marginBottom: "0.75rem",
                        }}
                    >
                        {trimmed.slice(4)}
                    </h4>
                );
            } else if (trimmed.startsWith("## ")) {
                flushList();
                elements.push(
                    <h3
                        key={key++}
                        className="font-display"
                        style={{
                            fontSize: "1.375rem",
                            color: "var(--accent)",
                            marginTop: "2rem",
                            marginBottom: "1rem",
                        }}
                    >
                        {trimmed.slice(3)}
                    </h3>
                );
            } else if (trimmed.startsWith("# ")) {
                flushList();
                elements.push(
                    <h2
                        key={key++}
                        className="font-display"
                        style={{
                            fontSize: "1.75rem",
                            color: "var(--accent)",
                            marginTop: "2rem",
                            marginBottom: "1rem",
                            borderBottom: "1px solid var(--border)",
                            paddingBottom: "0.5rem",
                        }}
                    >
                        {trimmed.slice(2)}
                    </h2>
                );
            }
            // Unordered list
            else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                if (listType !== "ul") {
                    flushList();
                    listType = "ul";
                }
                listItems.push(trimmed.slice(2));
            }
            // Ordered list
            else if (/^\d+\.\s/.test(trimmed)) {
                if (listType !== "ol") {
                    flushList();
                    listType = "ol";
                }
                listItems.push(trimmed.replace(/^\d+\.\s/, ""));
            }
            // Horizontal rule
            else if (trimmed === "---" || trimmed === "***") {
                flushList();
                elements.push(
                    <hr
                        key={key++}
                        style={{
                            border: "none",
                            borderTop: "1px solid var(--border)",
                            margin: "1.5rem 0",
                        }}
                    />
                );
            }
            // Code block marker
            else if (trimmed.startsWith("```")) {
                // Skip code fence markers for now
            }
            // Blockquote
            else if (trimmed.startsWith("> ")) {
                flushList();
                elements.push(
                    <blockquote
                        key={key++}
                        style={{
                            borderLeft: "3px solid var(--accent)",
                            paddingLeft: "1rem",
                            marginLeft: 0,
                            marginBottom: "1rem",
                            color: "var(--text-secondary)",
                            fontStyle: "italic",
                        }}
                    >
                        {trimmed.slice(2)}
                    </blockquote>
                );
            }
            // Empty line
            else if (trimmed === "") {
                flushList();
            }
            // Regular paragraph
            else {
                flushList();
                // Apply inline formatting
                let formatted = trimmed;
                // Bold
                formatted = formatted.replace(
                    /\*\*(.+?)\*\*/g,
                    '<strong style="color: var(--text-primary); font-weight: 600;">$1</strong>'
                );
                // Italic
                formatted = formatted.replace(
                    /\*(.+?)\*/g,
                    '<em>$1</em>'
                );
                // Inline code
                formatted = formatted.replace(
                    /`(.+?)`/g,
                    '<code style="background: var(--bg-muted); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875rem;">$1</code>'
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
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Back Link */}
            <Link
                href="/sops"
                className="flex items-center gap-2"
                style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.875rem",
                    width: "fit-content",
                }}
            >
                <ArrowLeft size={16} />
                Back to SOPs
            </Link>

            {/* Header */}
            <header className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <BookOpen size={28} className="text-accent" />
                    <h1 className="font-display" style={{ fontSize: "2rem" }}>
                        {sop.title}
                    </h1>
                </div>

                {sop.description && (
                    <p
                        style={{
                            color: "var(--text-secondary)",
                            fontSize: "1.0625rem",
                            maxWidth: "700px",
                        }}
                    >
                        {sop.description}
                    </p>
                )}

                <div
                    className="flex items-center gap-4 flex-wrap"
                    style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-muted)",
                        paddingTop: "0.5rem",
                        borderTop: "1px solid var(--border)",
                    }}
                >
                    {sop.category && (
                        <div className="flex items-center gap-1">
                            <FolderOpen size={14} />
                            <span>{sop.category}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1">
                        <User size={14} />
                        <span>{sop.createdBy.name || "Admin"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>Updated {formatDate(sop.updatedAt)}</span>
                    </div>
                </div>
            </header>

            {/* Content */}
            <article
                className="glass-card"
                style={{
                    maxWidth: "800px",
                }}
            >
                {renderContent(sop.content)}
            </article>
        </div>
    );
}
