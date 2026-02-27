import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllAnnouncementsWithStats } from "@/lib/notesActions";
import dynamic from "next/dynamic";

const NotesClient = dynamic(() => import("./NotesClient"), {
    loading: () => (
        <div className="page-container">
            <div className="page-header"><h1 className="page-title">Company Announcements</h1></div>
            <div className="skeleton-card" style={{ height: "300px" }} />
        </div>
    ),
});

export default async function NotesPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/login");
    }

    if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard");
    }

    const announcements = await getAllAnnouncementsWithStats();

    return (
        <NotesClient
            initialNotes={announcements as never}
            currentUserId={session.user.id}
        />
    );
}
