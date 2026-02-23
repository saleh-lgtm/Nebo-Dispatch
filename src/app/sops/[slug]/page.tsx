import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getSOPWithDetails } from "@/lib/sopActions";
import dynamic from "next/dynamic";

const SOPDetailClient = dynamic(() => import("./SOPDetailClient"), {
    loading: () => (
        <div className="page-container">
            <div className="skeleton" style={{ width: "200px", height: "24px", marginBottom: "1rem" }} />
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

interface Props {
    params: Promise<{ slug: string }>;
}

export default async function SOPDetailPage({ params }: Props) {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    const { slug } = await params;
    const sop = await getSOPWithDetails(slug);

    if (!sop || !sop.isPublished) {
        notFound();
    }

    return <SOPDetailClient sop={sop} />;
}
