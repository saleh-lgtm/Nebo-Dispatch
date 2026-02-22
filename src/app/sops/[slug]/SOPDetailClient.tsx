"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    BookOpen,
    Clock,
    User,
    FolderOpen,
    Star,
    CheckCircle,
    AlertCircle,
    List,
    ChevronRight,
    Download,
    FileDown,
} from "lucide-react";
import { toggleSOPFavorite, acknowledgesSOP } from "@/lib/sopActions";
import { useRouter } from "next/navigation";

interface RelatedSOP {
    id: string;
    title: string;
    slug: string;
    description: string | null;
}

interface SOP {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    content: string;
    category: string | null;
    quickReference: string | null;
    requiresAcknowledgment: boolean;
    createdBy: { id: string; name: string | null };
    createdAt: Date;
    updatedAt: Date;
    relatedSOPs: RelatedSOP[];
    isRead: boolean;
    isAcknowledged: boolean;
    isFavorited: boolean;
}

interface Props {
    sop: SOP;
}

interface TOCItem {
    id: string;
    text: string;
    level: number;
}

export default function SOPDetailClient({ sop }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isFavorited, setIsFavorited] = useState(sop.isFavorited);
    const [isAcknowledged, setIsAcknowledged] = useState(sop.isAcknowledged);
    const [showTOC, setShowTOC] = useState(false);
    const [showQuickRef, setShowQuickRef] = useState(false);

    // Generate table of contents from headings
    const tableOfContents = useMemo((): TOCItem[] => {
        const toc: TOCItem[] = [];
        const lines = sop.content.split("\n");
        let index = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                toc.push({ id: `heading-${index}`, text: trimmed.slice(2), level: 1 });
                index++;
            } else if (trimmed.startsWith("## ")) {
                toc.push({ id: `heading-${index}`, text: trimmed.slice(3), level: 2 });
                index++;
            } else if (trimmed.startsWith("### ")) {
                toc.push({ id: `heading-${index}`, text: trimmed.slice(4), level: 3 });
                index++;
            }
        }
        return toc;
    }, [sop.content]);

    const handleToggleFavorite = async () => {
        startTransition(async () => {
            try {
                const result = await toggleSOPFavorite(sop.id);
                setIsFavorited(result.favorited);
            } catch (error) {
                console.error("Failed to toggle favorite:", error);
            }
        });
    };

    const handleAcknowledge = async () => {
        startTransition(async () => {
            try {
                await acknowledgesSOP(sop.id);
                setIsAcknowledged(true);
                router.refresh();
            } catch (error) {
                console.error("Failed to acknowledge:", error);
            }
        });
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    };

    const handleExportPDF = () => {
        // Create a new window for printing
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const printDate = new Date().toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
        });

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${sop.title} - SOP</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                        color: #1a1a1a;
                        padding: 40px 60px;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .header {
                        border-bottom: 2px solid #3b82f6;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .logo {
                        font-size: 12px;
                        color: #6b7280;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        margin-bottom: 10px;
                    }
                    h1 {
                        font-size: 28px;
                        color: #111827;
                        margin-bottom: 10px;
                    }
                    .description {
                        font-size: 16px;
                        color: #4b5563;
                        margin-bottom: 15px;
                    }
                    .meta {
                        display: flex;
                        gap: 20px;
                        font-size: 12px;
                        color: #6b7280;
                    }
                    .meta span {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    .quick-ref {
                        background: #eff6ff;
                        border: 1px solid #bfdbfe;
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 30px;
                    }
                    .quick-ref h3 {
                        font-size: 14px;
                        color: #1d4ed8;
                        margin-bottom: 10px;
                    }
                    .content h2 {
                        font-size: 22px;
                        color: #3b82f6;
                        margin-top: 30px;
                        margin-bottom: 15px;
                        padding-bottom: 8px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    .content h3 {
                        font-size: 18px;
                        color: #3b82f6;
                        margin-top: 25px;
                        margin-bottom: 12px;
                    }
                    .content h4 {
                        font-size: 15px;
                        color: #374151;
                        margin-top: 20px;
                        margin-bottom: 10px;
                    }
                    .content p {
                        margin-bottom: 12px;
                        color: #374151;
                    }
                    .content ul, .content ol {
                        padding-left: 25px;
                        margin-bottom: 15px;
                    }
                    .content li {
                        margin-bottom: 6px;
                        color: #374151;
                    }
                    .content blockquote {
                        border-left: 3px solid #3b82f6;
                        padding-left: 15px;
                        margin: 15px 0;
                        color: #6b7280;
                        font-style: italic;
                    }
                    .content code {
                        background: #f3f4f6;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-family: 'Menlo', monospace;
                        font-size: 13px;
                    }
                    .content hr {
                        border: none;
                        border-top: 1px solid #e5e7eb;
                        margin: 25px 0;
                    }
                    .content strong {
                        color: #111827;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e5e7eb;
                        font-size: 11px;
                        color: #9ca3af;
                        text-align: center;
                    }
                    @media print {
                        body { padding: 20px 40px; }
                        .header { page-break-after: avoid; }
                        h2, h3, h4 { page-break-after: avoid; }
                        ul, ol { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">Standard Operating Procedure</div>
                    <h1>${sop.title}</h1>
                    ${sop.description ? `<p class="description">${sop.description}</p>` : ""}
                    <div class="meta">
                        ${sop.category ? `<span>Category: ${sop.category}</span>` : ""}
                        <span>Author: ${sop.createdBy.name || "Admin"}</span>
                        <span>Updated: ${formatDate(sop.updatedAt)}</span>
                    </div>
                </div>
                ${sop.quickReference ? `
                <div class="quick-ref">
                    <h3>Quick Reference</h3>
                    <div>${renderMarkdownToHTML(sop.quickReference)}</div>
                </div>
                ` : ""}
                <div class="content">
                    ${renderMarkdownToHTML(sop.content)}
                </div>
                <div class="footer">
                    <p>This document was exported on ${printDate}</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
    };

    // Helper function to convert markdown to HTML for PDF
    const renderMarkdownToHTML = (content: string): string => {
        const lines = content.split("\n");
        let html = "";
        let listItems: string[] = [];
        let listType: "ul" | "ol" | null = null;

        const flushList = () => {
            if (listItems.length > 0 && listType) {
                html += `<${listType}>${listItems.map(item => `<li>${item}</li>`).join("")}</${listType}>`;
                listItems = [];
                listType = null;
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("### ")) {
                flushList();
                html += `<h4>${trimmed.slice(4)}</h4>`;
            } else if (trimmed.startsWith("## ")) {
                flushList();
                html += `<h3>${trimmed.slice(3)}</h3>`;
            } else if (trimmed.startsWith("# ")) {
                flushList();
                html += `<h2>${trimmed.slice(2)}</h2>`;
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                if (listType !== "ul") {
                    flushList();
                    listType = "ul";
                }
                listItems.push(formatInlineMarkdown(trimmed.slice(2)));
            } else if (/^\d+\.\s/.test(trimmed)) {
                if (listType !== "ol") {
                    flushList();
                    listType = "ol";
                }
                listItems.push(formatInlineMarkdown(trimmed.replace(/^\d+\.\s/, "")));
            } else if (trimmed === "---" || trimmed === "***") {
                flushList();
                html += "<hr>";
            } else if (trimmed.startsWith("> ")) {
                flushList();
                html += `<blockquote>${formatInlineMarkdown(trimmed.slice(2))}</blockquote>`;
            } else if (trimmed === "" || trimmed.startsWith("```")) {
                flushList();
            } else {
                flushList();
                html += `<p>${formatInlineMarkdown(trimmed)}</p>`;
            }
        }

        flushList();
        return html;
    };

    const formatInlineMarkdown = (text: string): string => {
        let formatted = text;
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>");
        formatted = formatted.replace(/`(.+?)`/g, "<code>$1</code>");
        return formatted;
    };

    // Render markdown content with heading IDs
    const renderContent = (content: string) => {
        const lines = content.split("\n");
        const elements: React.JSX.Element[] = [];
        let listItems: string[] = [];
        let listType: "ul" | "ol" | null = null;
        let key = 0;
        let headingIndex = 0;

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
                    <h4 key={key++} id={`heading-${headingIndex++}`} style={{
                        fontSize: "1.0625rem",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginTop: "1.5rem",
                        marginBottom: "0.75rem",
                        scrollMarginTop: "2rem",
                    }}>
                        {trimmed.slice(4)}
                    </h4>
                );
            } else if (trimmed.startsWith("## ")) {
                flushList();
                elements.push(
                    <h3 key={key++} id={`heading-${headingIndex++}`} style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        color: "var(--primary)",
                        marginTop: "1.75rem",
                        marginBottom: "0.875rem",
                        scrollMarginTop: "2rem",
                    }}>
                        {trimmed.slice(3)}
                    </h3>
                );
            } else if (trimmed.startsWith("# ")) {
                flushList();
                elements.push(
                    <h2 key={key++} id={`heading-${headingIndex++}`} style={{
                        fontSize: "1.5rem",
                        fontWeight: 600,
                        color: "var(--primary)",
                        marginTop: "2rem",
                        marginBottom: "1rem",
                        paddingBottom: "0.5rem",
                        borderBottom: "1px solid var(--border)",
                        scrollMarginTop: "2rem",
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
        <div className="sop-detail">
            {/* Back Link */}
            <Link href="/sops" className="back-link">
                <ArrowLeft size={16} />
                Back to SOPs
            </Link>

            {/* Acknowledgment Banner */}
            {sop.requiresAcknowledgment && !isAcknowledged && (
                <div className="acknowledgment-banner">
                    <AlertCircle size={20} />
                    <div className="banner-content">
                        <strong>Acknowledgment Required</strong>
                        <p>Please read this SOP and acknowledge that you understand the procedures.</p>
                    </div>
                    <button
                        onClick={handleAcknowledge}
                        disabled={isPending}
                        className="acknowledge-btn"
                    >
                        <CheckCircle size={16} />
                        {isPending ? "Processing..." : "I Acknowledge"}
                    </button>
                </div>
            )}

            {/* Header */}
            <header className="sop-header">
                <div className="header-top">
                    <div className="header-icon">
                        <BookOpen size={24} />
                    </div>
                    <h1>{sop.title}</h1>
                    <div className="header-actions">
                        <button
                            onClick={handleToggleFavorite}
                            disabled={isPending}
                            className={`action-btn ${isFavorited ? "favorited" : ""}`}
                            title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Star size={18} fill={isFavorited ? "currentColor" : "none"} />
                        </button>
                        {tableOfContents.length > 0 && (
                            <button
                                onClick={() => setShowTOC(!showTOC)}
                                className={`action-btn ${showTOC ? "active" : ""}`}
                                title="Table of Contents"
                            >
                                <List size={18} />
                            </button>
                        )}
                        <button
                            onClick={handleExportPDF}
                            className="action-btn"
                            title="Export as PDF"
                        >
                            <FileDown size={18} />
                        </button>
                    </div>
                </div>

                {sop.description && <p className="description">{sop.description}</p>}

                <div className="meta-row">
                    {sop.category && (
                        <span className="meta-item">
                            <FolderOpen size={14} />
                            {sop.category}
                        </span>
                    )}
                    <span className="meta-item">
                        <User size={14} />
                        {sop.createdBy.name || "Admin"}
                    </span>
                    <span className="meta-item">
                        <Clock size={14} />
                        Updated {formatDate(sop.updatedAt)}
                    </span>
                    {isAcknowledged && (
                        <span className="meta-item acknowledged">
                            <CheckCircle size={14} />
                            Acknowledged
                        </span>
                    )}
                </div>
            </header>

            <div className="content-wrapper">
                {/* Table of Contents Sidebar */}
                {showTOC && tableOfContents.length > 0 && (
                    <aside className="toc-sidebar">
                        <h3>Contents</h3>
                        <nav>
                            {tableOfContents.map((item) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    className={`toc-item level-${item.level}`}
                                    onClick={() => setShowTOC(false)}
                                >
                                    {item.text}
                                </a>
                            ))}
                        </nav>
                    </aside>
                )}

                <div className="main-content">
                    {/* Quick Reference Toggle */}
                    {sop.quickReference && (
                        <div className="quick-ref-section">
                            <button
                                onClick={() => setShowQuickRef(!showQuickRef)}
                                className="quick-ref-toggle"
                            >
                                <Download size={16} />
                                {showQuickRef ? "Hide" : "Show"} Quick Reference
                            </button>
                            {showQuickRef && (
                                <div className="quick-ref-content">
                                    {renderContent(sop.quickReference)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Main Content */}
                    <article className="sop-content">
                        {renderContent(sop.content)}
                    </article>

                    {/* Related SOPs */}
                    {sop.relatedSOPs.length > 0 && (
                        <section className="related-section">
                            <h3>Related SOPs</h3>
                            <div className="related-grid">
                                {sop.relatedSOPs.map((related) => (
                                    <Link
                                        key={related.id}
                                        href={`/sops/${related.slug}`}
                                        className="related-card"
                                    >
                                        <span className="related-title">{related.title}</span>
                                        {related.description && (
                                            <span className="related-desc">{related.description}</span>
                                        )}
                                        <ChevronRight size={16} className="related-chevron" />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Acknowledgment Footer */}
                    {sop.requiresAcknowledgment && !isAcknowledged && (
                        <div className="acknowledgment-footer">
                            <p>By clicking "I Acknowledge", you confirm that you have read and understood this SOP.</p>
                            <button
                                onClick={handleAcknowledge}
                                disabled={isPending}
                                className="acknowledge-btn large"
                            >
                                <CheckCircle size={18} />
                                {isPending ? "Processing..." : "I Acknowledge This SOP"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .sop-detail {
                    padding: 1.5rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    text-decoration: none;
                    margin-bottom: 1.5rem;
                    transition: color 0.15s;
                }

                .back-link:hover {
                    color: var(--primary);
                }

                /* Acknowledgment Banner */
                .acknowledgment-banner {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem 1.25rem;
                    background: var(--warning-bg);
                    border: 1px solid var(--warning-border);
                    border-radius: var(--radius-lg);
                    margin-bottom: 1.5rem;
                    color: var(--warning);
                }

                .banner-content {
                    flex: 1;
                }

                .banner-content strong {
                    display: block;
                    font-size: 0.875rem;
                    margin-bottom: 0.125rem;
                }

                .banner-content p {
                    font-size: 0.8125rem;
                    opacity: 0.9;
                }

                .acknowledge-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: var(--success);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.15s;
                    white-space: nowrap;
                }

                .acknowledge-btn:hover:not(:disabled) {
                    background: #16A34A;
                }

                .acknowledge-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .acknowledge-btn.large {
                    padding: 0.75rem 1.5rem;
                    font-size: 0.9375rem;
                }

                /* Header */
                .sop-header {
                    margin-bottom: 1.5rem;
                }

                .header-top {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    flex-wrap: wrap;
                }

                .header-icon {
                    width: 48px;
                    height: 48px;
                    background: var(--primary-soft);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary);
                    flex-shrink: 0;
                }

                .sop-header h1 {
                    font-size: 1.75rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    flex: 1;
                    min-width: 0;
                }

                .header-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .action-btn {
                    padding: 0.5rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .action-btn:hover {
                    border-color: var(--border-hover);
                    color: var(--text-primary);
                }

                .action-btn.favorited {
                    color: var(--warning);
                    border-color: var(--warning);
                    background: var(--warning-bg);
                }

                .action-btn.active {
                    color: var(--primary);
                    border-color: var(--primary);
                    background: var(--primary-soft);
                }

                .description {
                    font-size: 1.0625rem;
                    color: var(--text-secondary);
                    line-height: 1.6;
                    margin-bottom: 1rem;
                    max-width: 700px;
                }

                .meta-row {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    flex-wrap: wrap;
                    padding-top: 1rem;
                    border-top: 1px solid var(--border);
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.8125rem;
                    color: var(--text-muted);
                }

                .meta-item.acknowledged {
                    color: var(--success);
                    font-weight: 500;
                }

                /* Content Layout */
                .content-wrapper {
                    display: flex;
                    gap: 1.5rem;
                }

                .toc-sidebar {
                    width: 250px;
                    flex-shrink: 0;
                    position: sticky;
                    top: 1.5rem;
                    height: fit-content;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1rem;
                }

                .toc-sidebar h3 {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.75rem;
                }

                .toc-sidebar nav {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .toc-item {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    text-decoration: none;
                    padding: 0.375rem 0.5rem;
                    border-radius: var(--radius-sm);
                    transition: all 0.15s;
                }

                .toc-item:hover {
                    background: var(--bg-hover);
                    color: var(--primary);
                }

                .toc-item.level-2 {
                    padding-left: 1rem;
                }

                .toc-item.level-3 {
                    padding-left: 1.5rem;
                    font-size: 0.75rem;
                }

                .main-content {
                    flex: 1;
                    min-width: 0;
                }

                /* Quick Reference */
                .quick-ref-section {
                    margin-bottom: 1.5rem;
                }

                .quick-ref-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.625rem 1rem;
                    background: var(--info-bg);
                    border: 1px solid var(--info-border);
                    border-radius: var(--radius-md);
                    color: var(--info);
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .quick-ref-toggle:hover {
                    background: var(--info);
                    color: white;
                }

                .quick-ref-content {
                    margin-top: 1rem;
                    padding: 1.5rem;
                    background: var(--info-bg);
                    border: 1px solid var(--info-border);
                    border-radius: var(--radius-lg);
                }

                /* Article Content */
                .sop-content {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 2rem;
                }

                /* Related SOPs */
                .related-section {
                    margin-top: 2rem;
                }

                .related-section h3 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 1rem;
                }

                .related-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1rem;
                }

                .related-card {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    padding: 1rem 1.25rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    text-decoration: none;
                    transition: all 0.15s;
                    position: relative;
                }

                .related-card:hover {
                    border-color: var(--primary);
                }

                .related-title {
                    font-size: 0.9375rem;
                    font-weight: 500;
                    color: var(--text-primary);
                    padding-right: 1.5rem;
                }

                .related-desc {
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .related-card :global(.related-chevron) {
                    position: absolute;
                    right: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }

                /* Acknowledgment Footer */
                .acknowledgment-footer {
                    margin-top: 2rem;
                    padding: 1.5rem;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    text-align: center;
                }

                .acknowledgment-footer p {
                    font-size: 0.875rem;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                }

                @media (max-width: 900px) {
                    .content-wrapper {
                        flex-direction: column;
                    }

                    .toc-sidebar {
                        width: 100%;
                        position: static;
                    }
                }

                @media (max-width: 640px) {
                    .header-top {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .header-actions {
                        width: 100%;
                    }

                    .acknowledgment-banner {
                        flex-direction: column;
                        text-align: center;
                    }

                    .sop-content {
                        padding: 1.25rem;
                    }
                }
            `}</style>
        </div>
    );
}
