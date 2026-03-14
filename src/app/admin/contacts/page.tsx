import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllContactsWithTags } from "@/lib/contactActions";
import { getTags } from "@/lib/tagActions";
import dynamic from "next/dynamic";

const ContactsAdminClient = dynamic(() => import("./ContactsAdminClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Contact Management</h1>
            </div>
            <div className="skeleton-card" style={{ height: "400px" }} />
        </div>
    ),
});

export default async function AdminContactsPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const [contacts, tags] = await Promise.all([
        getAllContactsWithTags(),
        getTags(),
    ]);

    return (
        <ContactsAdminClient
            initialContacts={contacts}
            initialTags={tags}
        />
    );
}
