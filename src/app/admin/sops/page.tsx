import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllSOPs } from "@/lib/sopActions";
import SOPsAdminClient from "./SOPsAdminClient";

export default async function SOPsAdminPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const sops = await getAllSOPs({ includeUnpublished: true });

    return <SOPsAdminClient initialSOPs={sops} />;
}
