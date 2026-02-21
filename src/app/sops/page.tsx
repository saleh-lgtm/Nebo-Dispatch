import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSOPsByCategory } from "@/lib/sopActions";
import Link from "next/link";
import { BookOpen, ChevronRight, FolderOpen } from "lucide-react";

export default async function SOPsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const sopsByCategory = await getSOPsByCategory();
    const categoryNames = Object.keys(sopsByCategory).sort();

    return (
        <div className="flex flex-col gap-6 animate-fade-in" style={{ padding: "1.5rem" }}>
            {/* Header */}
            <header className="flex items-center gap-3">
                <BookOpen size={28} className="text-accent" />
                <div>
                    <h1 className="font-display" style={{ fontSize: "1.75rem" }}>
                        Standard Operating Procedures
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                        Company guidelines and documentation
                    </p>
                </div>
            </header>

            {/* Categories Grid */}
            {categoryNames.length > 0 ? (
                <div className="flex flex-col gap-6">
                    {categoryNames.map((category) => (
                        <div key={category} className="flex flex-col gap-3">
                            {/* Category Header */}
                            <div className="flex items-center gap-2">
                                <FolderOpen size={18} className="text-accent" />
                                <h2
                                    className="font-display"
                                    style={{ fontSize: "1.25rem", color: "var(--accent)" }}
                                >
                                    {category}
                                </h2>
                                <span
                                    className="badge badge-primary"
                                    style={{ fontSize: "0.625rem" }}
                                >
                                    {sopsByCategory[category].length}
                                </span>
                            </div>

                            {/* SOPs in Category */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                                    gap: "1rem",
                                }}
                            >
                                {sopsByCategory[category].map((sop) => (
                                    <Link
                                        key={sop.id}
                                        href={`/sops/${sop.slug}`}
                                        className="glass-card glass-card-interactive"
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "1rem",
                                            padding: "1.25rem",
                                        }}
                                    >
                                        <div className="flex flex-col gap-1">
                                            <h3 style={{ fontWeight: 500 }}>{sop.title}</h3>
                                            {sop.description && (
                                                <p
                                                    style={{
                                                        fontSize: "0.8125rem",
                                                        color: "var(--text-secondary)",
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                >
                                                    {sop.description}
                                                </p>
                                            )}
                                        </div>
                                        <ChevronRight
                                            size={20}
                                            style={{ color: "var(--text-muted)", flexShrink: 0 }}
                                        />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    className="glass-card"
                    style={{
                        textAlign: "center",
                        padding: "3rem",
                    }}
                >
                    <BookOpen
                        size={48}
                        style={{ opacity: 0.3, margin: "0 auto 1rem" }}
                    />
                    <p style={{ color: "var(--text-secondary)" }}>
                        No SOPs available yet. Check back later.
                    </p>
                </div>
            )}
        </div>
    );
}
