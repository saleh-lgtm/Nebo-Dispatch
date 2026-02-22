import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getSOPWithDetails } from "@/lib/sopActions";
import SOPDetailClient from "./SOPDetailClient";

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
