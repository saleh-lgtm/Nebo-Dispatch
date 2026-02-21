import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSOPsByCategory } from "@/lib/sopActions";
import Link from "next/link";
import { BookOpen, ChevronRight, FolderOpen, FileText } from "lucide-react";

interface SOP {
    id: string;
    title: string;
    slug: string;
    description: string | null;
}

export default async function SOPsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const sopsByCategory = await getSOPsByCategory();
    const categoryNames = Object.keys(sopsByCategory).sort();

    return (
        <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
            {/* Header */}
            <header style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
                <div style={{
                    width: "48px",
                    height: "48px",
                    background: "var(--primary-soft)",
                    borderRadius: "var(--radius-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary)",
                }}>
                    <BookOpen size={24} />
                </div>
                <div>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                        Standard Operating Procedures
                    </h1>
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        Company guidelines and documentation
                    </p>
                </div>
            </header>

            {/* Categories */}
            {categoryNames.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {categoryNames.map((category) => (
                        <section key={category} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <FolderOpen size={18} style={{ color: "var(--primary)" }} />
                                <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--primary)" }}>
                                    {category}
                                </h2>
                                <span style={{
                                    padding: "0.125rem 0.5rem",
                                    background: "var(--primary-soft)",
                                    color: "var(--primary)",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                }}>
                                    {sopsByCategory[category].length}
                                </span>
                            </div>

                            <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                                gap: "1rem",
                            }}>
                                {sopsByCategory[category].map((sop: SOP) => (
                                    <Link
                                        key={sop.id}
                                        href={`/sops/${sop.slug}`}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "1rem",
                                            padding: "1.25rem",
                                            background: "var(--bg-card)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-lg)",
                                            textDecoration: "none",
                                            transition: "all 0.15s ease",
                                        }}
                                    >
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", minWidth: 0 }}>
                                            <h3 style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--text-primary)" }}>
                                                {sop.title}
                                            </h3>
                                            {sop.description && (
                                                <p style={{
                                                    fontSize: "0.8125rem",
                                                    color: "var(--text-secondary)",
                                                    display: "-webkit-box",
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: "vertical",
                                                    overflow: "hidden",
                                                }}>
                                                    {sop.description}
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight size={20} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    padding: "4rem 2rem",
                    textAlign: "center",
                }}>
                    <FileText size={48} style={{ color: "var(--text-muted)", opacity: 0.3, marginBottom: "1rem" }} />
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
                        No SOPs available yet. Check back later.
                    </p>
                </div>
            )}
        </div>
    );
}
